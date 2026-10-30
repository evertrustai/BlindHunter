---
name: api-28-stateful-fuzzing
sequence: api-28
category: misc
domain: api
description: "Stateful API fuzzing: sequence-dependent endpoint testing, multi-step workflow fuzzing, state machine violation, and resource lifecycle manipulation. Use when testing complex API workflows."
wordlist_ref: "wordlists/api/api-11-stateful-fuzzing/"
---

# Stateful Fuzzing — API Offensive Methodology

## Quick Workflow

1. Map state machines for multi-step workflows (order→pay→ship, draft→submit→approve)
2. Fuzz each state transition: skip states, reverse states, double-transition
3. Test resource lifecycle: create→delete→recreate, create→update→delete→access
4. Test concurrent modifications of same resource

---

## Detection

### State Skip

```
Normal: POST /api/draft → POST /api/submit → POST /api/approve
Skip: POST /api/draft → POST /api/approve (skip submit)
```

### Double Transition

```
POST /api/orders/123/refund (success)
POST /api/orders/123/refund (should fail — already refunded)
```

### Resource Lifecycle

```
POST /api/users/create → 200 (user created)
DELETE /api/users/123 → 200 (deleted)
GET /api/users/123 → 404 (not found)
POST /api/users/create → 200 (recreated — might reuse old ID)
GET /api/users/123 → 200 (old data accessible)
```

---

## Tools

- RESTler — stateful REST API fuzzing
- Burp Intruder with session handling
- Custom Python scripts with requests.Session()




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


## Bypass Techniques

| Filter/Block | Bypass |
|-------------|--------|
| WAF/Input validation | Encoding, case variation, alternative syntax |
| Rate limiting | IP rotation via X-Forwarded-For, HTTP/2 multiplex |
| Blacklist | Alternative syntax, polyglot payloads |
| Blacklist bypass | Unicode, double encoding, null bytes |

## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/api/api-11-stateful-fuzzing/`

**Files**:
- `wordlists/api/api-11-stateful-fuzzing/payloads/graphql/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

