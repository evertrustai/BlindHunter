---
name: bug-bounty-hunting
description: |
  Comprehensive bug bounty hunting methodology — the master orchestrator skill.
  Converts Hermes Agent from a general assistant into a senior bug-hunting researcher.
  5-phase non-linear workflow, critical thinking framework, developer-psychology heuristics.
  Routes to 24+ sibling hunt-* skills based on current phase and findings.
triggers:
  - hunt this target
  - bug bounty
  - find vulnerabilities
  - security testing
  - pentest this app
  - red team
  - security review
  - look for bugs in
  - assess the security of
category: security
---
# Bug Bounty Hunting — Master Orchestrator

Adapted from [Claude-BugHunter](https://github.com/elementalsouls/Claude-BugHunter) by ElementalSouls (Sachin Sharma).  
**14 skills adapted so far · 574+ disclosed HackerOne report patterns · 24 vulnerability classes**

> **Current state:** 10 `hunt-*` skills exist. The original has 24+ hunt skills — see `references/original-skill-index.md` for the full list of skills not yet adapted, and help expand the library.

---

## Core Philosophy

> **"Can an attacker do this RIGHT NOW against a real user who has taken NO unusual actions — and does it cause real harm (stolen money, leaked PII, account takeover, code execution)?"**

If NO → STOP. Do not write. Do not explore further. Move on.

### Kill These Immediately:
- "Could theoretically allow..." — not exploitable = not a bug
- "An attacker with X, Y, Z conditions could..." — too many preconditions
- Dead code with a bug in it — not reachable = not a bug
- SSRF with DNS-only callback — need data exfil or internal access
- Open redirect alone — need ATO or OAuth chain

---

## Phase 0: Mode Confirmation (Before Anything Else)

Confirm the engagement type before deciding what counts as a finding:

| Engagement Type | What Counts as a Finding | What Gets Rejected |
|---|---|---|
| **Bug Bounty** (H1 / Bugcrowd / Intigriti / VDP) | Impact-demonstrated bugs ONLY. Full chain to attacker-attainable harm. | Hygiene (EoL software, permissive CSP, stack traces, info disclosure without concrete impact, "best practice" violations) |
| **Red Team** (external client engagement) | Hygiene findings + recon + IoCs + defensive-state observations are ALL deliverables | Nothing — even "no finding here" is reportable as a positive defensive observation |
| **Pentest** (signed SoW / WAPT) | Depends on SoW. Read scope explicitly. Usually accepts hygiene + impact + recon | Out-of-scope assets, unsigned testing |
| **Internal Audit** | Compliance-mapped findings (PCI / ISO / NIST / DPDPA / GDPR) | Findings without a control-mapping |

**Hard rule:** Write the engagement type as the first line in your notes. If you can't answer it from the instruction, ASK once.

---

## Phase 1: Mindset — How to Think

### 5 Ultimate Goals (Pick One Per Session)

1. **Confidentiality** — steal data the attacker shouldn't see
2. **Integrity** — modify data the attacker shouldn't change
3. **Availability** — disrupt service (app-level DoS only)
4. **Account Takeover** — control another user's account
5. **RCE** — execute commands on the server

### Daily Discipline: Define → Select → Execute

1. **Define**: "Today I target [feature/domain] to achieve [CIA impact]"
2. **Select**: Choose 1-2 vuln classes (IDOR, Race Condition, SSRF, XSS, etc.)
3. **Execute**: Focus ONLY on selected techniques. No wandering.

### 4 Thinking Domains

#### 1. Critical Thinking (deep analysis)
- Frontend control disabled? Send request directly via proxy
- `user_role=user` cookie? Change to `admin`
- `price=1000` in POST? Change to `1`
- ID in URL? Increment it. UUID? Try v1, v3, or sequential patterns

#### 2. Developer Empathy
- What was the simplest implementation?
- What shortcut would a tired dev take at 2am?
- Where is auth checked — controller? middleware? DB layer?
- What happens when you call endpoint B without going through endpoint A first?

#### 3. Trust Boundary Mapping
```
Client → CDN → Load Balancer → App Server → Database
   ^          ^          ^
Where does app STOP trusting input?
Where does it ASSUME input is already validated?
```

#### 4. Feature Interaction Thinking
- Does this new feature reuse old auth? (often broken)
- Does this webhook accept unvalidated URLs? (SSRF)
- Does this import feature process files without sanitization? (XXE, RCE)
- Does this OAuth flow reuse state across tenants? (CSRF → account linking)

---

## Phase 2: Reconnaissance

Before any live testing:

### Passive Recon
- **Certificate Transparency**: `crt.sh` — enumerate subdomains
- **DNS Enumeration**: subfinder, amass, or manual `dig`
- **Technology Fingerprinting**: Wappalyzer, `whatweb`, `builtwith`
- **JS Analysis**: Download all JS bundles, grep for:
  - API endpoints (`/api/`, `/v1/`, `/graphql`)
  - Secrets (Firebase, AWS, GCP, JWT, Stripe, GitHub tokens)
  - Hidden routes, admin paths
  - Source maps (`/*.js.map`, `/_next/static/*.js.map`)
- **GitHub Dorking**: Search for target's domain, API keys, config files

### Active Recon
- **Top-100 path probe**: `/admin`, `/api`, `/login`, `/.git`, `/.env`, `/server-status`, `/swagger`, `/openapi.json`, `/docs`, `/actuator`, `/healthz`, `/metrics`, `/debug`, `/trace`, `/env`, `/heapdump`, `/threaddump`
- **Read `robots.txt`** — every `Disallow` becomes a probe target
- **Read `sitemap.xml`** — every entry becomes a probe target
- **Directory brute-force** (if scope allows): common paths, backup files, config files
- **Crawl authenticated surface** (if grey-box): all features, settings, admin panels

### Scope Validation
- Confirm every asset is owned by and in scope for the target
- Identify third-party services (Stripe, Salesforce, Auth0, etc.)
- Separate staging/dev from production domains

---

## Phase 3: Active Hunting

### Crown Jewel Targeting (Highest Payout First)

| Target Type | Why High Value |
|---|---|
| **Admin panels & authenticated dashboards** | Session hijacking with elevated privileges |
| **Payment/financial flows** | Financial fraud at scale |
| **Authentication** (login, signup, password reset, OAuth) | Account takeover |
| **File upload / import** endpoints | RCE, stored XSS, SSRF |
| **API endpoints** (especially GraphQL) | Mass data exfil, IDOR |
| **Cloud-hosted SaaS** | SSRF → cloud metadata → IAM credential theft |
| **Shared SaaS tenant surfaces** | Cross-tenant boundary attacks |
| **SSO/OAuth flows** | Account linkage, auth code theft |

### Cluster Hunting (A→B Signal Method)

**Single bugs pay. Chains pay 3-10x more.**

| Bug A (Signal) | Hunt for Bug B | Escalate to C |
|---|---|---|
| IDOR (read) | PUT/DELETE on same endpoint | Full account data manipulation |
| SSRF (any) | Cloud metadata 169.254.169.254 | IAM credential exfil → RCE |
| XSS (stored) | Check if HttpOnly on session cookie | Session hijack → ATO |
| Open redirect | OAuth redirect_uri accepts your domain | Auth code theft → ATO |
| S3 bucket listing | Enumerate JS bundles for secrets | OAuth client_secret → OAuth chain |
| Rate limit bypass | OTP brute force | Account takeover |
| GraphQL introspection | Missing field-level auth | Mass PII exfil |
| Debug endpoint | Leaked environment variables | Cloud credential → infra access |
| CORS reflects origin | Test credentials:include | Credentialed data theft |
| Host header injection | Password reset poisoning | ATO via reset link |
| Admin panel exposed | Test default creds, CSRF, SSRF | Full admin access |

### Cluster Hunt Protocol
1. **CONFIRM A** — Verify bug A with an HTTP request
2. **MAP SIBLINGS** — Find all endpoints in same controller/module/API group
3. **TEST SIBLINGS** — Apply the same bug pattern to every sibling
4. **CHAIN** — If sibling has different bug class, try combining A + B
5. **QUANTIFY** — "Affects N users" / "exposes $X value" / "N records"
6. **REPORT** — One report per chain (not per bug). Chains pay more.

### One Bug Class at a Time (Go Deep, Don't Spray)

Select 1-2 classes from the sibling skills below. Load each skill for detailed methodology, payloads, and validation:

**Web Application Vulnerabilities:**
- `hunt-xss` — Cross-Site Scripting (174 H1 report patterns)
- `hunt-ssrf` — Server-Side Request Forgery (9 H1 reports)
- `hunt-sqli` — SQL Injection + NoSQL Injection (8 H1 reports)
- `hunt-rce` — Remote Code Execution (SSTI, deserialization, dependency confusion)
- `hunt-idor` — Insecure Direct Object References (26 H1 reports)
- `hunt-file-upload` — File Upload Vulnerabilities (10 techniques)
- `hunt-ssti` — Server-Side Template Injection
- `hunt-xxe` — XML External Entity attacks
- `hunt-csrf` — Cross-Site Request Forgery (chain-required)
- `hunt-business-logic` — Business Logic Flaws
- `hunt-cache-poison` — Web Cache Poisoning
- `hunt-http-smuggling` — HTTP Request Smuggling

**Authentication & Identity:**
- `hunt-ato` — Account Takeover (9 distinct paths)
- `hunt-auth-bypass` — Authentication Bypass
- `hunt-mfa-bypass` — MFA/2FA Bypass (7 patterns)
- `hunt-oauth` — OAuth 2.0/OIDC flaws (10 H1 reports)
- `hunt-saml` — SAML SSO attacks

**API & Infrastructure:**
- `hunt-api-misconfig` — API misconfiguration (JWT, GraphQL, CORS, mass assignment)
- `hunt-graphql` — GraphQL API attacks
- `hunt-cloud-misconfig` — Cloud misconfiguration
- `hunt-race-condition` — Race conditions
- `hunt-llm-ai` — LLM/AI security testing

**Infrastructure & Recon:**
- `hunt-subdomain` — Subdomain enumeration
- `hunt-ntlm-info` — NTLM information disclosure

### Real-Engagement Cadence (Per Live Host)

Before declaring a host complete, you must have done:

- [ ] Top-100 path probe (admin, api, login, /.git, /.env, swagger, etc.)
- [ ] robots.txt content READ — every Disallow becomes probe target
- [ ] sitemap.xml content READ — every entry becomes probe target
- [ ] JS bundles harvested and grepped for secrets + routes + API endpoints
- [ ] Source-map variant paths checked (`*.js.map`, `/_next/static/*.js.map`)
- [ ] For every form: SQLi sweep, auth-bypass sweep, CSRF, parameter pollution, mass-assignment, race condition
- [ ] For every API endpoint: HTTP method tampering, content-type tampering, JWT attacks
- [ ] For every SaaS tenant: vendor-specific check matrix
- [ ] Mobile apps (if available): APK pulled, decompiled, secrets + endpoints extracted

---

## Phase 4: Validation & Triage — The 7-Question Gate

Before drafting ANY report, every finding runs through:

### Q1: Can an attacker use this RIGHT NOW, step by step?
Complete this template:
```
1. Setup: I need [own account / another user's ID / no account]
2. Request: [exact HTTP method, URL, headers, body]
3. Result: I can [read / modify / delete] [exact data shown]
4. Impact: The real-world consequence is [ATO / PII read / money stolen]
5. Cost: Time: [X minutes], Capital: [$0 / $X subscription]
```
**If you CANNOT write step 2 as a real HTTP request → KILL IT.**

### Q2: Is the impact on the program's accepted impact list?
**If your bug maps to a listed exclusion → KILL IT.**

### Q3: Is the root cause in an in-scope asset?
Domain on in-scope list? Production (not staging/dev)? Not third-party?
**If out-of-scope → KILL IT.**

### Q4: Does it require privileged access an attacker can't realistically get?
- "Admin can do X" = centralization risk = **KILL IT** (99% of programs)
- "Non-admin can do X that only admin should do" = valid
- Requires physical access / MFA device = usually invalid

### Q5: Is this already known or accepted behavior?
Search: program's disclosed reports, GitHub issues, changelog, API docs.
**If acknowledged/design decision → KILL IT.**

### Q6: Can you prove impact beyond "technically possible"?
- XSS → show actual cookie theft/session hijack, not just `alert(1)`
- SSRF → hit internal endpoint returning data, not just DNS ping
- SQLi → show actual data exfil from real table, not just error message
- IDOR → show actual other-user's data, not just 200 status

### Q7: Is this a known-invalid bug class?
Check NEVER SUBMIT list:
- Missing CSP / HSTS / security headers alone
- Missing SPF / DKIM / DMARC
- GraphQL introspection alone (no auth bypass or IDOR demonstrated)
- Banner/version disclosure without working CVE exploit
- Clickjacking on non-sensitive pages (no sensitive action PoC)
- Tabnabbing
- CSV injection (no actual code execution shown)
- CORS wildcard (*) without credential exfil PoC
- Logout CSRF
- Self-XSS (only exploits own account)
- Open redirect alone (no ATO or OAuth chain)
- SSRF DNS callback only (no internal service access or data)
- Host header injection alone (no password reset poisoning)
- Rate limit on login/contact/search (Cloudflare covers it)

**One NO = KILL the finding. Move on.**

### 4 Pre-Submission Gates

**Gate 0 — Reality Check (30s)**
- [ ] Bug confirmed with actual HTTP requests, not code reading alone
- [ ] In scope — checked program scope page
- [ ] Reproducible from scratch — fresh session
- [ ] Evidence ready — screenshot, response body, or video

**Gate 1 — Impact Validation (2 min)**
- [ ] "What can attacker DO that they couldn't before?"
- [ ] Actual victim: another user's data, company's data, financial loss
- [ ] Not relying on victim doing something unlikely

**Gate 2 — Dedup Check (5 min)**
- [ ] Searched HackerOne Hacktivity for this program + similar bug title
- [ ] Searched GitHub issues for target repo
- [ ] Read most recent 5 disclosed reports for this program
- [ ] Google: "TARGET_NAME ENDPOINT_NAME bug bounty"

**Gate 3 — Report Quality (10 min)**
- [ ] Title: [Bug Class] in [Endpoint] allows [actor] to [impact]
- [ ] Steps to Reproduce: copy-pasteable HTTP request
- [ ] Evidence: screenshot/video of actual impact (not just 200 status)
- [ ] Severity: matches CVSS 3.1 score AND program's definitions
- [ ] Remediation: 1-2 sentences of concrete fix
- [ ] NEVER used "could potentially" or "may allow"

---

## Phase 5: Reporting & Submission

### Title Formula
```
[Bug Class] in [Exact Endpoint/Feature] allows [attacker role] to [impact] [victim scope]
```

**Good:**
- `IDOR in /api/v2/invoices/{id} allows authenticated user to read any customer's invoice data`
- `Stored XSS in profile bio field executes in admin panel — allows privilege escalation`
- `SSRF via image import URL parameter reaches AWS EC2 metadata service`

**Bad:**
- `IDOR vulnerability found`
- `Security issue in API`

### Platform-Specific Templates

For HackerOne: See `report-writing` skill for full templates.
For Bugcrowd: VRT Category required; Expected vs Actual Behavior section.
For Intigriti: PoC video valued much more than screenshot.
For Immunefi: PoC-first — working code is primary deliverable.

### Evidence Hygiene
- **REDACT** session cookies, OAuth tokens, other users' PII
- **LEAVE VISIBLE** trace IDs, request IDs, test account UID, response shapes
- **NO** "could potentially" or "may allow" language
- **YES** specific, impact-first language

---

## References

- **`triage-validation`** — Detailed 7-Question Gate with decision trees
- **`security-arsenal`** — Complete payload library (XSS, SSRF, SQLi, XXE, SSTI, JWT, NoSQL, path traversal, cloud metadata)
- **`report-writing`** — Full report templates for H1, Bugcrowd, Intigriti, Immunefi + CVSS scoring
- **`redteam-mindset`** — Red team discipline, self-throttling anti-patterns, engagement cadence
- **`references/original-skill-index.md`** — Full index of all 51 original skills, with adaptation status
- Each `hunt-*` skill — per-class methodology, detection patterns, payloads, bypass tables
