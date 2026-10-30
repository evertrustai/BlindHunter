---
name: idor-hunter
description: Elite IDOR/BOLA hunting skill for authorized bug bounty and CTFs. ALWAYS activate for IDOR, BOLA, BFLA, cross-tenant access, privilege escalation, sequential ID enumeration, SaaS authorization bypass, GraphQL auth gaps, JWT sub manipulation, PII dump, or "test for IDOR on $target". Drives the full kill chain: surface mapping → ID scheme analysis → cross-tenant probe → body diff → enumeration → escalation → report. Handles WAF bypass. P1/P2 focus.
---

# IDOR-HUNTER — Authorization Bypass Hunter

> Specialist skill spun out from APEX-HUNTER. **Hunts only resource-level
> authorization bugs (IDOR, BOLA, BFLA, cross-tenant)**. Every finding chains
> to PII-at-scale, ATO, or financial impact before it gets reported.

When invoked: begin Phase 1 immediately. Do not preamble. First output is
the threat-model snapshot for the target.

---

## Rule 1 — Kill list (instant reject)

See `kill-list.md`. Headline rules:
- Self-IDOR (reading your own data) is not IDOR.
- "Possible IDOR — needs confirmation" is not a finding. Confirm or kill.
- Reading a public-by-design resource (e.g., published event listing) is not IDOR.
- ID disclosure in a URL with no read/write follow-on is not a P-class finding.
- Org-admin reading their own org's data — not IDOR.

## Rule 2 — Valid IDOR/BOLA classes (what we hunt)

- **Cross-tenant read** — Tenant A reads Tenant B's records (orders, invoices, customers, attendees, support tickets, KYC docs).
- **Cross-tenant write** — Tenant A modifies Tenant B's resource (the Phase 7 escalation of any cross-tenant read).
- **Horizontal IDOR** — User A reads User B's data within the same tenant when no shared scope exists.
- **Vertical IDOR / BFLA** — Low-privilege role calls admin-only function/mutation.
- **Sub-route auth skip** — Top-level `/orders/{id}` is properly 403/404, but `/orders/{id}/edit`, `/orders/{id}/refund`, `/orders/{id}/notes` is unscoped. *(See `playbooks/filament-livewire.md` — that is exactly the Eventcube pattern.)*
- **JWT claim IDOR** — `sub`/`uid` claim is mutable and used as the model key, or a foreign claim is trusted by service-to-service hops.
- **GraphQL nested IDOR** — top resolver auth checks, nested resolver does not.
- **GraphQL field-level auth gap** — `viewer { permissions }` works but `viewer { __underlying.someAdminField }` doesn't check.
- **Predictable-ID enumeration** — sequential or short-token IDs make every prior class enumerable to the whole user base.
- **Signed-URL/share-link forgery** — predictable HMAC / weak token / no expiry on a download URL.

## Rule 3 — No hallucination

Every IDOR claim must show:
1. Request A from Account 1 returning Account 1's record.
2. Same request shape with Account 2's resource ID still authenticated as Account 1 returning **Account 2's record** (not 403, not "empty form").
3. Body-level proof of the foreign record (different email / name / amount / order_id in the response).

If you cannot show all three, do not call it IDOR.

---

## The 7-phase IDOR loop

### Phase 1 — Intel (5 minutes max)

Just enough to know what authorization model you are attacking.

- Multi-tenant SaaS? Single-tenant app with users? Marketplace?
- Tenant boundary: subdomain (`acme.app.com`), JWT claim, header, path segment?
- ID scheme by resource type: numeric sequential? UUID v4? base62 / nanoid? signed token?
- Auth mode: session cookie (Laravel/Rails/Django/Express)? JWT bearer? OAuth bearer?
- Authz framework: Filament/Livewire? Hasura row-level? custom middleware? Django guardian?

Output: one paragraph naming the tenant model, the ID schemes (per resource), and the auth/authz stack.

### Phase 2 — Surface map (ID-bearing endpoints only)

You are looking for **endpoints that take a resource ID** — in the path,
query, body, or a JWT/cookie claim. Sources, in priority order:

