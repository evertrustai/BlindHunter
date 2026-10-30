# Playbook — REST API IDOR

## ID-bearing surfaces to probe

1. **Path-segment ID** — `/api/users/{id}`, `/api/orders/{order_id}`,
   `/api/v1/invoices/{uuid}`.
2. **Query-string ID** — `?id=`, `?user_id=`, `?account_id=`, `?team=`.
3. **Body ID** — JSON body fields like `{"user_id": 123, ...}` in PUT/PATCH
   that may not be validated against the session.
4. **Header-carried ID** — `X-Account-Id`, `X-Tenant-Id`,
   `X-On-Behalf-Of-User`.

## Test matrix (run all 5 columns per endpoint)

| | Account 1 own | Account 1 → A2 | A2 own | A2 → A1 | Unauth → either |
|---|---|---|---|---|---|
| `GET /api/resource/{id}` | Baseline | The cross-tenant probe | Baseline reverse | Reverse cross | Auth requirement check |
| `PUT /api/resource/{id}` | Baseline | Cross-tenant *write* | Baseline reverse | Reverse cross | Auth requirement check |
| `DELETE /api/resource/{id}` | Baseline | Cross-tenant *destroy* — careful, get explicit auth | … | … | Auth check |
| `POST /api/resource` w/ `{id: foreign}` in body | Baseline | Body-ID forge | … | … | … |

## High-payoff variants

- **HTTP method downgrade** — `PUT /api/resource/{id}` is 401, but
  `POST /api/resource` with `{"id": <foreign>}` in body works.
- **API version downgrade** — `/api/v2/resource/{id}` enforces authz; old
  `/api/v1/resource/{id}` is still mounted with weaker auth.
- **Internal vs public split** — `/api/internal/resource/{id}` or
  `/api/admin/resource/{id}` may lack auth checks because devs assumed
  only the internal frontend would call it.
- **Trailing-slash / case** — `/api/resource/{id}/` vs `/api/resource/{id}`,
  `/api/RESOURCE/{id}` — some auth middleware is path-pattern-matched.
- **Path traversal in ID** — `/api/users/123/../456` → does the router
  normalize before authz?
- **ID-type swap** — Endpoint expects integer, send GUID. Or expects GUID,
  send integer. Some frameworks return different objects from different
  type handlers.
- **Bulk endpoints** — `POST /api/resource/bulk` with
  `{"ids": [own_id, foreign_id]}`. Bulk handlers often check the first ID
  and miss the rest.
- **Action endpoints** — `/api/orders/{id}/refund`,
  `/api/users/{id}/impersonate`, `/api/teams/{id}/transfer-ownership`.
  Action endpoints are often less-protected than the GET on the parent.
- **Export / download** — `/api/orders/{id}/download`,
  `/api/reports/{id}/export.csv`. Download endpoints often skip auth
  middleware for speed.
- **Search by foreign ID** — `/api/orders/search?customer_email=<foreign>`
  or `/api/users/search?id=<foreign>`. Search endpoints with no scope
  check are IDOR-at-scale.

## ID-in-body vs ID-in-path mismatch

The classic example:
```
PUT /api/orders/123          ← path says order 123
{                            ← body says "actually edit order 456"
  "id": 456,
  "status": "refunded"
}
```
Some frameworks authorize on `req.params.id` (123) but pass `req.body.id`
to the ORM call → cross-tenant write.

## Mass-assignment payload (always try)

When testing a PUT/PATCH on your own resource, throw these fields in:
```json
{
  "id": 1,
  "user_id": 1,
  "tenant_id": "<foreign-tenant>",
  "store_id": "<foreign-store>",
  "owner_id": "<foreign-user>",
  "role": "admin",
  "is_admin": true,
  "is_owner": true,
  "is_superuser": true,
  "permissions": ["*"],
  "balance": 9999999,
  "credit": 9999999,
  "verified": true,
  "email_verified": true,
  "email_verified_at": "2026-01-01T00:00:00Z",
  "plan": "enterprise"
}
```
If the response reflects any of these back as accepted, you have an
escalation primitive. Re-fetch to confirm persistence.
