---
name: api-11-nosql-injection
sequence: api-11
category: injection
domain: api
description: "API NoSQL injection testing: MongoDB operator injection ($ne, $gt, $regex, $where), blind NoSQL via $regex character extraction, JSON body injection in REST APIs, and GraphQL NoSQLi via filter arguments. Use when testing APIs using MongoDB or other NoSQL databases."
wordlist_ref: "wordlists/api/api-11-stateful-fuzzing/"
---

# NoSQL Injection — API Offensive Methodology

## Quick Workflow

1. Identify API endpoints accepting JSON bodies or JSON:API filter params
2. Inject MongoDB operators ($ne, $gt, $regex) in place of values
3. If auth bypass or unexpected results, NoSQLi confirmed
4. Escalate via $where JavaScript injection for RCE or blind extraction

---

## Detection

### JSON Body Operator Injection

```json
// Standard: {"username":"admin","password":"secret"}
// Bypass:  
{"username":{"$ne":""},"password":{"$ne":""}}
{"username":{"$gt":""},"password":{"$gt":""}}
{"username":{"$regex":".*"},"password":{"$regex":".*"}}
{"$or":[{"admin":true}]}
```

### GraphQL Filter Injection

```graphql
query {
  users(filter: {username: {_regex: ".*"}}) {
    id, email
  }
}
```

### Blind Extraction via $regex

```json
{
  "username": {"$regex": "^a.*"},
  "password": {"$ne": ""}
}
```

---





## Hacker Mindset

**NoSQL injection bypasses auth better than SQLi.** You don't need to understand the query structure — just inject `{"$ne":""}` and the auth check collapses.

**Blind NoSQL extraction is faster than SQL blind** because `$regex` gives you character-by-character match without time delays.

**MongoDB `$where` is JavaScript evaluation.** If you find a `$where` injection, you're one step from server-side JS execution.



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
- NoSQLMap

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

## References

- OWASP API8:2023 — Injection
- MongoDB $where, $regex, $ne operators