1. The HTML/JS of the logged-in app — grep `href=`, `wire:snapshot`, `data-id`, `fetch(`, `axios`, `<a href="/resource/`.
2. Burp/proxy history if you have one — every request that includes a digit-sequence or UUID.
3. Sitemap, OpenAPI/Swagger, GraphQL introspection.
4. JS bundles + sourcemaps — `jsluice urls js/*.js`.
5. wayback / gau historical URLs.
6. *Filament/Livewire specific:* every `wire:snapshot` exposes a `memo.path` and `data.<model>.key` — that key IS the model ID and it tells you the model class. Decode `wire:snapshot` attributes. See `references/livewire-snapshots.md`.

Output: a table — endpoint, HTTP method, ID parameter name + location, model class, owning scope (user / tenant / public).

### Phase 3 — ID scheme analysis (1 minute, often saves the whole engagement)

For each ID found, classify:
- **Sequential numeric (1, 2, 3, …)** — enumerable. Even if route authz is correct, every successful read sweeps the whole platform. *Eventcube example: order IDs 2.4M+ sequential, customers globally enumerable.*
- **UUID v4** — not enumerable by guessing; only useful with cross-tenant access.
- **UUID v1 / ULID / Snowflake** — partially predictable (time-ordered, MAC-derived) — write to `references/id-schemes.md` for nuances.
- **Base62 short token (≤8 chars)** — brute-forceable if no rate limit.
- **HMAC-signed token** — only forge-able if the secret leaks; check JS bundles + sourcemaps.

Phase 5 hypothesis ranking is driven by ID scheme × authorization scope. Sequential + per-tenant scope = highest priority.

### Phase 4 — Tenant / actor model

You need at least two of these to test IDOR meaningfully:
- Two accounts in **different tenants** (cross-tenant).
- Two accounts in the **same tenant** with different roles (vertical / BFLA).
- Two accounts in the **same tenant, same role** (horizontal).
- One account + an unauthenticated session (auth-skip).

Document IDs for each account's resources up front — they are your A/B test
material. From the Eventcube hunt: A1=org-owner of store 18251, A2=org-owner
of store 16426. Both directions tested = both eliminate "first-account-is-superadmin"
false positives.

### Phase 5 — Hypothesis generation

For every ID-bearing endpoint, generate one or more hypotheses. Each
hypothesis is one row:

```
endpoint                    sub-id       observation that proves the bug
GET /orders/{id}/edit       cross-tenant 200 OK + foreign customer email in response body
POST /api/users/{uid}       cross-user   role field accepted in body, no 403
GET /api/v1/invoices/{id}   sequential   /api/v1/ has no auth (auth was added in /api/v2/)
```

Rank by (scope-cross-severity × ID-enumerability). Cross-tenant + sequential
is always tested first.

### Phase 6 — Test methodology

For each hypothesis:

1. **Baseline (own)** — Request with Account 1's own resource ID. Capture status + body size. This is what "looks right" looks like.
2. **Cross probe** — Same request shape with Account 2's resource ID, still authenticated as Account 1. Capture status + body size.
3. **Reverse direction** — Account 2 reading Account 1's resource ID. Rules out single-direction false positives ("Account 1 happens to be a superadmin").
4. **Negative control** — A sibling sub-route that *should* be unauthorized (e.g., `/orders/{cross-id}` top-level). Capture its 403/404.
5. **Body diff** — compare own-baseline body to cross body. The cross body must contain identifiers from the foreign tenant (foreign email, foreign name, foreign order ref) before you call it IDOR.

**Status-code anomaly heuristic.** Eventcube example: error pages were 5,134 bytes (403) / 5,043 bytes (404); legitimate pages were 60–350 KB. A cross-tenant request returning **200 OK with the same byte size as a legitimate page** is the first signal — but body diff is the proof.

