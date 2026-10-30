---
name: api-06-mass-assignment
sequence: api-06
category: auth
domain: api
description: "API mass assignment testing: privileged field injection via JSON/XML body, nested object manipulation, API version differentials, hidden parameter discovery, and framework-specific autobinding bypass. Use when testing APIs with automatic model binding."
wordlist_ref: "wordlists/api/api-06-mass-assignment/"
---

# Mass Assignment — API Offensive Methodology

## Quick Workflow

1. Identify endpoints accepting JSON/XML that map to server-side models
2. Compare model attributes vs UI form fields — look for hidden fields
3. Inject known privileged fields
4. Test nested objects and array-based assignments
5. Check API version behavior differences

---

## Detection

### Common Privileged Fields

```
isAdmin, admin, role, roles, userRole, access_level
credits, balance, points, tokens, quota, plan, tier
verified, email_verified, email_confirmed
active, enabled, locked, suspended
api_key, api_secret
ssn, tax_id, passport, credit_card
```

### Request Patterns

```json
// Standard
{"name":"John","email":"john@test.com"}
// Inject admin
{"name":"John","email":"john@test.com","isAdmin":true}
{"name":"John","email":"john@test.com","role":"admin"}
// Nested
{"user":{"name":"John","role":"admin"}}
// Array
{"users":[{"name":"John","isAdmin":true}]}
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

**Wordlist**: `wordlists/api/api-06-mass-assignment/`

**Files**:
- `wordlists/api/api-06-mass-assignment/payloads/mass_assignment/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- CWE-915: Improperly Controlled Modification of Object Attributes
- OWASP Mass Assignment Cheat Sheet
