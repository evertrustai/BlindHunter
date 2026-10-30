---

name: api-21-mtls
sequence: api-21
category: protocol
domain: api
description: "Mutual TLS (mTLS) security testing skill. Covers certificate validation bypass, client certificate spoofing, mTLS downgrade attacks, and certificate pinning bypass. Use when testing mTLS implementations."
wordlist_ref: "wordlists/api/api-23-mtls/"
---

# Mutual TLS (mTLS) Security — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Test mutual TLS (mTLS) security — missing enforcement, self-signed certificate acceptance,
certificate CN/SAN validation bypass, mTLS header injection (X-Client-Cert), fallback to
bearer token, and client certificate data in API authorization decisions.

## OWASP API Mapping
- API2:2023 Broken Authentication
- API8:2023 Security Misconfiguration
- CWE-295: Improper Certificate Validation

## Vulnerability Classes

### 1. mTLS Not Enforced (Optional Client Cert)
**Attack:** Access mTLS-protected endpoint without client certificate.


**Fallback scenarios:**
- mTLS enforced at load balancer but not at application layer
- Development mode disables mTLS
- Some paths exempt from mTLS requirement

### 2. Self-Signed Certificate Acceptance
**Attack:** Present self-signed certificate; server accepts without CA validation.


### 3. mTLS Header Injection Bypass
**Attack:** Some setups terminate mTLS at load balancer and pass cert info as headers.

```
# Inject forged cert data headers (no actual TLS cert needed)
X-Client-Cert: FAKE_CERT_DATA
X-Client-Cert-CN: admin@target.com
X-Client-Cert-Subject: CN=admin,O=Target Corp
X-Forwarded-Client-Cert: CERT_DATA
X-SSL-Client-Cert: CERT_DATA
SSL-Client-Cert: CERT_DATA
X-Tls-Client-Cert: CERT_DATA
```

**Target:** If load balancer passes cert info as headers and application uses those headers for auth, header injection bypasses mTLS.

### 4. CN/SAN Validation Bypass
**Attack:** Present certificate with different CN but matching SANs.


**Wildcard cert abuse:**
- Cert with CN=`*.target.com` → accepted for all subdomains?
- `attacker.target.com` as SAN → bypass service-specific restrictions

### 5. Certificate Revocation Not Checked
**Attack:** Use revoked client certificate (OCSP/CRL not checked).


### 6. mTLS Pinning Bypass
**Attack:** App pins to specific cert but doesn't validate entire chain.

- Pin bypass via intermediate CA cert
- Pin mismatch in updated cert → fails all clients (DoS)
- Extract pinned cert public key from app code

### 7. Certificate Information in API Responses
**Leakage:** Server returns cert info in API responses.

```json
// GET /api/profile
{
  "name": "Service Account",
  "cert_cn": "svc-account@internal.target.com",  // internal CN exposed
  "cert_issuer": "Internal CA"                   // CA structure exposed
}
```

### 8. mTLS Downgrade Attack
**Attack:** Force connection without mTLS by:
- Connecting on different port (non-mTLS port exposed)
- HTTP endpoint alongside HTTPS+mTLS endpoint
- Header `Upgrade-Insecure-Requests: 0`
- Direct connection to backend bypassing load balancer

---

## Minimum 25 mTLS Test Cases

```
1.  No client cert → test if endpoint accessible
2.  Self-signed cert → test if accepted
3.  Expired cert → test if accepted
4.  Wrong CN cert → test if accepted
5.  Revoked cert (simulated) → OCSP check test
6.  X-Client-Cert: FAKE_VALUE header injection
7.  X-Client-Cert-CN: admin@target.com
8.  X-Client-Cert-Subject: CN=admin injection
9.  X-Forwarded-Client-Cert: FAKE
10. SSL-Client-Cert: FAKE
11. X-SSL-Client-Cert: FAKE
12. X-TLS-Client-Cert: FAKE
13. Empty X-Client-Cert header
14. Wildcard cert CN=*.target.com
15. Cert with admin SAN but user CN
16. Cert with user CN but admin SAN
17. Bearer token fallback (no cert)
18. HTTP connection (port 80, no TLS)
19. ws:// WebSocket without TLS
20. Direct backend connection (bypass LB)
21. Certificate chain validation test
22. Cert with future validity date
23. Cert with very long CN (buffer overflow)
24. Multiple X-Client-Cert headers
25. Base64 URL-encoded cert in header
```

---

# Header injection test
## Attack Surface (Parameter Matrix)

| Surface | mTLS Tests |
|---------|-----------|
| TLS client certificate | Enforcement, validation |
| X-Client-Cert headers | Injection bypass |
| All internal API endpoints | No-cert access |
| Load balancer vs app layer | Split enforcement |
| Non-standard ports | mTLS-free endpoints |
| Certificate CN/SAN | Manipulation |

---

## HackerOne Report Patterns

**Pattern 1: mTLS header injection (H1 Critical)**
Load balancer passes cert as `X-Client-Cert` header → attacker sends `X-Client-Cert: admin_cert_data` → bypasses mTLS entirely → full admin API access.

**Pattern 2: mTLS not enforced on all routes (H1 Critical)**
`/api/v2/admin` requires mTLS, `/api/v1/admin` does not → legacy version bypass.

**Pattern 3: Self-signed cert accepted (H1 High)**
mTLS configured but server accepts any cert including self-signed → no identity verification.

---

## Zero-Day Research Hooks

### Novel mTLS Vectors
- TLS session resumption bypass: resume TLS session that originally had mTLS → skip re-authentication
- ALPN negotiation bypass: negotiate http/1.1 via ALPN on mTLS port → some implementations skip cert check
- gRPC mTLS bypass: gRPC channel interceptor not applied to all methods
- Service mesh mTLS: Istio/Linkerd bypass via direct pod IP access (bypasses mesh)

---

## False Positive Mitigation
- No cert: confirm actual data returned (not certificate error page)
- Header injection: confirm actual authorized response (not generic 200)
- Self-signed: confirm application processed cert (not TLS layer rejection)
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

**Wordlist**: `wordlists/api/api-23-mtls/`

**Files**:
- `wordlists/api/api-23-mtls/payloads/host_header/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

