---
name: api-15-spec-injection
sequence: api-15
category: injection
domain: api
description: "API specification injection: parameter pollution via spec-defined fields, content-type switching (JSON→XML→form), UTF-8 BOM parser bypass, schema validation bypass via extra fields, and type confusion in auto-generated API clients. Use when testing APIs with strict schema validation."
wordlist_ref: "wordlists/api/api-32-spec-injection/"
---

# Specification Injection — API Offensive Methodology

## Quick Workflow

1. Study the OpenAPI/Swagger spec for expected parameters, types, formats
2. Send values outside spec: extra fields, wrong types, missing required fields
3. Test content-type switching: send XML where JSON expected, form where JSON expected
4. Test validation bypass via encoding (UTF-8 BOM, Unicode normalization)
5. Test type confusion: string instead of number, null instead of object

---

## Detection

### Extra Field Injection

```json
// Spec says: {"name": "string", "email": "string"}
// Send extra:
{"name": "John", "email": "j@t.com", "role": "admin", "isAdmin": true}
```

### Type Confusion

```json
// Spec says: "age": {"type": "integer"}
// Send: {"age": null} → might bypass validation
// Send: {"age": "twenty"} → error reveals schema
// Send: {"age": [1]} → array bypass
```

### Content-Type Switching

```xml
<!-- Send XML instead of JSON -->
Content-Type: application/xml
<user><name>admin</name><role>admin</role></user>
```

### UTF-8 BOM Bypass

```
Content-Type: application/json
Body: \xEF\xBB\xBF{"admin": true}
<!-- BOM may bypass schema validation -->
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

## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/api/api-32-spec-injection/`

**Files**:
- `wordlists/api/api-32-spec-injection/payloads/sqli/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- OWASP API8:2023 — Injection (spec injection variant)
- CVE-2023-26327, CVE-2024-22201
