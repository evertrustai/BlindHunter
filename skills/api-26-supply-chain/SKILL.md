---

name: api-26-supply-chain
sequence: api-26
category: misc
domain: api
description: "API supply chain security testing skill. Covers dependency confusion, package hijacking, CI/CD pipeline attacks, third-party API trust, and upstream dependency vulnerability assessment. Use when evaluating API supply chain security."
wordlist_ref: "wordlists/api/api-21-supply-chain/"
---

# API Supply Chain Security — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Test API supply chain security — vulnerabilities in third-party API dependencies consumed by
the target API, dependency confusion attacks, API key exposure in requests/responses, SDK
vulnerabilities, and transitive trust abuse in API-to-API communication chains.

## OWASP API Mapping
- API8:2023 Security Misconfiguration
- A06:2021 Vulnerable and Outdated Components
- CWE-494: Download of Code Without Integrity Check

## Vulnerability Classes

### 1. Third-Party API Key Exposure
**Detect exposed API keys for third-party services:**


**Sources to scan:**
- API responses (see api-17-sensitive-data-pii)
- Error messages
- JS source files
- Spec/documentation files
- Public git history

### 2. API-to-API Trust Chain Attacks
**Pattern:** Target API trusts incoming requests from another API it consumes.

```
Attacker → Target API → Third-Party API
If target API passes user input directly to third-party API:
- SSRF: user-controlled URL passed to third-party fetch
- Injection: user input passed to third-party query parameter
- Token theft: third-party API key in request headers
```

**Test:** Inject payloads into fields passed to third-party APIs.

### 3. Dependency Confusion in API Backend
**Attack:** If backend installs npm/pip packages at runtime with user-influenced package names.

```
POST /api/plugins/install {"package": "attacker-package"}
→ Backend runs npm install attacker-package
→ If internal package registry has lower-version vs public → confusion attack
```

### 4. Vulnerable Third-Party SDK in API
**Detect SDK versions from headers/responses:**
```
X-Powered-By: Express 3.x  → CVE search
Server: PHP/5.6.40  → many CVEs
X-Generator: Strapi v3.0  → check CVEs
```

**SDK vulnerability mapping:**
- Strapi v3.x → multiple auth bypass CVEs
- Swagger UI < 3.20.9 → XSS CVE-2019-17495
- Apollo GraphQL < 2.14.2 → DoS CVE
- AWS SDK v2 → credential exposure patterns

### 5. API Spec File Dependency Vulnerabilities
**External $ref in OpenAPI spec:**
```yaml
# spec.yaml
components:
  schemas:
    ExternalModel:
      $ref: "https://raw.githubusercontent.com/..."  # external reference
```

**Risks:**
- External ref under attacker control → spec poisoning
- External ref to internal URL → SSRF during spec parsing
- Outdated cached external schema → vulnerable component

### 6. NPM/PyPI Supply Chain in API Backend
**Test if API backend uses auto-update or vulnerable packages:**
```
GET /api/health → {"version": "...", "dependencies": {...}}  → version disclosure
GET /package.json, /requirements.txt, /Gemfile.lock  → dependency manifest exposure
```

**Cross-reference with CISA KEV and npm advisory database.**

### 7. SDK Signature Bypass
**Attack:** If API uses SDK that validates HMAC/signatures, test for bypass.


### 8. Transitive Trust Elevation
**Attack:** If API grants elevated trust to requests from known partners.

```
X-Api-Source: stripe-webhook  → if app trusts without verification
X-Partner-Id: google          → if app grants elevated permissions
X-Internal-Service: backend   → if app skips auth for internal services
```

---

# Probe for dependency manifest files
# Trust header injection
## Attack Surface (Parameter Matrix)

| Surface | Supply Chain Tests |
|---------|-------------------|
| All API response bodies | Third-party key patterns |
| API error messages | SDK version disclosure |
| HTTP headers | Version/tech disclosure |
| Dependency manifests | Vulnerable package detection |
| API spec $ref | External reference SSRF |
| Trust headers | Transitive trust bypass |
| Plugin/extension install | Dependency confusion |

---

## HackerOne Report Patterns

**Pattern 1: Stripe key in API response (H1 Critical)**
`GET /api/admin/payments` returns `{"stripe_secret": "sk_live_xxx"}` → full payment processing access.

**Pattern 2: Dependency manifest exposed (H1 Medium/High)**
`/package.json` accessible → outdated package versions → CVE mapping → exploitation.

**Pattern 3: X-Internal-Source header bypass (H1 Critical)**
`X-Internal-Source: gateway` → app skips auth → full API access as internal service.

**Pattern 4: npm package with malicious code via dependency confusion (H1 Critical)**
Internal package name also on public npm with higher version → CI/CD installs public version → RCE.

---

## Zero-Day Research Hooks

### Novel Supply Chain Vectors
- API specification registry poisoning: shared spec registry (like Swagger Hub) → spec injection
- SDK auto-update channels: some SDKs phone home for updates → MitM update injection
- GraphQL schema stitching: remote schema fetched at runtime → SSRF + injection
- OAuth authorization server discovery: .well-known/openid-configuration referenced by external URL
- Webhook delivery service (e.g., Svix): vulnerabilities in webhook infrastructure affect all customers

---

## False Positive Mitigation
- API key: verify key is live and not revoked
- Trust header: confirm actual elevated access (not just 200)
- Vulnerable SDK: confirm CVE applies to detected version
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

## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/api/api-21-supply-chain/`

**Files**:
- `wordlists/api/api-21-supply-chain/payloads/keys/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

