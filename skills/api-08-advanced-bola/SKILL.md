---
name: api-08-advanced-bola
sequence: api-08
category: access-control
domain: api
description: "Advanced BOLA/IDOR techniques: batch/parallel enumeration, side-channel detection via response timing, CDN cache-key probing, gRPC/protobuf ID manipulation, and bulk data export abuse. Use when basic BOLA tests are blocked by WAF or rate limits."
wordlist_ref: "wordlists/api/api-08-bfla/"
---

# Advanced BOLA — API Offensive Methodology

## Quick Workflow

1. Apply when basic ID substitution is blocked by WAF/rate limits/auth
2. Use side-channels: timing differences, response size, cache hits
3. Test parallel/batch requests to avoid lockout
4. Test indirect references via export/download features
5. Test gRPC binary message ID fields

---

## Bypass Techniques

### Timing Side-Channel

```python
# Compare response times for existing vs non-existing objects
# Existing: 200ms, Non-existing: 50ms → timing oracle
for id in range(1, 1000):
    t = time_request(f"/api/users/{id}")
    if t > 100:  # object exists
        results.append(id)
```

### Cache Key Probing

```http
# CDN cache hit = object requested before (exists)
# Use If-None-Match to distinguish cache states
GET /api/users/123
If-None-Match: "abc"
→ 304 vs 200 reveals existence
```

### Batch/Parallel Enumeration

```http
# Send 50 ID probes in HTTP/2 parallel streams
# If rate limit per-IP, use X-Forwarded-For rotation
POST /api/users/batch
{"ids": [1, 2, 3, ..., 50]}
```

### gRPC Binary IDs

```bash
# Use grpcurl to send binary protobuf with modified IDs
grpcurl -d '{"user_id": 456}' target:443 api.UserService/GetUser
```

---





## Hacker Mindset

**Look for the edge cases.** Vulnerabilities live in the gap between what the developer assumed and what the framework actually does. Test every boundary: empty values, nulls, arrays, negative numbers, Unicode, very long strings.

**Blind detection always needs OOB.** If you can't see the output, set up a callback. No OOB = no confirmation.

**Chaining turns low/med into critical.** A single path traversal is medium. Path traversal + log file + admin session = RCE. Always think about what comes next.



## Chaining & Escalation

### Horizontal → Vertical Escalation
Start with horizontal IDOR (same role, different user). If found, test vertical (different role). Often horizontal leads to vertical.

### Chain with SSRF
If SSRF is present, use it to access internal IDOR endpoints not exposed externally.

### Mass Enumeration
Automate ID swapping across large ID ranges for mass data extraction.



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
- Autorize (Burp)
- AuthMatrix

## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/api/api-08-bfla/`

**Files**:
- `wordlists/api/api-08-bfla/payloads/idor/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- OWASP API1:2023 — BOLA
- CVE-2023-44487, CVE-2024-23362
