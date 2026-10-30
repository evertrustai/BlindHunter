---
name: api-09-tenancy-isolation
sequence: api-09
category: auth
domain: api
description: "Multi-tenant isolation testing: cross-tenant data access via IDOR/BOLA, tenant ID manipulation in JWT/headers/body, SSRF between tenant partitions, shared resource contention, and cloud tenancy boundary bypass. Use when testing SaaS/cloud API multi-tenant architectures."
wordlist_ref: "wordlists/api/api-31-tenancy-isolation/"
---

# Tenancy Isolation — API Offensive Methodology

## Quick Workflow

1. Create accounts in two different tenants (different orgs/groups)
2. Identify where tenant context is derived (JWT claim, header, URL path, subdomain)
3. Attempt to access Tenant A's resources from Tenant B's session
4. Attempt tenant ID injection in requests that don't normally include it
5. Test shared resource pools — rate limits, queues, caches

---

## Detection

### Tenant Boundary Tests

```http
# Tenant A account, modify tenant identifier:
GET /api/v1/tenants/TENANT_A/users
→ Change to: GET /api/v1/tenants/TENANT_B/users

# JWT claim tampering
# Decode JWT → change tenant_id claim → re-encode
```

### Tenant ID in Headers

```http
X-Tenant-ID: tenant-b
X-Organization: victim-org
X-Customer-ID: 456
X-Account: victim
```

### Shared Resource Pools

```http
# If rate limits shared across tenants:
# Tenant A exhausts rate limit → Tenant B blocked (DoS)
# If queue shared: Tenant A submits jobs → Tenant B's jobs delayed
```

---

## Chaining

- **Tenant isolation + BOLA**: cross-tenant data access via predictable IDs
- **Tenant isolation + SSRF**: metadata service accessible from one tenant's compute → credential theft
- **JWT tenant claim tampering**: forge tenant_id in unsigned JWT

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

**Wordlist**: `wordlists/api/api-31-tenancy-isolation/`

**Files**:
- `wordlists/api/api-31-tenancy-isolation/payloads/sqli/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- OWASP API1:2023 — BOLA (cross-tenant variant)
- CVE-2023-33188, CWE-653 (Improper Isolation)
