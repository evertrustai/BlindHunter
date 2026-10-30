---

name: web-39-csrf
sequence: web-39
category: misc
domain: web
description: "Cross-Site Request Forgery testing skill for offensive security. Covers missing/weak CSRF token validation, SameSite cookie bypass, JSON CSRF via content-type confusion, GET-based CSRF, and CORS-enabled CSRF chains. Use when testing CSRF protections on state-changing endpoints."
wordlist_ref: "wordlists/web/web-40-csrf/"
---

# Cross-Site Request Forgery (CSRF) — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Test Cross-Site Request Forgery (CSRF) vulnerabilities — missing/weak token validation, SameSite cookie bypass, CSRF via content-type confusion, JSON CSRF, and CORS-enabled CSRF chains.

## OWASP Mapping
- A01:2021 Broken Access Control
- CWE-352: Cross-Site Request Forgery
- CWE-346: Origin Validation Error

## Vulnerability Classes

### 1. Missing CSRF Token
**Detection:**
- State-changing endpoint (POST/PUT/DELETE/PATCH) accepts requests without CSRF token
- Or token is not validated server-side (accepts any value, empty, or none)

**Test methodology:**
1. Record legitimate state-changing request with CSRF token
2. Remove CSRF token parameter entirely → does request succeed?
3. Replace CSRF token with empty string → does it succeed?
4. Replace with random value → does it succeed?

**High-priority endpoints:**
- Password change (`/account/password`)
- Email change (`/account/email`)
- Account deletion
- Payment/transfer actions
- Profile update
- Admin actions

### 2. CSRF Token Validation Bypass
**Token not tied to session:**
- Collect CSRF token from attacker's own account
- Use attacker's token in request with victim's session cookie
- If accepted → CSRF token not session-bound → bypassable

**Token validation only on presence check:**
- Server checks `if csrf_token in request.form` not `if csrf_token == session.csrf_token`
- Any non-empty string passes

**Token reuse after use:**
- CSRF token not single-use → extract from any page → use in CSRF attack indefinitely

### 3. SameSite Cookie Bypass Techniques
**SameSite=Lax bypass:**
- Lax allows cookies on top-level navigation GET requests
- Exploit: CSRF via GET request that causes state change
- CSRF via method override: `?_method=POST` or `X-HTTP-Method-Override: POST`

**SameSite=None → CSRF possible:**
- `SameSite=None` explicitly allows cross-site requests
- Cookies sent cross-site → traditional CSRF possible

**SameSite=Strict bypass via chain:**
- Strict only sent on same-origin requests
- If target has open redirect → redirect from same origin → first request trusted

**Cookie not yet SameSite:**
- No SameSite attribute → browser default (Lax or None depending on version)
- Pre-2021 Chrome: default None → CSRF possible

### 4. JSON CSRF (Content-Type Confusion)
**Scenario:**
- API endpoint accepts `application/json` with state-changing operation
- Browser's `fetch()` with `mode: 'no-cors'` only allows simple content types
- But server may accept `text/plain` body that is valid JSON

**Attack:**
```html
<form action="https://target.com/api/transfer" method="POST" enctype="text/plain">
<input name='{"to":"attacker","amount":1000,"padding":"' value='"}'>
</form>
```

POST body: `{"to":"attacker","amount":1000,"padding":"="}`
If server parses as JSON (ignoring Content-Type) → CSRF via form

**Also test:**
- `Content-Type: application/x-www-form-urlencoded` body that is also valid JSON
- Server parsing both formats → CSRF if CSRF protection only on JSON requests

### 5. CSRF via GET Request
**Dangerous patterns:**
- `/account/delete?confirm=true` — state change via GET
- `/api/subscribe?plan=premium` — subscription via GET
- `/admin/approve?request_id=123` — admin action via GET

**Exploit:**
```html
<img src="https://target.com/account/delete?confirm=true">
```

### 6. CSRF via Cross-Origin Flash (Legacy)
**Flash-based CSRF (historical, still relevant for older targets):**
- Flash policy file (`/crossdomain.xml`) with `<allow-access-from domain="*"/>`
- Flash can make cross-origin requests with arbitrary content-types
- Even with SameSite cookies (Flash requests treat cross-origin differently)

### 7. CSRF via CORS Misconfiguration
**Chain:**
- CORS allows `Origin: https://attacker.com` with credentials
- Attacker page fetches sensitive data → full read CSRF
- Attacker page submits forms → write CSRF with data exfil

