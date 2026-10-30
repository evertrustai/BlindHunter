---
name: broken-object-level-authorization
description: >
  Identify and exploit Broken Object Level Authorization (BOLA), historically known as Insecure Direct Object Reference (IDOR),
  in API architectures. Extremely common and critical flaw where an API fails to validate whether the
  currently authenticated user actually owns or retains permissions over the specifically requested database resource (ID).
domain: cybersecurity
subdomain: bug-hunting
category: API Security
difficulty: beginner
estimated_time: "1-3 hours"
mitre_attack:
  tactics: [TA0001, TA0004, TA0005]
  techniques: [T1190, T1564]
platforms: [linux, windows]
tags: [bola, idor, authorization-bypass, api-security, bug-hunting, web-vulnerabilities]
tools: [burpsuite, autorize]
version: "1.0"
author: CyberSkills-Elite
license: Apache-2.0
---

# Broken Object Level Authorization (BOLA/IDOR)

## When to Use
- When engaging REST APIs executing actions utilizing user IDs, invoice numbers, or UUIDs in the URI path (e.g., `/api/users/12` or `/api/invoice/ABC-123`).
- When actions refer to object primary keys inside POST/PUT bodies or query parameters.
- It is the **#1 vulnerability** in APIs according to the OWASP Top 10 API Security Project. Always test this relentlessly.


## Prerequisites
- Authorized scope and target URLs from bug bounty program
- Burp Suite Professional (or Community) configured with browser proxy
- Familiarity with OWASP Top 10 and common web vulnerability classes
- SecLists wordlists for fuzzing and enumeration

## Workflow

### Phase 1: Identifying Resource Identifiers

```http
# Concept: We must find where the API relies on an identifier to fetch, update, or delete data.

# Look closely at endpoints generating 200 OK status codes:
GET /api/v1/receipts/904                   (Path variable)
POST /api/v1/messages?conversation_id=643  (Query parameter)
{"user_id": 99, "action": "delete"}        (JSON body)

# The Threat: If I am User 99, can I read User 100's data simply by typing '100'?
```

### Phase 2: Systematic Execution (Two-Account Testing)

```text
# Concept: NEVER verify BOLA by testing arbitrary IDs blindly! You might delete or modify 
# actual production users. ALWAYS test between two accounts YOU control: "Attacker" and "Victim".

# 1. Setup Phase
#   Create Account A (Attacker): id = 100
#   Create Account B (Victim): id = 200
#   Post a private picture using Account B. Note the picture ID (e.g., pic_id=555).

# 2. Attack Execution
#   Log into Account A (Attacker).
#   Intercept the request fetching Account A's pictures:
    GET /api/photos/100 HTTP/1.1
    Authorization: Bearer <Attacker_Session>

# 3. Manipulation
#   Change the path ID to the Victim's ID (or the Victim's picture ID):
    GET /api/photos/200 HTTP/1.1
    # or
    DELETE /api/photo/555 HTTP/1.1

# 4. Result Validation
#   If the server responds HTTP 200 OK and returns Victim B's sensitive data, the BOLA flaw is absolutely confirmed.
```

### Phase 3: Bypassing Weak BOLA Defenses

```text
# Concept: Developers try to implement protections, but often implement logical routing flaws instead.

# 1. Parameter Pollution (HPP)
# Feed an array or duplicate IDs to confuse the backend filter.
GET /api/profile?user_id=100&user_id=200
GET /api/profile?user_id[]=100&user_id[]=200

# 2. Add an ID into the Body
# If the path `GET /api/profile/100` prevents BOLA, what if you add the ID parameter to the JSON body instead?
GET /api/profile/100
{"user_id": 200}
# Sometimes the backend parser overwrites the validated path variable with the unvalidated JSON body variable.

# 3. Method Substitution (REST abuse)
# `PUT /api/resource/200` might hit a BOLA check. Does `POST /api/resource/200`? Does `PATCH`? 

# 4. JSON Content-Type Smuggling
# Change `Content-Type: application/json` to `Content-Type: application/xml` or `multipart/form-data`.
# A different XML parsing library on the backend might completely skip the BOLA authorization functions.
```

### Phase 4: Automation utilizing 'Autorize'

```text
# Concept: Doing this manually for 500 endpoints is impossible. Use the Burp Suite extension "Autorize".

# 1. Obtain cookies/headers for Account B (Victim / Low Privileged).
# 2. Paste headers into Autorize extension panel.
# 3. Browse the application using Account A (Attacker / High Privileged).
# 4. Autorize will capture every request Account A makes, strip Account A's cookies, inject Account B's cookies, and replay the request.
# 5. Review the Autorize dashboard: If a request meant for Account A succeeds while using Account B's session, you found an automated BOLA/IDOR flaw!
```

