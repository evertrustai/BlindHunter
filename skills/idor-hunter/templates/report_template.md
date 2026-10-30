# <IMPACT-FIRST TITLE — what the attacker achieves, on what scope>

Examples of good titles:
- *Cross-tenant IDOR on /orders/{id}/edit exposes attendee PII for every Eventcube event*
- *Authenticated low-priv user can read any GraphQL `invoice` by ID, dumping the customer ledger*
- *JWT `sub` claim swap on /api/refresh issues access tokens for arbitrary users (ATO)*

## Summary
<2-3 sentences. Lead with impact. Don't open with the technique.>

## Severity
CVSS 3.1: `<vector>` → `<score>` (`<P1 or P2>`)

Multi-tenant cross-boundary IDORs almost always include `S:C` (scope changed).
PII-at-scale brings `C:H`. The classic vector for a read-side cross-tenant
IDOR with bulk PII is `AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:L/A:N` → 8.5.

## Affected assets
- `<base URL>`
- `<endpoint(s) affected>`
- Auth required: `<none / authenticated low-priv / specific role>`

## Test accounts used
(Document if engagement-provided. Skip if BBP self-signup.)
| | Email | Tenant/User ID | Owned resource ID |
|--|--|--|--|
| A1 | … | … | … |
| A2 | … | … | … |

## Reproduction (exact, verbatim, replayable)

### Step 1 — Confirm the top-level guard works
```
<command 1>
→ HTTP <status> (<bytes>) — Laravel/Express/<framework> 403 page
```

### Step 2 — Sub-route / variant request returns the foreign record
```
<command 2 — the IDOR>
→ HTTP 200 (<bytes>)
```

### Step 3 — Decode the response to prove foreign data
```
<decoded snippet from the response showing fields that belong to the OTHER
tenant — different email, different name, different order number, etc.>
```

### Step 4 — Reverse direction
```
<same request from Account 2 against Account 1's resource>
→ HTTP 200 (<bytes>)
```
Confirms the bug is not "Account 1 is secretly admin".

### Step 5 — Negative control
```
<a sibling sub-route that returns 403>
→ HTTP 403
```
Confirms the session is valid and authorization works elsewhere; only
the affected sub-route is unscoped.

## Impact

Concrete, quantified:
- **PII fields exposed per record**: `<list every field>`.
- **Record count addressable**: `<enumeration cost — sequential IDs, observed max ID>`.
- **Tenant count**: `<how many businesses affected>`.
- **Regulatory exposure**: `<GDPR Art 32 / CCPA / HIPAA — only invoke when applicable>`.

If you've quantified enumeration with real probes (with authorization),
include a CSV link.

## Root cause

Name the specific developer assumption that broke, and the framework
mechanism that enabled it. E.g.:

> Filament's `EditRecord::resolveRecord()` calls
> `static::getResource()::getEloquentQuery()->find($key)` where `$key`
> comes from the route parameter `{record}`. The Resource's
> `getEloquentQuery()` was not overridden to constrain by `store_id`,
> so model resolution succeeds for any ID before any policy check runs.

## Chain (if chained)
- IDOR read → enumerate IDs → quantify PII at scale
- IDOR read → find admin email → password-reset → ATO
- IDOR read → find webhook secret → forge webhook → state change
- IDOR read → write counterpart on same route family → modification

State the chain in arrows; show proof for each link from the repro above.

## Suggested fix

Be specific. Bad: "validate authorization". Good:

> Add a global scope to `App\Models\Order`:
> ```php
> protected static function booted(): void {
>     static::addGlobalScope('store', function (Builder $b) {
>         if (auth()->check() && auth()->user()->current_store_id) {
>             $b->where('store_id', auth()->user()->current_store_id);
>         }
>     });
> }
> ```
> This makes `Order::find($id)` return null for foreign records, so
> Filament's `resolveRecord` naturally produces a 404.

Then ask them to audit every Resource for the same defect — multi-tenant
scoping is rarely missing in one place and correct everywhere else.

## Researcher notes / out-of-scope observations
- Things you noticed but didn't test (e.g., the matching write endpoint).
- Pre-existing test artifacts you saw (other researchers' Burp Collaborator
  payloads in stored fields can prove the bug class has been probed before
  but not fixed).
- WAF/CAPTCHA observations — the WAF slows but does not stop the bug.