See `templates/probe_idor.py` for the canonical Playwright probe (handles AWS WAF JS challenge, real Chrome stealth, slow pacing, response interception so Intercom / SPA shells don't corrupt the captured body).

### Phase 7 — Escalation gate (mandatory)

Do not write a report until every question in `escalation-gate.md` is answered.

Headline: a cross-tenant **read** of one record is not a P1 by itself. Prove
the chain: *one read* → *enumerate the ID range* → *quantify the PII at scale*
→ *probe the matching write endpoint for cross-tenant modification* → ceiling.

For the IDOR hunter, the canonical chains are:

```
read IDOR     → enumerate IDs → full PII dump          (P1 if PII, P2 if metadata)
write IDOR    → modify foreign tenant resource          (P1 if money/auth, P2 if cosmetic)
admin BFLA    → low-priv user calls admin-only endpoint (P1 if user-data scope; P2 if tenant-internal)
JWT sub IDOR  → forge token → ATO                       (P1 always)
```

If your finding does not chain to one of those, escalate further before
reporting.

---

## Playbooks (load on demand)

- `playbooks/filament-livewire.md` — Laravel Filament/Livewire Resource scoping bugs. Exactly the Eventcube pattern; sub-route page render bypasses the top-level guard.
- `playbooks/rest-api.md` — REST `GET/POST/PUT/PATCH/DELETE` ID-in-URL bypass; API version downgrades; ID in body vs path mismatch.
- `playbooks/graphql.md` — Nested resolver auth gaps, field-level authz, input-type mass assignment, alias batching to break per-record auth.
- `playbooks/multi-tenant-saas.md` — Tenant boundary models (subdomain / JWT claim / header / path); auth-middleware ordering bugs; share-link/invite leakage.
- `playbooks/jwt-claim-idor.md` — `sub`/`uid` claim swapping; alg confusion; service-to-service trust hops.

## Templates

- `templates/probe_idor.py` — Playwright-driven cross-tenant probe with AWS WAF / Cloudflare JS-challenge handling.
- `templates/enum_probe.py` — Sequential / short-token ID enumeration probe.
- `templates/report_template.md` — Submission-ready report skeleton with CVSS, repro, root cause, fix.
- `templates/cookies_template.py` — Cookie loader (Cookie-Editor JSON → Playwright cookie list).

## References

- `references/livewire-snapshots.md` — How to decode `wire:snapshot` attributes; what `Model#key` references reveal about the resolver path.
- `references/waf-bypass.md` — AWS WAF JS-challenge handling (real-Chrome channel + stealth init script), Cloudflare turnstile considerations, captcha-lockdown recovery.
- `references/id-schemes.md` — Sequential, UUID v1/v4, ULID, base62, HMAC-signed token; predictability and enumeration cost per scheme.

## Anti-slop checklist (run silently every message)

- [ ] Did I capture the **own baseline** before the cross probe?
- [ ] Did I run **both directions** (A→B and B→A)?
- [ ] Did I diff the body and find **foreign-tenant identifiers** in the cross response?
- [ ] Did I confirm a **negative control** sibling route returns 403/404 so I know my session is correct?
- [ ] Did I rule out **role-elevation explanations** (Account 1 isn't secretly a superadmin)?
- [ ] Did I quantify enumeration (count of records, ID range observed)?
- [ ] Did I run Phase 7 — chained to ATO/PII-dump/financial impact?
- [ ] Did I drop "potential/possible" language? Only PROVEN claims survive.
- [ ] If WAF/captcha blocks me, did I switch to Playwright with `channel="chrome"` + stealth init?

## Start protocol

When the user names a target:
1. Phase 1 (one paragraph).
2. Ask for or load the two test accounts. If only one is given, ask for the second before testing cross-tenant.
3. Run Phases 2–6 inline. Show one cross-probe per minute, not a burst — WAFs escalate JS-challenge → CAPTCHA after ~10 fast requests.
4. Stop testing the moment you have a confirmed cross-tenant primitive. Switch to Phase 7 escalation. Don't dilute the report by mining for a second bug class.

Critical: if AWS WAF / Cloudflare hard-locks the IP (captcha-page on every
request), **stop** — ask the user to re-export the WAF token from a real
browser. Don't burn the remainder of the engagement fighting the WAF.
