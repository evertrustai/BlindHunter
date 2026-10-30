# Playbook — Multi-Tenant SaaS Authorization

## Identify the tenant boundary

The tenant is usually one of:
- **Subdomain** — `acme.app.com`. Tenant resolved from `Host:` header.
- **Path segment** — `app.com/orgs/acme/...`. Tenant from URL.
- **JWT claim** — `{"tenant_id": "acme"}` in the access token.
- **Session-bound** — Cookie session has `tenant_id`; never appears in
  request shape.
- **Header** — `X-Tenant-Id: acme` (rare on user-facing; common on B2B
  APIs).

## The most common bug: tenant boundary mismatch

Two parts of the stack use different sources of truth:

| Layer | Source of truth |
|---|---|
| Frontend SPA | URL subdomain → injects into request body |
| API middleware | JWT claim |
| Database query | `WHERE tenant_id = $1` where `$1` comes from… body? |

If the API middleware reads tenant from JWT, but the ORM query reads
tenant from request body, you can pass a JWT for tenant A and a body
with `tenant_id: B` and read tenant B's data.

## Test recipe

1. **Map all tenant-bearing parameters** — subdomain, path, body field,
   header, JWT claim.
2. **Mismatch probe** — for each request, change *only* the tenant in the
   body/header (keep JWT/session as own). Observe response.
3. **JWT-only probe** — strip body tenant, see if request still works
   with just session.
4. **JWT-tampering** — if JWT is HS256/RS256, decode and look at the
   tenant claim. Try alg-confusion / `none` / `kid` injection (separate
   bug class but often coincident in mistuned JWT setups).

## Sharp edges per tenant pattern

### Subdomain-tenanted apps
- `Host: acme.app.com` vs `Host: bob.app.com` — does the API trust the
  Host header even when the session was issued for a different tenant?
- Stale cookies — if you authenticate at `acme.app.com` then send cookies
  to `bob.app.com`, are they `Domain=.app.com` and accepted?
- Cross-subdomain CSRF — if any tenant's UI can issue requests to any
  tenant's API.

### Path-tenanted apps (`/orgs/{slug}/...`)
- Are the org-slug-to-id translations cached? Some apps resolve the slug
  in middleware to an `org_id`, then use the `org_id` in queries — if you
  swap the slug after middleware ran, the cached resolution is stale.
- Tenancy enforced at controller level but not at job-queue / async-task
  level. A scheduled export job triggered from `/orgs/A/...` may run with
  no tenant context and dump all orgs.

### JWT-tenanted apps
- Same JWT valid across tenants because `iss`/`aud` don't pin to a tenant.
- "Switch tenant" endpoint that issues a new JWT — does it verify the
  caller is a member of the target tenant?
- Tenant claim editable via "profile update" endpoint (mass assignment).

## Invitation / share-link IDOR

The invite/share-link flow is fertile ground:
- Invite token → predictable, brute-forceable, or leaked in referrer headers?
- Accept-invite endpoint — does it bind the invite to the accepting user,
  or just consume the token globally?
- Can an invite be reused after the inviter removes the user?
- Role specified in the invite — can the accepting user modify it before
  accept (e.g., body `{"role": "admin"}` in the accept POST)?
- Share-link to a single resource — predictable token format? expiry
  enforced server-side?

## Cross-tenant primitive promotion

Once you have one cross-tenant read on one resource, the next 30 minutes:
1. Pull the framework's docs for the scoping pattern (Laravel global
   scope, Rails default scope, Django manager, Sequelize hooks).
2. Search the JS bundle for `<framework>` or `<authorization-package>`
   references — confirms the pattern in use.
3. Hypothesize that every other Resource/Model on the platform has the
   same scoping pattern (or lack of it). Probe one or two extras to
   confirm — report in one bundle.
