# Reference — ID schemes and their enumeration cost

Knowing the ID scheme decides whether a single confirmed cross-tenant
read is "P3 — one record" or "P1 — every record on the platform".

## Sequential numeric (autoincrement)

`/orders/123`, `/orders/124`, …

- **Enumeration cost**: trivial — count up from 1.
- **Visibility**: usually full — every successful request returns the
  whole record.
- **Risk**: Maximum. Any confirmed cross-tenant or auth-bypass on a
  sequential-ID endpoint is an immediate P1 at PII-bulk scale.

## UUID v4 (random)

`/orders/4f8d2e7c-3a9b-4ef1-9c2d-1e7b8a4f0c5a`

- **Enumeration cost**: infeasible (2^122 entropy).
- **Visibility**: usually doesn't matter — you can't get IDs to probe.
- **Risk**: Lower in isolation. Becomes P1 when paired with an
  ID-leakage path: e.g., a list endpoint that dumps all UUIDs, a search
  endpoint that returns IDs, an email-link with the UUID, a referrer
  leak, or a public index page that pulls UUIDs into the HTML.

## UUID v1 / TimeUUID (time-ordered)

`a1b2c3d4-5e6f-11ed-9abc-0242ac120002`

- **Enumeration cost**: low-to-moderate. The first 60 bits encode
  timestamp (100ns since 1582-10-15); the MAC address is partly fixed
  per server. Adjacent records have predictable UUIDs.
- **Tools**: `uuidtools.com`, manual time-range guessing.
- **Risk**: Treat as semi-sequential. If you have one UUID for a
  reference timestamp, you can guess neighbors.

## ULID / KSUID / Snowflake

`01ARZ3NDEKTSV4RRFFQ69G5FAV` (ULID), `1FZ8C0KYbZf...` (KSUID),
`1418715187471650816` (Snowflake int64)

- **Enumeration cost**: moderate. All are time-sortable. Suffix entropy
  varies (ULID has 80 random bits, KSUID has 128, Snowflake has 12).
- **Risk**: ULID/KSUID enumeration over a small time window is
  feasible if you can probe fast (which the WAF usually prevents).
  Snowflake is enumerable if the worker-id + sequence-id fields are
  fixed per shard.

## Base62 / Base36 short tokens (Stripe / GitHub style)

`order_1Nz5fY2eZvKYlo2C`, `tok_3MhU6F2eZvKYlo2C`

- **Enumeration cost**: depends on length. 8-char base62 = 218 trillion
  combos — infeasible. 4-char = 14M — feasible. Stripe-shape (16+ chars
  after prefix) = infeasible.
- **Risk**: Like UUID v4. Look for ID-leakage paths.

## HMAC-signed token

`v1.{user_id}.{exp}.{hmac}` — only valid if the HMAC validates against
the server secret.

- **Enumeration cost**: infeasible unless the secret leaks.
- **Forgery cost**: trivial once the secret is recovered (JS bundle,
  sourcemap, env disclosure).
- **Risk**: Maximum if the secret leaks. Audit the JS bundle for any
  string that looks like `HMAC`, `secret`, `key=`, `appKey`.

## "Predictable random" — common implementation bugs

- `Math.random()` seeded with current ms — recoverable.
- `crypto.randomUUID()` — fine, ignore.
- `Math.floor(Math.random() * 1e16)` — only ~15 bits of entropy in
  practice on V8.
- Hash of (userId + timestamp) with short truncation — recoverable.
- Counter mod prime — recoverable with two adjacent samples.

## Decision: do I bother enumerating?

| Scheme | Enumerate? | When |
|---|---|---|
| Sequential integer | Yes | Always (cheap, big payoff) |
| UUID v1 | Maybe | If target time window is known |
| ULID / KSUID | Maybe | If you can capture two adjacent IDs |
| Snowflake | Maybe | If worker-id is leaked |
| UUID v4 | No | Unless IDs are listed somewhere |
| Base62 ≥8 char | No | Unless IDs are listed somewhere |
| HMAC-signed | No | Unless secret leaks |

For "Yes / Maybe" schemes, your report should include an
enumeration-impact paragraph quantifying records reachable. For "No"
schemes, focus on chaining the IDOR to an ID-leakage path or to an ATO
primitive.