### 8. CSRF Token in URL
**Anti-pattern:**
- CSRF token in URL: `/action?csrf=token123`
- Referer header leaks token to external resources
- Log files capture token → extract → use for CSRF attack

### 9. Clickjacking → CSRF Chain
**Combined:**
- Sensitive action lacks both CSRF protection AND X-Frame-Options
- Clickjacking triggers victim to click submit
- Even if CSRF token present → clickjacking can capture token (if in hidden field on same page)

### 10. CSRF in API Endpoints
**Common gap:**
- Web UI has CSRF protection
- API endpoints (`/api/v1/`) lack CSRF protection
- If API accepts `Authorization: Bearer` token from cookie → CSRF possible

---

# Analyze CSRF tokens from web-02
# Alert: "Absence of Anti-CSRF Tokens"
# Alert: "Cross-Site Request Forgery"
## Attack Surface (Parameter Matrix)

| Surface | CSRF Tests |
|---------|-----------|
| All POST forms | CSRF token presence + validation |
| PATCH/PUT/DELETE endpoints | Same-site cookie check |
| API endpoints | JSON CSRF, Bearer auth confusion |
| GET state-change endpoints | Direct CSRF via img/link |
| CSRF token parameter | Remove, empty, wrong, attacker's token |
| Content-Type header | JSON CSRF via text/plain |
| SameSite cookie flag | Per-cookie same-site analysis |
| Origin/Referer headers | If used as CSRF protection |

---

## HackerOne Report Patterns

**Pattern 1: CSRF on account deletion (H1 common)**
`DELETE /account` lacks CSRF token. Attacker creates page with form auto-submitting to `/account`. Victim visits page → account deleted.

**Pattern 2: CSRF token not session-bound (H1 #242745 type)**
Attacker logs in → gets CSRF token. Creates CSRF page using own CSRF token with victim's session cookie. Server validates token exists but not that it belongs to victim's session → CSRF succeeds.

**Pattern 3: JSON CSRF via text/plain (H1 multiple)**
`POST /api/transfer` accepts JSON but `SameSite=Lax` protects. Form with `enctype="text/plain"` submits JSON-like body → server accepts → transfer executed.

**Pattern 4: SameSite=Lax + GET CSRF (H1 #863538 type)**
`GET /api/subscribe?plan=premium&csrf_bypass=1` — state change via GET. SameSite=Lax allows cookies on GET top-level navigation → `<a href="https://target.com/api/subscribe?plan=premium">` → victim clicks → subscribed.

**Pattern 5: CORS + CSRF → account data theft and modification**
CORS misconfiguration + missing CSRF → attacker reads AND writes victim's data from cross-origin page.

---

## Zero-Day Research Hooks

### Novel CSRF Vectors
- HTTP/2 push-based CSRF: server push triggers authenticated request to attacker-controlled resource
- Service Worker CSRF: compromised SW intercepts requests → modifies → submits forged requests with victim's credentials
- Browser extension CSRF: extension injects scripts into page → makes authenticated cross-origin requests
- Fetch with `mode: no-cors` + blob response: exfiltrate response size (timing oracle for CSRF state detection)
- CSRF via WebSocket: send CSRF-like message over WebSocket if CSWH possible (web-19)

---

## False Positive Mitigation
- Confirm state change actually occurred (not just 200 response)
- Distinguish CSRF protection via Referer/Origin check from no protection (test both with and without)
- For SameSite: check ALL session cookies, not just first one
- NEVER emit on missing token alone without confirming bypass succeeds

---




## Hacker Mindset

**CSRF is about cookie-based auth, not about tokens.** If there's no session cookie, there's no CSRF. If there IS a session cookie, CSRF is possible regardless of token implementation.

**SameSite=Lax is bypassable via GET.** Lax allows cookies on top-level GET navigations. If the state-changing action works via GET, or accepts `X-HTTP-Method-Override: POST`, CSRF is still possible.

**JSON CSRF via text/plain content type.** HTML forms with `enctype="text/plain"` send JSON-like bodies. If the server parses JSON regardless of content type, you win.



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
- CSRF PoC Generator (Burp)


## Bypass Techniques

| Filter/Block | Bypass |
|-------------|--------|
| WAF block | Encoding, case variation, comment injection |
| Input sanitization | Double encoding, Unicode, null bytes |
| Rate limiting | X-Forwarded-For rotation, HTTP/2 multiplex |
| Blacklist | Alternative syntax, polyglot payloads |


## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/web/web-40-csrf/`

**Files**:
- `wordlists/web/web-40-csrf/payloads/xss/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

