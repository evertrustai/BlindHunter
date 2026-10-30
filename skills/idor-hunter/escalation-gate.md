# Phase 7 — IDOR Escalation Gate

Run silently before writing a single line of report. One weak answer = do
not submit; loop back to Phase 5.

## Q1. Is this a single read of one record, or a chained primitive?

A single cross-tenant read of one record is **not** a P1. The chain options:

- **Enumeration** — IDs sequential? walk the range, prove PII-at-scale.
- **Write counterpart** — same route family usually has a POST/PUT/PATCH
  with the same authorization gap. Test it (even read-only engagements
  should at least confirm the write endpoint *exists* and document the
  expected blast radius).
- **Adjacent records** — one order leaks; what about invoices, customers,
  payouts, refunds, tickets, support tickets, attachments?

## Q2. Can this read identify an admin/owner identifier for ATO?

The classic chain:
```
IDOR read → harvest admin email → password-reset → ATO
IDOR read → harvest API key on user → use against admin endpoint → ATO
IDOR read → harvest webhook secret → forge inbound webhook → account state change
```
If yes, you have an ATO chain — pivot the report to lead with ATO.

## Q3. How wide is the leak? Quantify.

Required answers:
- **Record count** — order IDs at 2.5M+? user IDs at 50k+? Cite the
  observed max ID.
- **PII surface** — per-record fields exposed. List them (email, name,
  phone, postal address, payment metadata, etc.).
- **Tenant count** — if the ID range crosses tenants, estimate how many
  customers/businesses are impacted.

A leak of email-only across 10k users is different impact from name +
address + phone + DOB across 2M users. Be explicit.

## Q4. Can this reach money / auth / cloud?

- Order/invoice IDOR → payment metadata → Stripe customer IDs → can be
  pivoted in some products to read payment history.
- Webhook secret IDOR → forge webhook → trigger refund/state change.
- API key IDOR → cloud key in some products → cloud takeover.
- SSO connection metadata IDOR → SAML/IDP federation tampering.

If yes, your finding is no longer "just IDOR" — restage the report
around the deeper primitive.

## Q5. Tenant boundary impact

Multi-tenant SaaS: a single cross-tenant IDOR puts the *whole platform*
at risk. State that:
- "The defect exists at the framework layer (Filament Resource scoping)
  — every Resource in the admin is suspect."
- "Sequential global order IDs mean a single account can enumerate the
  attendee base of every event hosted on the platform."

## Q6. What developer assumption broke?

A good report names the assumption, not just the symptom. Examples:
- "Filament `Resource::resolveRecord()` loads by route-param `{id}` before
  `getEloquentQuery()` policy applies."
- "Express `req.params.id` passed directly to `Order.findById()` without
  `where: { tenantId: req.user.tenantId }`."
- "GraphQL nested resolver assumes the parent resolver authorized the
  whole subtree."
- "JWT `sub` claim trusted as model key for `User.find(token.sub)` —
  unvalidated against the verified principal."

If you can't name it, you don't yet understand the bug — go read the
framework's source.

## Q7. Would a Tier-1 triager mark this < P3?

Honest read. If maybe:
- Cross-tenant + PII + enumerable IDs = P1 (~$2k–$15k common range).
- Cross-tenant + metadata only (no PII) = P2.
- Same-tenant horizontal + sensitive fields = P2.
- Same-tenant horizontal + trivial fields = P3 (skip or chain).
- BFLA on financial action (refund/payout/credit) = P1.
- BFLA on non-financial admin function = P2.

If you can't justify ≥P2 confidently, hold the report and loop Phase 5.

## Decision matrix

```
                Cross-tenant       Cross-user same-tenant
PII at scale       P1                    P2
Money/auth         P1                    P1 (BFLA territory)
Metadata           P2                    P3 (kill or chain)
Stateless info     P3 (kill)             P3 (kill)
```
