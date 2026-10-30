---
name: api-03-auth-profiling
sequence: api-03
category: auth
domain: api
description: "API authentication profiling: detect and catalog all auth mechanisms (JWT, OAuth2, API keys, Basic, Digest, mTLS, session cookies, HMAC, custom schemes) across API endpoints. Maps auth requirements per path and feeds downstream auth-attack sub-agents."
wordlist_ref: "wordlists/api/api-03-auth-profiling/"
---

# API Authentication Profiling — Offensive Testing Methodology

## Quick Workflow

1. Collect all API endpoints from spec ingestion or crawling
2. Send a request to each endpoint without auth — catalog which return data
3. For authenticated endpoints, detect the mechanism (header content, cookie, error messages)
4. Collect sample tokens for each mechanism detected
5. Map auth requirements per endpoint — identify unprotected admin/internal paths

---

## Detection

### Auth Mechanism Fingerprinting

```
Authorization: Bearer <token>      → JWT or opaque bearer
Authorization: Basic <base64>       → HTTP Basic Auth
X-API-Key: <value>                  → API key in header
Cookie: session=<value>             → Session cookie
Authorization: Digest <params>      → HTTP Digest Auth
X-Auth-Token: <value>               → Custom auth header
Authorization: AWS4-HMAC-SHA256     → AWS Signature V4
X-Amz-Date: <date>                  → AWS sig date header
```

### Unauthenticated Endpoint Discovery

```bash
# Send request without any auth → if 200, endpoint is unprotected
curl -s -o /dev/null -w "%{http_code}" https://api.target.com/admin/users
# vs
curl -s -H "Authorization: Bearer $TOKEN" -o /dev/null -w "%{http_code}" https://api.target.com/admin/users
```

### Token Analysis

```bash
# Decode JWT
echo "<token>" | cut -d. -f2 | base64 -d 2>/dev/null

# Check API key format (length, prefix, character set)
echo "<key>" | wc -c
# sk_live_xxx, pk_live_xxx, AKIAxxx patterns reveal provider
```

---

## Top OWASP API Risks Detected

| OWASP API Risk | How Profiling Detects It |
|----------------|------------------------|
| API1:2023 BOLA | Endpoint returns data without verifying object ownership |
| API2:2023 Broken Auth | No auth on sensitive endpoints, weak token format |
| API7:2023 Server Side RF | Params accepting URLs without auth context |

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
| WAF/Input validation | Encoding, case variation, alternative syntax |
| Rate limiting | IP rotation via X-Forwarded-For, HTTP/2 multiplex |
| Blacklist | Alternative syntax, polyglot payloads |
| Blacklist bypass | Unicode, double encoding, null bytes |

## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/api/api-03-auth-profiling/`

**Files**:
- `wordlists/api/api-03-auth-profiling/payloads/auth_headers/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- OWASP API2:2023 — Broken Authentication
- RFC 7235 (HTTP Auth), RFC 7515 (JWT), RFC 6749 (OAuth2)
