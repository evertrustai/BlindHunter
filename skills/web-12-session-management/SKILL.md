---
name: web-12-session-management
sequence: web-12
category: auth
domain: web
description: "Session management testing: session fixation, insufficient invalidation, predictable tokens, cookie attribute misconfiguration (Secure/HttpOnly/SameSite), concurrent session handling, and session timeout bypass. Use when testing web session handling."
wordlist_ref: "wordlists/web/web-34-session-management/"
---

# Session Management — Web Offensive Methodology

## Quick Workflow

1. Capture session token on login — check for predictability, entropy, length
2. Test fixation: pre-set session cookie before login → does server reuse it?
3. Test invalidation: logout/password change/email change → is old token still valid?
4. Check cookie attributes: Secure, HttpOnly, SameSite, Path, Domain, __Host- prefix
5. Test concurrent sessions, idle timeout, absolute timeout

---

## Detection

### Session Token Analysis

```http
Set-Cookie: session=abc123; Path=/; HttpOnly
```

Check:
- **Length**: < 16 chars → low entropy
- **Pattern**: timestamp + hash → predictable
- **Characters**: alphanumeric only (not base64/base64url)
- **Prefix**: no `__Host-` → subdomain can overwrite

### Session Fixation

```http
1. Attacker: GET /login?session=ATTACKER_SESSION_ID
2. Victim clicks link → browser sets ATTACKER_SESSION_ID
3. Victim logs in → server uses ATTACKER_SESSION_ID
4. Attacker: access account with ATTACKER_SESSION_ID
```

Test: Set a known session ID before authenticating, then check if server uses it.

### Insufficient Invalidation

| Action | Test | Expected |
|--------|------|----------|
| Logout | Replay old session cookie | 401/redirect |
| Password change | Use old session after change | Requires re-auth |
| Email change | Use old session after change | Requires re-auth |
| 2FA enable | Use pre-2FA session | Requires 2FA |

---

## Cookie Attribute Checklist

| Attribute | If Missing | Risk |
|-----------|-----------|------|
| `Secure` | Session cookie sent over HTTP | Network eavesdropping |
| `HttpOnly` | JS can read cookie | XSS → session theft |
| `SameSite=Lax` | Default may be None | CSRF |
| `Path=/` | Restricted to subpath | May not cover all sensitive endpoints |
| `__Host-` prefix | Subdomain can set session cookie | Subdomain takeover → session clash |
| `Max-Age`/`Expires` | Session never expires | Persistent session hijack |

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

**Wordlist**: `wordlists/web/web-34-session-management/`

**Files**:
- `wordlists/web/web-34-session-management/payloads/paths/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- OWASP Session Management Cheat Sheet
- CVE-2023-29149 (session fixation), CVE-2022-38129 (invalidation bypass)