#### Decision Point 🔀
```mermaid
flowchart TD
    A[Identify Object Reference (user_id=12)] --> B[Test with Account A and Account B]
    B --> C{Does Account A return Account B's data?}
    C -->|Yes| D[High Severity: Direct BOLA Confirmed]
    C -->|No (HTTP 401/403)| E[Attempt Bypasses: HPP, Method Switching, Wildcards]
    E --> F{Did bypass succeed?}
    F -->|Yes| G[High Severity: Complex BOLA Confirmed]
    F -->|No| H[Check for Mass Assignment or transition to Autorize extension]
```


## 🔵 Blue Team Detection & Defense
- **Action-Based Authorization**: A purely valid session token string is not sufficient. The code must query the database checking the relationship: `SELECT * FROM invoices WHERE id = :requested_id AND owner_id = :session_user_id`. Every single data fetch must enforce this twin validation.
- **UUIDs are NOT a Defense**: Switching sequential IDs (1, 2, 3) to UUIDs (`3f84-ca9...`) prevents basic forced enumeration (guessing IDs rapidly). However, UUID implementation is inherently *Security by Obscurity*. If an attacker discovers the UUID (e.g., leaked in a URL shared on a forum), BOLA still permits them to destroy or read the data. UUIDs do not eliminate the BOLA vulnerability entirely.
- **Centralized Enforcement Policy**: Avoid writing authorization logic into every single controller function endpoint. Utilize middleware, API gateways, or framework-level policy enforcers (e.g., Pundit in Ruby, Policies in Laravel) that process rules dynamically per data model request.

## Key Concepts
| Concept | Description |
|---------|-------------|
| BOLA / IDOR | Broken Object Level Authorization / Insecure Direct Object Reference; exploiting authorization checks that fail to verify if the requesting user formally owns the underlying object ID requested |
| Sequential IDs | IDs generating sequentially (`id=12`, `id=13`). Highly vulnerable as an attacker merely has to iterate a number to traverse the entire database |
| UUID / GUID | Universally Unique Identifiers; 128-bit strings used to make endpoints un-guessable, but technically failing to solve underlying authorization flaws |

## Output Format
```
Bug Bounty Report: Widespread BOLA resulting in PII Leakage
===========================================================
Vulnerability: Broken Object Level Authorization (BOLA)
Severity: Critical (CVSS 8.5)
Target: GET /api/v2/customer/documents/{doc_id}

Description:
The main highly-sensitive customer documentation endpoint operates primarily using sequential Database Identifiers (e.g., `/api.../documents/1045`). 

Testing across two distinctly separate authenticated accounts revealed that the endpoint heavily trusts the `doc_id` referenced in the URL path but fails to adequately confirm if the documented belongs to the `user_id` authenticated inside the Bearer token. 

Reproduction Steps:
1. Log into Attacker Account `A`.
2. Determine Account `A` possesses document ID `990`.
3. Intercept fetching your secure document: `GET /api/v2/customer/documents/990`.
4. Modify the `doc_id` inside the Burp Repeater parameter sequentially: `GET /api/v2/customer/documents/991`.
5. The API responds with an `HTTP 200 OK` exposing the PDF tax documents of a completely unrelated user possessing document 991.

Impact:
Critical failure of confidentiality. Utilizing an automated script, an attacker can iterate numbers 1 through 1,000,000, immediately scraping the highly-confidential tax records belonging to millions of platform users in under an hour.
```


## 📚 Shared Resources
> For cross-cutting methodology applicable to all vulnerability classes, see:
> - [`_shared/references/elite-chaining-strategy.md`](../_shared/references/elite-chaining-strategy.md) — Exploit chaining methodology and high-payout chain patterns
> - [`_shared/references/elite-report-writing.md`](../_shared/references/elite-report-writing.md) — HackerOne-optimized report writing, CWE quick reference
> - [`_shared/references/real-world-bounties.md`](../_shared/references/real-world-bounties.md) — Verified disclosed bounties by vulnerability class

## References
- OWASP: [API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0x11-i1-broken-object-level-authorization/)
- PortSwigger: [Insecure direct object references (IDOR)](https://portswigger.net/web-security/access-control/idor)
- HackTricks: [IDOR / BOLA](https://book.hacktricks.xyz/pentesting-web/idor)
