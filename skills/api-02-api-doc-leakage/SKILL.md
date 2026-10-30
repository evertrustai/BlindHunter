---

name: api-02-api-doc-leakage
sequence: api-02
category: misc
domain: api
description: "API documentation leakage testing skill. Covers exposed Swagger/OpenAPI endpoints, debug endpoints, internal API documentation, GraphQL introspection, and sensitive information in API responses. Use when searching for unintended API documentation exposure."
wordlist_ref: "wordlists/api/api-26-api-doc-leakage/"
---

# API Documentation Leakage — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Test for API documentation leakage — Swagger/OpenAPI/GraphQL schema exposure in production,
Postman collections with embedded credentials, .well-known endpoint abuse, HAR files,
changelog files revealing internal architecture, and collection runner artifacts.

## OWASP API Mapping
- API9:2023 Improper Inventory Management
- A05:2021 Security Misconfiguration
- CWE-200: Exposure of Sensitive Information

## Vulnerability Classes

### 1. Swagger/OpenAPI Spec Exposure
**Comprehensive path list:**
```
/swagger.json, /swagger.yaml, /swagger.yml
/api-docs, /api-docs.json, /api-docs.yaml
/swagger/index.html, /swagger-ui.html, /swagger-ui/
/openapi.json, /openapi.yaml, /openapi.yml
/v1/api-docs, /v2/api-docs, /v3/api-docs
/api/v1/docs, /api/v2/docs
/api/swagger.json, /api/openapi.json
/apispec/, /spec/
/apidocs, /apidocs/
/rest/api-docs
/backend/api-docs
/service/api-docs
/.well-known/openapi.json
/scalar/, /redoc/
/docs/, /docs/api/
```

### 2. GraphQL Schema Exposure (Introspection)
**Introspection endpoint patterns:**
```
/graphql, /graphql/, /GraphQL
/graphiql, /graphiql/  → development IDE exposed
/api/graphql
/gql
/query
/console → some implementations

# Introspection query
POST /graphql
{"query": "{ __schema { types { name fields { name type { name } } } } }"}

# SDL schema exposure
/graphql/schema.graphql
/graphql/schema.json
/__schema
```

### 3. Postman Collection Exposure
**Attack:** Postman collection files with embedded API keys.

```
/postman_collection.json
/collection.json
/api_collection.json
/postman/collection.json
/.postman/
/postman.json

# Also check git repos for Postman files:
/collection.postman_collection.json
/API.postman_collection.json
```

**Sensitive Postman collection patterns:**
- `"key": "Authorization", "value": "Bearer sk_live_..."` in pre-request scripts
- Environment variables with production API keys
- Saved responses containing PII

### 4. .well-known Endpoint Abuse
**Standard .well-known paths:**
```
/.well-known/openid-configuration  → OAuth/OIDC server metadata
/.well-known/oauth-authorization-server → AS metadata
/.well-known/jwks.json              → JWT public keys (useful for RS256→HS256)
/.well-known/security.txt           → Security contact + PGP key
/.well-known/apple-app-site-association → iOS app URLs
/.well-known/assetlinks.json         → Android app links
/.well-known/nodeinfo               → ActivityPub server info
/.well-known/change-password        → Password change URL
/.well-known/host-meta              → Web finger metadata
/.well-known/webfinger              → User discovery
```

### 5. HAR File Exposure
**HAR files capture all HTTP traffic including auth tokens:**

```
/debug.har
/traffic.har
/api.har
/network.har
/captured.har

# Also: Chrome DevTools exports stored in web root
# Contains: full request/response bodies, auth headers, cookies
```

### 6. Changelog and Version Files
**Technical information disclosure:**
```
/CHANGELOG.md, /CHANGELOG.txt, /CHANGELOG
/CHANGES, /CHANGES.md
/VERSION, /version.txt
/BUILD_INFO, /build.json
/release-notes.md
/ROADMAP.md → future feature preview

# API versioning history reveals deprecated/removed security controls
```

### 7. API Client SDK in Public Repository
**Exposed SDK code reveals API structure:**
```
# GitHub search patterns
org:target "api_key" "sk_live"
org:target "X-API-Key" "Authorization: Bearer"
org:target "/api/internal" language:javascript

# PyPI/npm packages from target company → analyze package source
```

### 8. Error-Induced Documentation Leakage
**Trigger verbose responses that reveal API structure:**
```
# Missing required parameter → error lists all required params
POST /api/users {}  → {"error": "Missing required fields: email, password, role, tenant_id"}

# Wrong type → error reveals schema
POST /api/orders {"quantity": "text"} → {"error": "quantity must be integer, got string"}

# Invalid enum → error reveals valid values
POST /api/user {"role": "manager"} → {"error": "role must be one of: user, admin, superadmin, staff"}
```

---

## Attack Surface (Parameter Matrix)

| Surface | Doc Leakage Tests |
|---------|------------------|
| All spec file paths | Swagger/OpenAPI exposure |
| GraphQL endpoint | Introspection query |
| .well-known paths | OAuth metadata, JWKS |
| Postman collection paths | Credential-containing collections |
| HAR file paths | Traffic capture with tokens |
| Changelog/version files | Architecture disclosure |
| Error responses | Schema inference |

---

## HackerOne Report Patterns

**Pattern 1: Swagger UI in production with auth bypass (H1 Critical)**
`/swagger-ui.html` accessible → lists all endpoints including admin → Swagger Try It Out feature works without auth → all admin operations executable.

**Pattern 2: Postman collection with production API key (H1 Critical)**
`/postman_collection.json` → `"Authorization": "Bearer sk_live_xxx"` → full production API access.

**Pattern 3: GraphQL introspection → hidden mutations (H1 High)**
Introspection query → `deleteAllUsers` mutation → admin function not in REST API docs.

**Pattern 4: JWKS.json → RS256→HS256 confusion (H1 Critical)**
`/.well-known/jwks.json` → extract RSA public key → forge HS256 JWT signed with public key → auth bypass.

**Pattern 5: Error response schema leakage (H1 Medium)**
`POST /api/register {}` → `"Missing required: ssn, creditCardNumber, bankAccount"` → reveals highly sensitive required fields.

---

## Zero-Day Research Hooks

### Novel Doc Leakage Vectors
- TypeSpec/Cadl spec files: new Microsoft API spec language → .cadl/.tsp files
- AsyncAPI spec: event-driven API documentation → reveals Kafka topics, event schemas
- gRPC server reflection v2: new protocol version leaks more metadata
- Backstage software catalog: Backstage.io files reveal internal service catalog
- Kong/Nginx config files: `kong.yml`, `nginx.conf` in web root → full routing config

---

## False Positive Mitigation
- Spec exposure: confirm actual endpoints/schemas in file (not empty spec)
- Credentials: verify keys are live (not example values like "YOUR_API_KEY")
- Postman: verify actual auth data (not template placeholders)
- NEVER emit on single signal

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

**Wordlist**: `wordlists/api/api-26-api-doc-leakage/`

**Files**:
- `wordlists/api/api-26-api-doc-leakage/payloads/api_paths/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

