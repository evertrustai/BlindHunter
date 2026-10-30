# XSS Report Template

```markdown
**Title:** [Reflected/Stored/DOM/Blind] XSS in [endpoint] via [parameter/input]

**Severity:** [Critical/High/Medium/Low] — [CVSS Score]

**Summary:**
A [Reflected/Stored/DOM/Blind] Cross-Site Scripting (XSS) vulnerability exists
in [URL] through the [parameter/input] vector. An unauthenticated attacker can
inject arbitrary JavaScript that executes in the context of the victim's
browser session, leading to session theft, account takeover, data exfiltration,
and further attacks.

---

**Steps to Reproduce:**

1. Navigate to the vulnerable endpoint:
   [URL with probe]

2. Observe that the probe input is reflected [in context] without proper
   sanitization or encoding.

3. Inject the XSS payload:
   [URL with XSS payload]

4. Observe JavaScript execution — [alert box / callback received / DOM changes]

---

**Proof of Concept:**

[Base64-encoded PoC URL, or screenshot, or video]

PoC URL:
```
https://target.com/vuln?param=<img src=x onerror=alert(document.domain)>
```

Blind XSS callback evidence:
```
[Interactsh/xss.report screenshot showing callback with cookie]
```

---

**Impact:**

An attacker exploiting this vulnerability can:
- Steal session cookies and hijack authenticated sessions
- Redirect users to malicious/phishing pages
- Perform actions on behalf of the victim (CSRF + XSS chain)
- Steal sensitive data displayed on the page
- Deploy keyloggers or credential harvesters
- [Stored XSS] Infect the page persistently for all visitors
- [Blind XSS] Compromise admin/support accounts accessing the affected panel

---

**Affected Components:**

| Component | Detail |
|-----------|--------|
| Endpoint URL | https://target.com/vuln |
| Vulnerable Parameter | [param] |
| Input Method | GET/POST/Header/Upload |
| Payload | <img src=x onerror=alert(document.domain)> |
| Payload Type | HTML body / Attribute / JS / DOM / SVG |
| Authentication Required | Yes/No |
| User Interaction Required | Yes/No |

---

**Technical Analysis:**

The application takes user input from [source] and injects it into [context]
without proper encoding. Specifically:

1. Input is received via [parameter/method]
2. Input is reflected at [location in response]
3. No sanitization, encoding, or CSP prevents script execution
4. [If bypassed WAF/CSP: The bypass method used was...]

---

**Evidence of Execution:**

- [ ] Alert dialog confirmed in browser
- [ ] Callback received on external server
- [ ] DOM mutation confirmed
- [ ] Cookie/data exfiltrated

---

**Remediation Recommendation:**

- Context-aware output encoding: Use appropriate encoding for the injection
  context (HTML entity, JS Unicode, URL encoding, CSS encoding)
- Input validation: Reject or sanitize input containing HTML/JS syntax
- Content Security Policy: Implement a strict CSP with nonce-based script
  loading to mitigate impact
- Use a sanitization library like DOMPurify for rich text input
- Apply HttpOnly and Secure flags to session cookies

---

**References:**
- OWASP XSS Prevention Cheat Sheet
- PortSwigger XSS Cheat Sheet
- OWASP DOM XSS Prevention Sheet
- [Any CVE or advisory links]
```
