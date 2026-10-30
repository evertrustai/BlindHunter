---
name: api-27-versioning
sequence: api-27
category: misc
domain: api
description: "API versioning abuse: outdated version endpoint discovery, version diff analysis for weaker security controls, deprecated endpoint access, and authorization bypass via older API versions."
wordlist_ref: ""
---

# API Versioning — Offensive Methodology

## Quick Workflow

1. Discover API versions: /v1/, /v2/, /v3/ prefix, header-based (Accept: version=1), or parameter
2. Test older versions for missing auth, weaker validation, different behaviors
3. Compare identical endpoints across versions for diff in security controls
4. Try deprecated endpoints that may still be active

---

## Detection

### Version Enumeration

```
/api/v1/users/me
/api/v2/users/me
/api/v3/users/me
/api/v4/users/me
PUT /api/users/me
/api/users/v1/me
```

### Version in Header

```http
Accept: application/vnd.target.v1+json
Accept: application/vnd.target.v2+json
Accept-version: 1
X-API-Version: 1
```

### Version Diff Analysis

| Endpoint | v1 (auth) | v2 (auth) | v3 (auth) |
|----------|-----------|-----------|-----------|
| GET /users | None | Bearer | Bearer+rate |
| DELETE /users | Bearer | Bearer | Bearer+admin |
| POST /admin | HTTP Basic | None | Bearer+scope |

If v1 has weaker auth → use v1 for bypass.

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

This skill provides methodology guidance rather than payload wordlists.
Refer to the specific attack skills (web-*, api-*, ai-*) for their wordlist payloads when applicable.

## References

- OWASP API9:2023 — Improper Inventory Management
