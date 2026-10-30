---

name: web-36-waf-bypass
sequence: web-36
category: misc
domain: web
description: "WAF bypass testing: IP restriction bypass, header manipulation, encoding/obfuscation, HTTP verb tampering, parameter pollution, and rate-limit bypass. Use when testing targets protected by Web Application Firewalls."
wordlist_ref: "wordlists/web/web-41-sspp/"
---

# SKILL: WAF Bypass Techniques

## Metadata
- **Skill Name**: waf-bypass
- **Folder**: offensive-waf-bypass
- 
-WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="<script>alert(1)</script>"
# Payload in filename field (often not heavily weighted)

# 5. Context Confusion: Mix attack vectors
# Combine SQL injection syntax with XSS to confuse classifiers
'><script>alert(1)</script>' UNION SELECT 1--
```

**Tools:**

- `ml-waf-evasion-toolkit` (2024) - Research tool for testing ML WAF robustness
- `adversarial-payload-generator` - Generates adversarial examples against WAF classifiers

## Recommended Tools

### WAF Fingerprinting Tools

- **WAFW00F** - The ultimate WAF fingerprinting tool with the largest fingerprint database
- **IdentYwaf** - A blind WAF detection tool using unique fingerprinting methods
- **Ja3er/ja4plus** - TLS fingerprint analysis and spoofing helpers

### WAF Testing Tools

- **GoTestWAF** - Tests WAF detection logic and bypasses
- **Lightbulb Framework** - Python-based WAF testing suite
- **WAFBench** - WAF performance testing suite by Microsoft
- **Framework for Testing WAFs (FTW)** - Rigorous testing framework for WAF rules
- **WAF Testing Framework** - Testing tool by Imperva
- **graphql‑cop** – Fuzzer for GraphQL APIs with WAF bypass testing
- **GoReplay/Mitmproxy** – record & replay traffic through different network paths to compare WAF decisions

### WAF Evasion Tools

- **WAFNinja** - Fuzzes and suggests bypasses for WAFs
- **WAFTester** - Tool to obfuscate payloads
- **libinjection-fuzzer** - Fuzzer for finding libinjection bypasses
- **bypass-firewalls-by-DNS-history** - Uses old DNS records to find origin servers
- **abuse-ssl-bypass-waf** - Finds supported SSL/TLS ciphers for WAF evasion
- **SQLMap Tamper Scripts** - Obfuscates SQL payloads to evade WAFs
- **Bypass WAF BurpSuite Plugin** - Adds headers to make requests appear internal
- **enumXFF** - Enumerates IPs in X-Forwarded-Headers to bypass restrictions
- **WAF Bypass Tool** - Open source tool from Nemesida
- **noble‑tls / uTLS / tls-client** – spoof browser‑grade TLS stacks programmatically

## WAF Bypass Chaining

Combine multiple techniques for more effective bypassing:

1. Use residential proxies
2. Implement a fortified headless browser
3. Add human-like behavior simulation
4. Apply CAPTCHA bypass when needed
5. Avoid honeypot traps
6. Mix multiple encoding techniques
7. Exploit request parsing inconsistencies
8. Use ML-generated payloads that evade signature detection
9. Align TLS/JA3 with real browsers and switch to HTTP/3 where inspection is weaker
10. Pivot to origin when feasible; fall back to stealth browser automation with humanization




## Hacker Mindset

**WAFs block patterns, not meaning.** `SELECT` is blocked. `SeLeCt` isn't. The WAF sees different bytes; the database sees the same query.

**Rotate your attack surface.** A blocked IP? Rotate X-Forwarded-For. Blocked endpoint? Try /v2. Blocked Content-Type? Try XML instead of JSON.

**The WAF's parser is different from the backend's parser.** This is the fundamental vulnerability of all WAFs. Encoding, chunking, and protocol confusion all exploit parser differential.



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
| Signature-based WAF | Encoding, case variation, comment injection |
| Input validation | Alternative syntax, double encoding |
| Rate limiting | IP rotation via X-Forwarded-For |


## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/web/web-41-sspp/`

**Files**:
- `wordlists/web/web-41-sspp/payloads/nosql/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

