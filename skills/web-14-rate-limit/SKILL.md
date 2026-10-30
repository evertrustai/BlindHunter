---
name: web-14-rate-limit
sequence: web-14
category: misc
domain: web
description: "Rate limit bypass testing: IP rotation via X-Forwarded-For, header-based bypass (X-Forwarded-For, X-Real-IP, X-Originating-IP), distributed bypass via multiple endpoints, HTTP/2 stream multiplexing, login/lockout policy bypass, and CAPTCHA token reuse. Use when testing authentication rate limiting."
wordlist_ref: "wordlists/web/web-35-rate-limit-bypass/"
---

# Rate Limit Bypass — Web Offensive Methodology

## Quick Workflow

1. Identify rate-limited endpoints: login, OTP validate, password reset, API endpoints
2. Establish baseline — how many requests before block? (3, 5, 10, 100?)
3. Test IP rotation bypass via headers
4. Test endpoint mirror — `/api/v1/login` vs `/api/v2/login`
5. Test HTTP/2 multiplexing — all streams in one connection
6. Test credential stuffing — rotate accounts, not IPs

---

## Bypass Techniques

### IP Rotation via Headers

```
X-Forwarded-For: 1.2.3.4
X-Forwarded-For: 1.2.3.5
X-Real-IP: 1.2.3.6
X-Originating-IP: 1.2.3.7
X-Remote-IP: 1.2.3.8
X-Client-IP: 1.2.3.9
X-Host: 1.2.3.10
```

### HTTP/2 Stream Multiplexing

All 100 requests in a single TCP connection — per-connection rate limiter counts as 1, not 100.

### Endpoint Mirror Bypass

```
POST /api/v1/login → rate limited after 5 attempts
POST /api/v2/login → not rate limited
POST /api/login → different rate counter
POST /auth/login → separate counter
```

### CAPTCHA Token Reuse

```http
1. Solve CAPTCHA once → get token
2. Replay same token across 100 login attempts
3. Server validates token but doesn't mark it used
```

### Method/Case Variation

```
POST /login → rate limited
POST /Login → separate counter
GET /login → no rate limit on GET (but still processes params)
OPTIONS /login → unmonitored
```

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

**Wordlist**: `wordlists/web/web-35-rate-limit-bypass/`

**Files**:
- `wordlists/web/web-35-rate-limit-bypass/payloads/paths/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- OWASP Rate Limiting Testing
- CVE-2022-22980 (header bypass), CVE-2023-25659 (HTTP/2 bypass)
