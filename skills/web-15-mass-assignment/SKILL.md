---
name: web-15-mass-assignment
sequence: web-15
category: injection
domain: web
description: "Mass assignment (autobinding) testing: privileged field injection via JSON/XML body (isAdmin, role, credits), nested object manipulation, framework-specific (Rails, Laravel, Spring, Django), API version differentials, and hidden parameter discovery. Use when testing APIs with automatic model binding."
wordlist_ref: "wordlists/web/web-46-mass-assignment/"
---

# Mass Assignment — Web Offensive Methodology

## Quick Workflow

1. Identify endpoints that accept JSON/XML/form data and persist to a model
2. Compare model attributes vs what the UI form exposes — look for hidden fields
3. Inject privileged fields: `isAdmin`, `role`, `credits`, `balance`, `verified`
4. Test nested objects: `{"user": {"role": "admin", "profile": {"credits": 9999}}}`
5. Compare API version behavior: /v1 vs /v2 for field difference

---

## Detection

### Common Privileged Fields

```
isAdmin, admin, role, roles, userRole, access_level
credits, balance, points, tokens, quota
verified, email_verified, email_confirmed
plan, tier, subscription
api_key, api_secret, token
active, enabled, locked, suspended
ssn, tax_id, passport
```

### Request Injection Patterns

```json
// Standard request
{"name":"John","email":"john@test.com"}

// Add privileged fields
{"name":"John","email":"john@test.com","isAdmin":true}
{"name":"John","email":"john@test.com","role":"admin"}
{"name":"John","email":"john@test.com","credits":99999}

// Nested
{"user":{"name":"John","role":"admin"}}

// Array/collection
{"users":[{"name":"John","role":"admin"}]}
```

### Framework-Specific

| Framework | Vulnerable Pattern | Safe Pattern |
|-----------|-------------------|--------------|
| Rails | `User.create(params[:user])` | `User.create(user_params)` |
| Laravel | `User::create($request->all())` | `$request->validated()` |
| Spring | `@RequestBody User user` | `@ModelAttribute with binding whitelist` |
| Django | `User.objects.create(**request.data)` | `serializer.is_valid()` |
| ASP.NET | `TryUpdateModel(user)` | `[Bind(Include="name,email")]` |

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
| WAF block | Encoding, case variation, comment injection |
| Input sanitization | Double encoding, Unicode, null bytes |
| Rate limiting | X-Forwarded-For rotation, HTTP/2 multiplex |
| Blacklist | Alternative syntax, polyglot payloads |


## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/web/web-46-mass-assignment/`

**Files**:
- `wordlists/web/web-46-mass-assignment/payloads/mass_assignment/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- OWASP Mass Assignment Cheat Sheet
- CWE-915: Improperly Controlled Modification of Object Attributes
- CVE-2022-34673 (Rails mass assignment), CVE-2023-26327 (Spring Boot)
