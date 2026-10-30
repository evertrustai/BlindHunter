---

name: api-01-spec-ingestion
sequence: api-01
category: misc
domain: api
description: "API specification ingestion and attack surface mapping skill. Covers OpenAPI/Swagger parsing, endpoint enumeration, authentication scheme detection, parameter discovery, and API documentation analysis for security testing. Use when beginning API security assessment."
wordlist_ref: "wordlists/api/api-01-spec-ingestion/"
---

# API Specification Ingestion — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Ingest, parse, and statically audit API specifications (OpenAPI 2/3, Swagger, GraphQL SDL,
WSDL/SOAP, AsyncAPI). Extract all endpoints, parameters, authentication schemes, and data
models to feed downstream attack sub-agents. Identify security anti-patterns in the spec itself.

## OWASP API Mapping
- API9:2023 Improper Inventory Management
- API8:2023 Security Misconfiguration

## Vulnerability Classes

### 1. Spec Exposure Discovery


### 2. Static Security Audit of Spec

**Authentication scheme weaknesses:**
```yaml
# Vulnerable: HTTP basic auth over API
securitySchemes:
  basicAuth:
    type: http
    scheme: basic

# Vulnerable: API key in query parameter
securitySchemes:
  apiKey:
    type: apiKey
    in: query   # should be header
    name: api_key

### 2b. Content-Type Switching Abuse (Gap Fix #14)
**Description:** Many APIs only validate request bodies against their expected content-type (e.g., `application/json`). Sending the same payload with a different content-type (`application/xml`, `application/x-www-form-urlencoded`, `text/plain`) may bypass validation, trigger different parsers, or enable XXE/CSRF bypass.

**Attack patterns:**


**Detection methodology:**
1. For each documented endpoint in the spec, note the expected `Content-Type`
2. Send the same payload body with alternative content-types
3. Compare responses: different behavior → content-type switching bypass
4. Test: JSON→XML, JSON→form-encoded, JSON→text/plain, JSON→multipart/form-data
5. If XML accepted → test for XXE; if form-encoded accepted → test CSRF bypass


### 2c. UTF-8 BOM Parser Bypass (Gap Fix #15)
**Description:** Some JSON parsers skip validation when the request body starts with a UTF-8 BOM (`\xEF\xBB\xBF`). This can bypass schema validation, WAF rules, or input sanitization that expects clean JSON.

**Attack pattern:**


**Detection methodology:**
1. Send normal JSON request to endpoint, record response
2. Send same body with UTF-8 BOM prefix (`\xEF\xBB\xBF`), record response
3. Compare responses: different behavior → BOM validation bypass
4. Test on all POST/PUT/PATCH endpoints accepting JSON bodies
5. If bypass confirmed → test privilege escalation, mass assignment, injection

**Known affected parsers:** Some Node.js body-parser versions, legacy Java JSON parsers, custom PHP JSON handlers.
```

**Missing security definitions:**


**Sensitive data in examples:**


**Hardcoded tokens in spec:**


### 3. Deprecated Endpoint Detection


### 4. Unauthenticated Endpoint Probing (Phase 3)




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

**Wordlist**: `wordlists/api/api-01-spec-ingestion/`

**Files**:
- `wordlists/api/api-01-spec-ingestion/payloads/spec_headers/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

