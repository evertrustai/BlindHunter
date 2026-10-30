---
name: api-17-websocket
sequence: api-17
category: protocol
domain: api
description: "WebSocket API security testing: missing Origin validation, CSWSH, message tampering, auth bypass via WS upgrade, subscription IDOR, and rate-limit bypass over persistent connections."
wordlist_ref: "wordlists/web/web-19-websocket/"
---

# WebSocket — API Offensive Methodology

## Quick Workflow

1. Identify WebSocket endpoints (wss:// in page source, ws:// in HAR, socket.io path)
2. Test Origin header validation during handshake
3. Test per-message authorization (not just at connection time)
4. Manipulate message IDs for subscription IDOR
5. Test WS rate limiting vs HTTP rate limiting

---

## Detection

### Handshake Origin Bypass

```http
GET /ws HTTP/1.1
Host: target.com
Origin: https://attacker.com
Upgrade: websocket
Connection: Upgrade
```

If server accepts → CSWSH (Cross-Site WebSocket Hijacking)

### Message ID Tampering

```json
// Subscribe to another user's stream
{"action": "subscribe", "channel": "user-orders", "userId": 456}
```

### Auth Token Bypass

```json
// Token only checked at connection, not per message
{"action": "admin:deleteUser", "userId": 123}
```




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

