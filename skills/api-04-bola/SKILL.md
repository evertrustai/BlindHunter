---
name: api-04-bola
sequence: api-04
category: access-control
domain: api
description: "Broken Object Level Authorization (BOLA) testing: object ID enumeration in REST/GraphQL/gRPC, horizontal/vertical privilege escalation, UUID prediction, mass assignment via extra parameters, and indirect reference manipulation. API-specific variant of IDOR. Use when testing API authorization."
wordlist_ref: "wordlists/api/api-04-bola/"
---

# BOLA (Broken Object Level Authorization) — API Offensive Methodology

## Quick Workflow

1. Map all API endpoints that accept object identifiers: `/api/users/{id}`, `/api/orders/{order_id}`
2. Create two accounts (User A, User B) at different privilege levels
3. As User A, capture requests with object IDs
4. As User B, replay User A's requests — if data accessible, BOLA confirmed
5. Test UUID/GUID predictability, mass assignment, indirect references

---

## Detection

### Horizontal BOLA (same role, different user)

```http
GET /api/v1/users/123/profile
→ Switch to: GET /api/v1/users/456/profile
→ If User B's data returned: horizontal BOLA
```

### Vertical BOLA (escalate role)

```http
GET /api/v1/admin/users
→ If 200 from non-admin session: vertical BOLA
```

### GraphQL BOLA

```graphql
query {
  user(id: "victim-id") {
    email, ssn, role
  }
}
```

### UUID/GUID Testing

```bash
# Check if UUIDs are predictable (sequential, timestamp-based, MD5-based)
# Test with: common, sequential, or zero-uuid
GET /api/orders/00000000-0000-0000-0000-000000000000
GET /api/orders/ffffffff-ffff-ffff-ffff-ffffffffffff
```

---

## Bypass Techniques

| Technique | Example |
|-----------|---------|
| Encode IDs | `/api/user/MjQ2` (base64 of 246) → `/api/user/MjQ3` |
| Switch HTTP method | `GET /api/users/123` → `POST /api/users/123` |
| Array injection | `?id=123&id=456` or `?id[]=123&id[]=456` |
| Wildcard | `GET /api/users/*` or `/api/users/-` |
| JSON injection | `{"user_id": 123}`, `{"user":{"id":123}}` |
| Path traversal | `/api/users/123/../admin/` |

---

## Chaining

- **BOLA + Mass assignment**: access another user's data then modify it via extra fields
- **BOLA + GraphQL batched query**: enumerate multiple IDs in single query
- **BOLA + SSRF**: object ID in SSRF parameter → third-party data access

---





## Hacker Mindset

**Look for the edge cases.** Vulnerabilities live in the gap between what the developer assumed and what the framework actually does. Test every boundary: empty values, nulls, arrays, negative numbers, Unicode, very long strings.

**Blind detection always needs OOB.** If you can't see the output, set up a callback. No OOB = no confirmation.

**Chaining turns low/med into critical.** A single path traversal is medium. Path traversal + log file + admin session = RCE. Always think about what comes next.



## Chaining & Escalation

### Horizontal → Vertical Escalation
Start with horizontal IDOR (same role, different user). If found, test vertical (different role). Often horizontal leads to vertical.

### Chain with SSRF
If SSRF is present, use it to access internal IDOR endpoints not exposed externally.

### Mass Enumeration
Automate ID swapping across large ID ranges for mass data extraction.



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
- Autorize (Burp)
- AuthMatrix

## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/api/api-04-bola/`

**Files**:
- `wordlists/api/api-04-bola/payloads/idor/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- OWASP API4:2023 — Unrestricted Resource Consumption
- OWASP API1:2023 — Broken Object Level Authorization
