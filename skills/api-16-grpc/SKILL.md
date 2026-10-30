---

name: api-16-grpc
sequence: api-16
category: protocol
domain: api
description: "gRPC and Protocol Buffers security testing skill. Covers gRPC reflection abuse, protobuf message manipulation, gRPC-Web bypass, metadata injection, and service enumeration. Use when testing gRPC-based APIs."
wordlist_ref: "wordlists/api/api-10-grpc/"
---

# gRPC & Protocol Buffers Security — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Test gRPC API security — protobuf fuzzing, BOLA/BFLA in RPC methods, missing authentication,
reflection service abuse, metadata header injection, and TLS misconfiguration in gRPC services.

## OWASP API Mapping
- API1:2023 Broken Object Level Authorization (BOLA via gRPC field injection)
- API2:2023 Broken Authentication
- API5:2023 Broken Function Level Authorization

## Vulnerability Classes

### 1. gRPC Reflection Service Abuse
**Attack:** gRPC reflection enabled → enumerate all services and methods.

```bash
# List all services
grpcurl -plaintext target.com:50051 list

# Describe a service
grpcurl -plaintext target.com:50051 describe UserService

# Call methods
grpcurl -plaintext -d '{}' target.com:50051 UserService/GetAllUsers
```

**High-risk reflected methods:**
- `AdminService/*` → admin operations
- `*.DeleteUser`, `*.BanUser`, `*.GetAllUsers`
- `*.InternalRPC`, `*.SystemRPC`

### 2. gRPC Authentication Bypass
**Missing auth in gRPC metadata:**


**JWT in gRPC metadata:**


### 3. Protobuf Field Injection (Mass Assignment)
**Unknown field injection:**


**Field type confusion:**
- Send string where int expected → parser exception → DoS or edge behavior
- Send int where bool expected → all non-zero values may be treated as true

### 4. gRPC-Web / HTTP Transcoding BOLA
**gRPC-Web bridges gRPC to HTTP/1.1:**
```
POST /UserService/GetUser
Content-Type: application/grpc-web+proto

→ Accessible from browser without gRPC client
→ Standard BOLA/BFLA attacks apply via HTTP
```

**HTTP transcoded paths:**
```
/grpc.gateway.runtime.ServeMux patterns:
GET /v1/users/{user_id}
POST /v1/admin/delete
```

### 5. gRPC Streaming Abuse
**Server streaming DoS:**


**Bidirectional streaming:**
- Send malformed protobuf → server crash
- Keep stream open × many connections → resource exhaustion

### 6. gRPC Metadata Header Injection
**Metadata injection:**


### 7. Missing TLS / Cleartext gRPC
**gRPC over HTTP (not HTTPS):**
```bash
grpcurl -plaintext target.com:50051 list
# If -plaintext works → no TLS → intercept/MitM possible
```

### 8. gRPC Error Information Disclosure
**Stack traces in gRPC errors:**
```
Status code: INTERNAL
Message: java.lang.NullPointerException at com.target.internal.UserService.getUser(UserService.java:142)
```

---

## Attack Surface (Parameter Matrix)

| Surface | gRPC Tests |
|---------|-----------|
| Reflection service | Service/method enumeration |
| All RPC methods | Auth bypass, BOLA |
| gRPC metadata | Header injection |
| Protobuf messages | Field injection, type confusion |
| gRPC streaming | DoS via open streams |
| gRPC-Web endpoints | HTTP-level attacks |
| gRPC TLS config | Cleartext + cert validation |
| gRPC error messages | Information disclosure |

---

## HackerOne Report Patterns

**Pattern 1: gRPC reflection enabled → full service enumeration (H1 High)**
Reflection enabled in production → `grpcurl list` reveals all internal services → complete attack surface mapped → admin methods called directly.

**Pattern 2: gRPC admin methods without auth (H1 Critical)**
`AdminService.DeleteUser` method accessible without auth metadata → all user accounts deletable.

**Pattern 3: gRPC metadata role injection (H1 Critical)**
`metadata=[("x-user-role", "admin")]` accepted → all admin functions accessible.

**Pattern 4: gRPC-Web transcoding BOLA (H1 High)**
`POST /v1/users/{other_user_id}` via gRPC-Web → same BOLA as REST API, but in gRPC transport.

---

## Zero-Day Research Hooks

### Novel gRPC Vectors
- gRPC over WebSocket: browser-compatible gRPC transport → new attack surface
- gRPC server reflection v2: newer reflection API may expose additional metadata
- Protobuf 3 optional fields: missing field vs default value → auth check bypass on default=false
- gRPC channelz service: debug service exposes internal channel stats → information disclosure
- gRPC health check service: health.Check without auth → service topology disclosure

---

## False Positive Mitigation
- Reflection: confirm actual service methods returned (not error)
- Auth bypass: confirm actual sensitive data returned
- Metadata injection: confirm role elevation actually works
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

**Wordlist**: `wordlists/api/api-10-grpc/`

**Files**:
- `wordlists/api/api-10-grpc/payloads/cmdi/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

