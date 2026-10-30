# Reference — Driving past AWS WAF / Cloudflare during IDOR probes

## TL;DR

When the target sits behind AWS WAF or Cloudflare, raw curl will be
challenged-or-blocked. Use:

```python
browser = playwright.chromium.launch(
    channel="chrome",        # real Chrome binary, not bundled Chromium
    headless=True,            # works fine — the bot signal is webdriver, not headless
    args=["--disable-blink-features=AutomationControlled",
          "--no-first-run", "--no-default-browser-check"],
)
ctx = browser.new_context(user_agent="Mozilla/5.0 ...", locale="en-US")
ctx.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")
ctx.add_cookies([...])
```

Pace requests at **15–30 seconds**. Fewer is fine; faster escalates the
challenge tier from JS-only (auto-solvable) to CAPTCHA (manual).

## AWS WAF challenge tiers

| HTTP status | Body title | What it means | Auto-solvable? |
|---|---|---|---|
| 200 | (app page) | Pass | n/a |
| 202 | (empty) | JS challenge — `gokuProps` JS solves on load and refreshes `aws-waf-token` | YES if real Chrome |
| 405 | `Human Verification` | CAPTCHA — checkbox required | NO, manual |
| 403 | `Forbidden` | Hard block | NO |

The `aws-waf-token` cookie is **single-use against rate-limit windows**.
Once burned, the JS challenge auto-rolls a new one — but only if real
Chrome JS is executing. `context.request.fetch()` does NOT execute the
challenge JS, so a series of fetches without intervening page-navigations
will eventually challenge then captcha.

## Workflow that survives WAF

1. **Prime** — `page.goto(BASE + "/")` to a benign authenticated page. Wait for
   `JavaScript is disabled` not to be in `document.body.innerText`. The
   WAF challenge auto-runs and stores a fresh token in the context.
2. **Probe** — open a new page and `goto` the target. Capture via
   `page.on("response", ...)` interception so the raw server HTML is
   captured before any SPA/Intercom DOM manipulation.
3. **Pace** — 20s sleep between probes.
4. **Stop if 405** — if you see HTTP 405 with "Human Verification" title,
   the IP is captcha-locked. Stop the script. Ask the user to open the
   target in a real browser, solve the captcha, and re-export the
   `aws-waf-token` cookie. Update cookies; resume.

## Cloudflare Turnstile

Same shape — usually 403 with a "Just a moment…" challenge interstitial.
`channel="chrome"` + stealth init usually passes. If not, the user has to
solve Turnstile once in their browser, and re-export the
`__cf_bm`/`cf_clearance` cookies.

## What NOT to do

- Don't use bundled Chromium (`channel=None`). Fingerprint is too clean.
- Don't use httpx/requests/curl in a loop. Every request burns the token
  and the WAF will escalate.
- Don't reuse `context.request.fetch()` after a captcha lockdown. The
  context is poisoned; create a new one with fresh cookies.
- Don't bother with VPNs/proxies unless you're explicitly authorized —
  source-IP changes can trigger account anomaly detection and lock out
  the test accounts.

## When response interception captures nothing

```python
captured = {}
def on_resp(r):
    if r.request.resource_type == "document" and r.url.rstrip("/") == url.rstrip("/"):
        captured["body"] = r.text()
page.on("response", on_resp)
page.goto(url, ...)
```

If `captured` is empty after a successful 200 navigation, the URL
normalization between `r.url` and `url` is off. Common causes:
- Trailing slash mismatch.
- 301 → final URL is different; match on `r.url.endswith(<path>)` instead.
- The page made an intermediate WAF-challenge response which auto-reloaded;
  the *final* response has the same URL — capture the last one with
  `if r.url ...: captured["body"] = r.text()` (overwriting is fine).

## Reading captured body when Intercom takes over the page

Modern SaaS apps load an Intercom widget that injects `<iframe>` and may
briefly hijack the page title. If you call `page.content()` after some
load delay, you risk capturing post-Intercom DOM (sometimes with title
"Fin says…"). Use response interception (above) — it gets the raw HTML
the server delivered, before any JS runs.
