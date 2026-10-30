# Playbook — JWT-Claim IDOR

When the application reads the user-bound model from a JWT claim
(`sub`, `uid`, `userId`, `user_id`, `account_id`) **without** verifying
that the claim matches the verified principal, you have IDOR-at-auth.

## Recipe

1. **Get your JWT** — usually `Authorization: Bearer <jwt>`. Decode header
   and payload (it's just base64).
2. **Identify your "self" claim** — typically `sub` or `uid`. Note the
   value.
3. **Identify foreign IDs** — from any leakage path. Even `/api/users/<id>`
   returning 403 confirms the ID exists.
4. **Forge attempts (in order of effort)**:
   - Edit the `sub` claim to a foreign value; if alg is `none` or
     `HS256` and the secret leaks, re-sign.
   - Algorithm confusion: change `alg` from `RS256` to `HS256` and sign
     with the RSA public key bytes as the HMAC secret.
   - `kid` injection: set `kid` header to a path-traversal or a
     SQLi-controlled key.
   - `jku` / `jwks` header injection: point to an attacker-controlled
     JWKS URL.
5. **Replay** the forged token against a "me" endpoint
   (`/api/me`, `/api/account`, `/api/user/profile`). If the endpoint
   returns the **foreign user's** profile, you have ATO via JWT-IDOR.

## Service-to-service trust hops

In microservice architectures, the front-door gateway validates the JWT
and forwards a *new* internal header (`X-User-Id`, `X-Account-Id`) to
backend services. Backend services then trust that header.

Bug: if the gateway forwards `X-User-Id` from the request when no JWT
is present (or for "internal" routes), an attacker who reaches a
backend service directly (via SSRF, exposed internal LB, or a missing
gateway rule) can spoof any user.

## "Refresh-token IDOR"

Some apps issue refresh tokens that just contain `{sub}` and re-issue
access tokens. If `POST /auth/refresh` accepts `{"sub": "<foreign>"}`
in the body (because the dev built it as a JSON RPC), you get a new
access token for the foreign user.

## What makes this **always P1**

JWT-IDOR is always P1 because:
- It's not record-level — it's identity-level.
- One bug = ATO for every user.
- No enumeration needed beyond knowing one foreign user exists.
- Often paired with admin-claim manipulation for full admin takeover.

## Don't forget refresh-token rotation gaps

If the app issues `{access_token, refresh_token}` and the refresh token
itself is bound only to `sub` (not to a server-side session record), then
rotating doesn't help — the new tokens still serialize whatever `sub`
they were called with.
