---
name: "Business Logic Vulnerabilities — Complete Deep Dive"
description: "Complete PortSwigger deep-dive with exact payloads for every lab variant including zero-day techniques"
domain: cybersecurity
subdomain: bug-hunting
version: "1.0.0"
category: "bug-hunting/deep-dive-labs"
tags: [portswigger, deep-dive, exploitation, zero-day, lab-solutions]
mitre_attack: ["T1190"]
tools: [burp-suite, curl, sqlmap, ffuf, python, hashcat, ysoserial]
difficulty: "advanced"
---

# Business Logic Vulnerabilities — Complete Deep Dive

> **Deep-Dive Lab Playbook** — Every PortSwigger lab variant with exact payloads,
> bypass techniques, and zero-day extensions. 🟢 Apprentice 🟡 Practitioner 🔴 Expert

## When to Use
- BSCP certification prep
- Real-world bug bounty hunting
- Building exploitation chains
- Understanding bypass techniques

## Prerequisites
- Burp Suite Professional
- Burp Collaborator / interactsh
- Browser with proxy configured


## Workflow
### Phase 1: Reconnaissance
- Identify input vectors, parameters, and application behavior.
### Phase 2: Exploitation
- Apply standard lab payloads.
### Phase 3: Zero-Day Escalation
- Fuzz filters, bypass WAFs, and chain with other vulns.

## Lab Playbooks

### Lab 1: Excessive client-side trust 🟢 APPRENTICE
Intercept purchase request, change `price=100` to `price=1`. Server trusts client-sent price.
---

### Lab 2: High-level logic vulnerability 🟡 PRACTITIONER
Set `quantity=-1` → negative total. Or quantity so high it wraps around (integer overflow) → price becomes negative.
---

### Lab 3: Inconsistent security controls 🟡 PRACTITIONER
Register with attacker email, then change email to `@dontwannacry.com` to get admin access.
---

### Lab 4: Flawed business rules 🟡 PRACTITIONER
Alternate between two coupon codes: NEWCUST5 → SIGNUP30 → NEWCUST5 → SIGNUP30. System only blocks consecutive duplicates.
---

### Lab 5: Low-level logic flaw 🟡 PRACTITIONER
Add quantity until price integer overflows past MAX_INT → wraps to negative. Add enough to bring total to small positive number.
---

### Lab 6: Exceptional input handling 🟡 PRACTITIONER
255+ char email: `attacker@verylongstring...dontwannacry.com` — email truncated to 255 chars, domain becomes `@dontwannacry.com`.
---

### Lab 7: Weak isolation on dual-use endpoint 🟡 PRACTITIONER
Password change endpoint: remove `current-password` parameter entirely. Server doesn't require it for admin functionality.
---

### Lab 8: Insufficient workflow validation 🟡 PRACTITIONER
After adding items, skip to order confirmation: `POST /cart/order-confirmation` without going through payment.
---

### Lab 9: Auth bypass flawed state machine 🟡 PRACTITIONER
Drop the role-selection request after login → default role = admin.
---

### Lab 10: Infinite money 🟡 PRACTITIONER
Buy gift card with discount code → redeem gift card → net positive → repeat with Burp macro/session handling rules.
---

### Lab 11: Auth bypass encryption oracle 🔴 EXPERT
Exploit padding oracle or encryption/decryption endpoint to forge admin session cookie.
---

### Lab 12: Email parsing discrepancies 🔴 EXPERT
```
attacker@dontwannacry.com%00@normal.com
```
Backend processes first email (before null byte), frontend validates second.
---


## Blue Team Detection
- Monitor access logs for anomalous payloads.
- Implement strict input validation and parameterized queries where applicable.
- Create WAF rules masking generic attack patterns.

## Zero-Day Research
When standard technique fails:
1. Identify the filter/WAF
2. Fuzz with Burp Intruder custom wordlists
3. Search GitHub/Twitter for new bypasses
4. Chain with other vulns for escalation
5. Try encoding variants: URL, double-URL, unicode, hex


## Key Concepts
| Concept | Description |
|---------|-------------|
| PortSwigger Vectors | Standardized approaches to vulnerability classes. |
| Payload Encoding | Modifying payloads to bypass basic string matching WAFs. |


## Output Format
```
Vulnerability Deep-Dive Report
==============================
Target Vector: [Endpoint]
Bypass Technique: [Explanation of bypass]
Payload Used: [Payload]
Impact Explanation: [Impact]
```

## 🔵 Blue Team
- Deploy robust WAF rules to detect anomalies.
- Monitor logs for unusual access patterns.

## 🛡️ Remediation & Mitigation Strategy
- **Input Validation:** Sanitize and strictly type-check all inputs.
- **Least Privilege:** Constrain component execution bounds.


## 📚 Shared Resources
> For cross-cutting methodology applicable to all vulnerability classes, see:
> - [`_shared/references/elite-chaining-strategy.md`](../_shared/references/elite-chaining-strategy.md) — Exploit chaining methodology and high-payout chain patterns
> - [`_shared/references/elite-report-writing.md`](../_shared/references/elite-report-writing.md) — HackerOne-optimized report writing, CWE quick reference
> - [`_shared/references/real-world-bounties.md`](../_shared/references/real-world-bounties.md) — Verified disclosed bounties by vulnerability class

## References
- [PortSwigger Labs](https://portswigger.net/web-security/all-labs)
- [PayloadsAllTheThings](https://github.com/swisskyrepo/PayloadsAllTheThings)
- [HackTricks](https://book.hacktricks.xyz/)
