---
name: web-21-postmessage
sequence: web-21
category: xss
domain: web
description: "postMessage cross-origin messaging testing: missing origin validation in message event handler, arbitrary message injection, sensitive data leak via postMessage, and XSS via postMessage to eval/innerHTML sink. Use when testing SPAs and browser-based messaging."
wordlist_ref: "wordlists/web/web-60-postmessage-injection/"
---

# postMessage — Web Offensive Methodology

## Quick Workflow

1. Find `window.addEventListener('message', ...)` handlers in JS source
2. Check if origin is validated (event.origin === 'https://target.com')
3. If no origin check or wildcard: craft cross-origin iframe that sends malicious messages
4. If handler sinks to `innerHTML`, `eval()`, `location =`, or URL fetch → XSS

---

## Detection

### Search for Vulnerable Patterns

```javascript
// Vulnerable — no origin check
window.addEventListener('message', function(e) {
  document.getElementById('content').innerHTML = e.data;
});

// Vulnerable — weak check
window.addEventListener('message', function(e) {
  if (e.origin.indexOf('target.com') > -1) { ... } // bypass: attackertarget.com
});

// Safe
window.addEventListener('message', function(e) {
  if (e.origin !== 'https://target.com') return;
});
```

### Probes

```html
<iframe id="target" src="https://target.com"></iframe>
<script>
document.getElementById('target').contentWindow.postMessage(
  '{"cmd":"alert(1)"}',
  '*'
);
</script>
```

### Sinks to Test

| Sink | Impact |
|------|--------|
| `innerHTML` / `outerHTML` | DOM XSS |
| `eval()` / `Function()` | Code execution |
| `location =` / `href =` | Open redirect |
| `fetch()` / `XMLHttpRequest` | API call forge |
| `document.write()` | Page rewrite |
| `window.location.hash =` | Fragment manipulation |

---





## Hacker Mindset

**Look for the edge cases.** Vulnerabilities live in the gap between what the developer assumed and what the framework actually does. Test every boundary: empty values, nulls, arrays, negative numbers, Unicode, very long strings.

**Blind detection always needs OOB.** If you can't see the output, set up a callback. No OOB = no confirmation.

**Chaining turns low/med into critical.** A single path traversal is medium. Path traversal + log file + admin session = RCE. Always think about what comes next.



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

**Wordlist**: `wordlists/web/web-60-postmessage-injection/`

**Files**:
- `wordlists/web/web-60-postmessage-injection/payloads/xss/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- OWASP postMessage Security
- CVE-2023-44487 (cross-origin window messaging), CVE-2024-21890 (Slack postMessage)
