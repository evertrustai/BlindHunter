---
name: api-25-distributed-race
sequence: api-25
category: misc
domain: api
description: "Distributed API race conditions: HTTP/2 single-packet attack, cross-endpoint TOCTOU, parallel write contention, rate-limit race bypass, and multi-step workflow races across microservices."
wordlist_ref: "wordlists/api/api-33-distributed-race/"
---

# Distributed Race Conditions — API Offensive Methodology

## Quick Workflow

1. Identify operations with read-then-write patterns (balance check, inventory check)
2. Send N parallel requests via HTTP/2 single-packet attack
3. If multiple requests pass the check before any write completes → race confirmed
4. Escalate: double-spend, coupon stacking, inventory oversell

---

## Detection

### Coupon/Refund Race

```http
# HTTP/2 single-packet: 20 parallel POST /api/orders/123/refund
# If 2+ succeed, refund executed multiple times
```

### MFA Race

```http
# Submit 50 OTP guesses in parallel before lockout counter writes
```

### Balance Race

```http
# Check balance → withdraw → check balance → withdraw (raced)
# Read-balance returns same value for both checks
```

---

## Tools

- Burp Repeater — HTTP/2 single-packet attack
- Turbo Intruder — `engine.queue(target, engine.table)` in parallel

---





## Hacker Mindset

**HTTP/2 single-packet attack is the tool.** Send 50 requests in parallel within a single TCP packet. The server processes them concurrently, before any lockout/balance-check writes to the database.

**Every one-shot action is a race target.** Coupon redemption, gift card use, withdrawal, vote, invite acceptance — if it's meant to happen once, race it.



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


## Bypass Techniques

| Filter/Block | Bypass |
|-------------|--------|
| WAF/Input validation | Encoding, case variation, alternative syntax |
| Rate limiting | IP rotation via X-Forwarded-For, HTTP/2 multiplex |
| Blacklist | Alternative syntax, polyglot payloads |
| Blacklist bypass | Unicode, double encoding, null bytes |

## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/api/api-33-distributed-race/`

**Files**:
- `wordlists/api/api-33-distributed-race/payloads/idor/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- James Kettle "Smashing the State Machine" (DEF CON 2023)
- CVE-2024-27316 (HTTP/2 race)
