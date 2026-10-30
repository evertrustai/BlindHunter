---
name: application-model-builder
description: "Mandatory first step BEFORE any payload testing. Build the Application Model (assets, actors, permissions, workflows, trust boundaries, state machines), then break assumptions systematically. Output must match schema below — unknowns marked as such."
---

# APPLICATION MODELING — mandatory before payloads

## Build the model (6 parts)
**Assets**: PII, funds, subscriptions, files, tokens/keys, roles, premium content, transaction history.
**Actors**: Guest, User, Premium, Moderator, Admin, Super Admin, Service Account, Support Agent.
**Permissions**: Browse→Create→Edit-own→Purchase→Moderate→Manage-all→Full-access ladder.
**Workflows**: login, registration, purchase, refund, invite, upgrade, approval, password reset, transfer, account deletion.
**Trust boundaries**: browser↔API, user↔user, tenant↔tenant, frontend↔backend, internal↔external, session after password change, unverified-email privileges.
**State machines**: per workflow states+transitions (Order: cart→pending→paid→shipped→delivered→refunded).

## Break assumptions
For every workflow: what did the developer assume? Test breaking each: skip steps (POST `/complete` without `/submit`), reorder (DELETE before CREATE), repeat (redeem coupon twice, refund twice), parallelize (50 concurrent withdrawals), run as another user/tenant (swap IDs).

## Business logic BEFORE technical
Before XSS/SQLi/SSRF: authorization, ownership, multi-user safety, tenant isolation, workflow integrity, approval flows, payment/coupon/subscription/wallet logic, invitation logic, role changes, state transitions.

## Chain findings
After any finding: does it combine with another? IDOR on user_id (read email) → change email via endpoint with no OTP → password reset → ATO (Critical).

## Multi-user analysis
Compare User A vs B vs Admin vs Guest: requests, responses (data leak?), ID guessability, permission differences, state changes.

## False positive control
Not a finding until: retested 3x · impact proven (attacker can actually DO) · zero-state exploitability · confirmed not intended.
Confidence: Low (possible FP) → Medium → High → Confirmed. Report only at Confirmed.

## SIBLING ENDPOINT ANALYSIS (NEW)

After identifying any endpoint, discover siblings via:
- **Path prefix swap**: `/api/v1/orders` → `/api/v2/orders`, `/api/orders/admin`, `/internal/orders`
- **HTTP method test**: GET → POST/PUT/PATCH/DELETE/OPTIONS on same path
- **Adjacent resource**: `/api/users` → `/api/profiles`, `/api/accounts`, `/api/identities`
- **ID reference shift**: `/api/orders/123` → `/api/orders/123/invoice`, `/api/orders/123/items`
- **Admin overlay**: `/api/orders` → `/admin/orders`, `/api/admin/orders`, `/manage/orders`
- **Format extension**: `/api/orders` → `/api/orders.json`, `/api/orders.xml`, `/api/orders?format=json`
- **Case mutation**: `/API/orders`, `/api/Orders`, `/Api/orders`
- **Version crawl**: `/api/v1/` → `/api/v2/`, `/api/v3/`, `/api/beta/`

Document each sibling's auth requirement, response shape, and data exposure.

## HYPOTHESIS GENERATION SIGNALS

For each model component, generate testable hypotheses from signals:

| Signal in Model | Hypothesis | Test |
|----------------|------------|------|
| Sequential IDs in asset | IDOR: User A can read User B's resource | Swap IDs between sessions |
| `role` / `permission` field in response | Mass Assignment: inject `"role":"admin"` | PATCH/PUT with extra fields |
| Multi-step workflow | State skip: POST final step without prior steps | Reorder/omit workflow steps |
| Balance/wallet/credits | Race condition: parallel withdraws exceed balance | 30 concurrent requests |
| Org/workspace/team ID | Cross-tenant: Tenant A accesses Tenant B data | Create 2 tenants, swap IDs |
| OTP/verification step | OTP bypass: skip step, change email mid-flow | POST next step without OTP |
| File upload | Upload abuse: MIME bypass, path traversal | Send PHP in image/jpeg |
| Coupon/discount field | Coupon abuse: negative quantity, race redemption | `"quantity":-1`, parallel apply |
| Subscription/plan_id | Downgrade abuse: access premium after expiry | Reuse old plan_id |
| Email in URL/body | Enumeration: diff responses for existing vs non-existing emails | Compare response sizes/timing |
| Free tier with API keys | Key abuse: use free-tier key for privileged actions | Test key on admin endpoints |
| Webhook/callback URL | SSRF: point webhook to internal IP | `http://169.254.169.254/latest/meta-data/` |
| Search/sort/filter params | SQLi: inject `' OR 1=1--` in sort clause | Boolean diff test |
| Template/email body params | SSTI: inject `{{7*7}}` in template fields | Check if `49` in response |
| Password reset token | Token predictability: decode, check timestamp base | Collect 10 tokens, find pattern |

## RESPONSE-DRIVEN NEXT ACTIONS

| What You Observe | What It Means | Next Action |
|-----------------|---------------|-------------|
| 200 OK but body is HTML/SPA | Catch-all, not endpoint | Try format extension, method override |
| 403 on GET, 200 on POST | Partial auth — POST may bypass | Test all methods, method override headers |
| 200 with empty data array | Exists but no records | Try other IDs, search params |
| 500 on malformed JSON | Poor input validation | Deepen malformed input, probe for stack trace |
| Timing diff >500ms on valid vs invalid | Processing cost diff | Enumeration → brute force |
| Response has `admin` field set to `false` | Can flip to `true` | Test mass assignment |
| Same response across all IDs | Cached/default response, not per-resource | Add cache-buster param |
| `Set-Cookie` with no HttpOnly/Secure | Session cookie misconfig | Check SameSite, path scope |
| GraphQL `errors` array with 200 status | Partial success, field-level access diff | Query each field individually |
| `Content-Length: 0` on POST success | Created but empty — may not verify ownership | Try alternative methods on created resource |

## Output schema (fill before handing to build)
```yaml
scope: | technology_stack: [] | archetype_hypotheses: [] | assets: [] | actors: []
permissions: [] | workflows: [] | trust_boundaries: [] | state_changes: []
sibling_endpoints: [{path, auth_required, data_exposed}]
opportunities: [{surface, score, reasons}]
hypotheses: [{workflow, assumption, break_test, expected_evidence}]
task_graph: [] | stop_conditions: []
```
Unknown fields marked `unknown` with how to discover them.

## REFERENCE FILES
No reference files yet. Patterns documented inline above.
