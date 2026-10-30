---
name: api-07-bfla
sequence: api-07
category: access-control
domain: api
description: "Broken Function Level Authorization (BFLA) testing: horizontal/vertical function access, admin endpoint enumeration, HTTP method bypass, role confusion via header manipulation, and GraphQL mutation access control. Use when testing API authorization for privileged functions."
wordlist_ref: "wordlists/api/api-07-resource-limits/"
---

# BFLA (Broken Function Level Authorization) — API Offensive Methodology

## Quick Workflow

1. Enumerate all API functions (including admin/internal)
2. As low-privilege user, attempt to call admin/high-privilege functions
3. Test HTTP method permutations: POST vs PUT on same path
4. Test role confusion headers: X-Role, X-Admin, X-Hasura-Role
5. Test GraphQL mutations with elevated permissions

---

## Detection

### Admin Function Access

```http
# As regular user, try:
GET /api/admin/users
POST /api/admin/config
DELETE /api/users/{id}
PATCH /api/users/{id}/role
```

### HTTP Method Bypass

```http
# If POST /api/admin/delete-user requires admin:
GET /api/admin/delete-user
PUT /api/admin/delete-user
PATCH /api/admin/delete-user
OPTIONS /api/admin/delete-user
```

### Role Header Confusion

```http
X-Role: admin
X-Admin: true
X-Hasura-Role: admin
X-Hasura-User-Id: 1
X-Forwarded-User: admin
```

---

## BFLA vs BOLA

| BOLA | BFLA |
|------|------|
| Access another user's object | Execute another user's function |
| `GET /api/users/{id}` (their id) | `DELETE /api/users/{id}` (any id) |
| Read violation | Write/action violation |
| Horizontal or vertical | Always vertical |

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

**Wordlist**: `wordlists/api/api-07-resource-limits/`

**Files**:
- `wordlists/api/api-07-resource-limits/payloads/sqli/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- OWASP API5:2023 — Broken Function Level Authorization
- CVE-2023-33188, CVE-2024-25092
