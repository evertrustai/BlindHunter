---
name: api-05-auth-attack
sequence: api-05
category: auth
domain: api
description: "API authentication attack testing: credential stuffing, rate-limit bypass via IP rotation, token reuse/replay, JWT manipulation in API context, OAuth token interception, and multi-factor auth bypass. Use when testing API authentication security."
wordlist_ref: "wordlists/api/api-05-auth-attack/"
---

# Authentication Attack — API Offensive Methodology

## Quick Workflow

1. Profile auth mechanisms (JWT, API keys, Basic, OAuth, session cookies, mTLS)
2. Test credential stuffing — rotate IP via headers
3. Test token manipulation — alg:none, expired tokens, claim tampering
4. Test rate limiting — endpoint mirror, HTTP/2 multiplex, header rotation
5. Test MFA step-skip — navigate directly to post-auth endpoints

---

## Detection

### Auth Mechanism Enumeration

```
Authorization: Bearer <jwt>
Authorization: Basic <base64>
X-API-Key: <key>
Cookie: session=...
Authorization: Digest ...
```

### Credential Stuffing

```http
POST /api/login
X-Forwarded-For: 1.2.3.4
{"username":"admin","password":"password1"}
X-Forwarded-For: 1.2.3.5
{"username":"admin","password":"password2"}
```

### Token Manipulation

```http
# Test alg:none with tampered JWT
Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiJ9.

# Test expired token
Authorization: Bearer <expired_jwt>

# Test token from different user
Authorization: Bearer <victim_jwt>
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


## Bypass Techniques

| Filter/Block | Bypass |
|-------------|--------|
| WAF/Input validation | Encoding, case variation, alternative syntax |
| Rate limiting | IP rotation via X-Forwarded-For, HTTP/2 multiplex |
| Blacklist | Alternative syntax, polyglot payloads |
| Blacklist bypass | Unicode, double encoding, null bytes |

## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/api/api-05-auth-attack/`

**Files**:
- `wordlists/api/api-05-auth-attack/payloads/sqli/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- OWASP API2:2023 — Broken Authentication
- CVE-2023-29149, CVE-2022-38129
