---
name: web-22-csti
sequence: web-22
category: xss
domain: web
description: "Client-Side Template Injection (CSTI): Angular sandbox escape, Vue template injection, React dangerouslySetInnerHTML abuse, and client-side template engine (Handlebars/Mustache/Underscore) XSS. Distinguish from SSTI — template evaluated in browser, not server. Use when testing SPAs and JS-heavy apps."
wordlist_ref: "wordlists/web/web-56-csti/"
---

# Client-Side Template Injection (CSTI) — Web Offensive Methodology

## Quick Workflow

1. Identify template frameworks: Angular `{{ }}`, Vue `{{ }}`, React JSX, Handlebars `{{ }}`, Mustache
2. Inject template syntax where user input is reflected — if evaluated, CSTI confirmed
3. Escalate via sandbox escape (Angular) or prototype chain (Vue/React)

---

## Detection

### Generic Probes

```
{{7*7}}
{{7*'7'}}
{{constructor.constructor('alert(1)')()}}
```

If `{{7*7}}` renders as `49` → template execution confirmed.

### Per-Framework

| Framework | Detection | RCE |
|-----------|-----------|-----|
| Angular 1.x | `{{7*7}}` = `49` | `{{constructor.constructor('alert(1)')()}}` |
| Angular 2+ | `{{7*7}}` = `49` | Requires prototype pollution |
| Vue 2/3 | `{{7*7}}` = `49` | `{{this.constructor.constructor('alert(1)')()}}` |
| React | JSX injection via props | `dangerouslySetInnerHTML` |
| Handlebars | `{{7*7}}` | `{{#with "s"}}...{{/with}}` chain |
| Mustache | `{{7*7}}` | Limited — no helpers |
| Underscore | `<%= 7*7 %>` = `49` | `<%= global.process.mainModule... %>` |
| EJS client | `<%=7*7%>` = `49` | `<%= global.process... %>` |

---

## Chaining

CSTI rarely gives direct RCE (different from SSTI). Common escalations:
- **Angular sandbox escape** → arbitrary JS execution
- **Prototype pollution + Vue** → pollute options → template injection → XSS
- **Handlebars unsafe helpers** → `require('child_process')` in Node context

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

**Wordlist**: `wordlists/web/web-56-csti/`

**Files**:
- `wordlists/web/web-56-csti/payloads/ssti/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- PortSwigger CSTI research
- Angular Sandbox Escapes (2013-2023 history)
- CVE-2024-23362 (Vue template injection)
