# Playbook — GraphQL BOLA / Field-Level Authz

## Recon

1. **Find the endpoint** — usually `/graphql`, `/api/graphql`, `/query`,
   `/v1/graphql`. Some apps proxy through a Next.js/Nuxt `/api/...` route.
2. **Introspection** — POST the standard introspection query. If disabled,
   try GET with `?query=` (some servers gate POST-introspection but not
   GET). Also try **field-suggestion leakage**: send a typo'd field and
   read the `Did you mean ...` suggestions to map the schema piece by
   piece.
3. **Persisted-query bypass** — if the prod app uses persisted query IDs
   (Apollo), try sending a raw inline query — many proxies only
   allow-list IDs but the backend still accepts inline.

## BOLA hypotheses

For every `Query` or `Mutation` field that takes an `id` / `objectId` /
`recordId` / `uuid` / `slug` argument:

- **Direct ID swap** — call it with a foreign ID. Same as REST IDOR.
- **Alias-batched scan** — many BOLA checks are per-request rate-limited
  but not per-alias:
  ```graphql
  query Sweep {
    a: order(id: "1") { customerEmail }
    b: order(id: "2") { customerEmail }
    c: order(id: "3") { customerEmail }
    # ...100 aliases at once
  }
  ```
- **Array-batched** — `POST [{query:...}, {query:...}, ...]` (JSON array
  body) bypasses some per-request authz middleware.

## Nested-resolver auth gap (the GraphQL classic)

Top-level resolvers usually check auth. **Nested resolvers often don't.**
The pattern:
```graphql
query {
  viewer {                  # ← top-level: authorized to current user
    organization {          # ← scoped to viewer's org
      otherUsers {          # ← nested: enumerates all users in org…
        email                #     …WITHOUT checking caller's role
        privateNotes         # ← admin-only field, exposed via nested resolver
      }
    }
  }
}
```

Recipe:
1. Find every `connection`/`edges`/`list` field in the schema.
2. For each, drill into it from a context you legitimately have access to.
3. Look for fields on the nested type that should be hidden from your
   role (PII, secrets, admin-only metadata).

## Field-level authz gap

Some schemas guard top-level fields but expose admin data via a parent's
field:
```graphql
query {
  invoice(id: $myInvoiceId) {  # ← my invoice, authorized
    paymentMethod {             # ← payment method object…
      stripeCustomerId          #     …with cross-tenant Stripe info
      bankAccountLast4
    }
  }
}
```

## Input-type mass assignment

Mutation inputs are often a single `input` object — any extra fields
not enforced by the schema serializer get passed through:
```graphql
mutation {
  updateProfile(input: {
    name: "test",
    role: "admin",        # ← if accepted, BFLA via input mass assignment
    isAdmin: true,
    tenantId: "<foreign>"
  }) {
    user { id role }
  }
}
```

## Specific GraphQL servers — sharp edges

- **Hasura** — Row-level permissions are per-role; misconfigured
  `permission.filter` (e.g., `{}` instead of `{user_id: { _eq: X-Hasura-User-Id }}`)
  is the IDOR. Check `/v1/metadata` introspection if exposed.
- **Apollo Server** — `@auth` directive only works if applied at every
  field; many schemas only apply it at the resolver entry. Look for
  `dataloader` calls that pull objects unscoped.
- **Postgraphile** — Generated CRUD mutations (`updateUserByNodeId`) rely
  on Postgres row-level security. If RLS is off, every mutation is IDOR.
- **Graphene (Python)** — `DjangoObjectType` exposes every model field by
  default; without `fields = (...)` whitelist, sensitive fields leak.
- **Yoga / Mercurius / Strawberry** — same pattern of nested-resolver
  trust as Apollo.
