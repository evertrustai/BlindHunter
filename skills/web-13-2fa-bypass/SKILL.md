---
name: web-13-2fa-bypass
sequence: web-13
category: auth
domain: web
description: "2FA/MFA bypass testing: direct navigation to post-login URL, OTP replay, OTP brute-force without rate limit, backup code abuse, race condition on validation, MFA step-skip via API call order manipulation, and push notification fatigue. Use when testing multi-factor authentication."
wordlist_ref: "wordlists/web/web-32-2fa-bypass/"
---

# 2FA/MFA Bypass — Web Offensive Methodology

## Quick Workflow

1. Map the full auth flow — every step between login and post-authentication
2. Try direct navigation to post-login URLs — if accessible, MFA is middleware-only
3. Replay OTP — same code accepted twice? No one-time-use enforcement
4. Brute-force OTP — 6 digits = 10^6 tries. If no rate limit, viable
5. Test race condition — submit N OTP guesses in parallel before lockout counter increments
6. Check backup codes — accessible via /api/me or predictable?

---

## Bypass Techniques

### Direct Navigation Bypass

```
POST /login → 200 (password correct, MFA challenge sent)
GET /dashboard → 401 (MFA required)
GET /dashboard → 200 (BYPASS — no step-up enforcement)
TRY: /dashboard, /api/me, /api/account/profile
```

### OTP Replay

```http
POST /api/2fa/validate
{"code":"123456","session":"xyz"}

# Replay same request — if 200 again, OTP not single-use
```

### OTP Brute Force

```http
# No rate limit on /api/2fa/validate → 10^6 requests at server speed
# With rate limit: rotate X-Forwarded-For
POST /api/2fa/validate {"code":"000000"}
POST /api/2fa/validate {"code":"000001"}
...
```

### Race Condition

Send 50 OTP guesses in parallel via HTTP/2 single-packet attack — if one passes before the lockout counter writes to DB, bypass succeeds.

### Backup Code Generation

```http
GET /api/me/backup-codes
GET /api/users/{id}/backup-codes
```

If accessible without MFA step-up → generate unlimited backup codes.

### Push Notification Fatigue

Send multiple login attempts to trigger push notifications — victim accidentally approves one.

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

## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/web/web-32-2fa-bypass/`

**Files**:
- `wordlists/web/web-32-2fa-bypass/payloads/mfa/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- OWASP MFA Bypass Testing
- CVE-2022-32119 (OTP replay), CVE-2023-32784 (backup code bypass)
