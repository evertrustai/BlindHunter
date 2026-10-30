---

name: web-40-subdomain-takeover
sequence: web-40
category: xss
domain: web
description: "Subdomain takeover testing skill for offensive security. Covers CNAME, A/AAAA, NS, and MX record takeover detection across cloud providers (AWS S3, Azure, Heroku, GitHub Pages, etc.), cookie scope abuse, and CSP bypass via subdomain control. Use when performing subdomain enumeration and takeover assessment."
wordlist_ref: "wordlists/web/web-21-subdomain-takeover/"
---

# Subdomain Takeover — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Identify and confirm subdomain takeover vulnerabilities where DNS records point to deprovisioned cloud/CDN/SaaS endpoints that can be claimed by an attacker, enabling cookie theft, session hijacking, CSP bypass, and phishing.

## OWASP Mapping
- A05:2021 Security Misconfiguration
- CWE-350: Reliance on DNS for Authentication
- CWE-284: Improper Access Control

## Vulnerability Classes

### 1. CNAME to Unclaimed Cloud Service
**Most common targets:**
| Service | Takeover Indicator |
|---------|-------------------|
| GitHub Pages | `There isn't a GitHub Pages site here` |
| AWS S3 | `NoSuchBucket`, `The specified bucket does not exist` |
| Azure App Service | `Azure App Service - Error 404` |
| Heroku | `No such app`, `herokucdn.com` |
| Fastly | `Fastly error: unknown domain` |
| Shopify | `Sorry, this shop is currently unavailable` |
| Zendesk | `Help Center Closed` |
| Tumblr | `There's nothing here` |
| SendGrid | CNAME without active domain |
| WP Engine | `The URL you are looking for cannot be found` |
| Netlify | `Not found - Request ID:` |
| Surge.sh | `project not found` |
| Pantheon | `The gods are wise, but do not know of the site` |
| ReadMe.io | `Project doesnt exist... yet!` |
| StatusPage | `You are being redirected` |

**Verification:**
```bash
# Check DNS CNAME chain
dig CNAME vulnerable.target.com
# Check if target is claimable
curl -s https://vulnerable.target.com | grep -i "NoSuchBucket\|There isn't a GitHub"
```

### 2. CNAME to Expired/Deleted Service
**AWS S3 bucket takeover:**
1. `CNAME: assets.target.com → old-bucket.s3.amazonaws.com`
2. Bucket `old-bucket` deleted
3. Register new S3 bucket with same name: `aws s3 mb s3://old-bucket`
4. Bucket now claimable → host malicious content at `assets.target.com`

**Impact:**
- Steal cookies: `document.cookie` accessible from subdomain
- Serve malicious JavaScript under trusted domain
- Phishing pages under legitimate domain
- CSP bypass: if CSP allows `*.target.com`
- OAuth redirect_uri manipulation

### 3. Dangling A/AAAA Records
**Patterns:**
- A record pointing to released/terminated EC2 instance IP
- A record pointing to Elastic IP that was disassociated
- A record pointing to Azure VM that was deleted

**Detection:**
- IP no longer responds → DNS resolves but HTTP 500/connection refused
- IP re-assigned to different entity → server responds but with wrong content
- Nmap scan of IP → no listening service → "address not in use"

### 4. NS Record Takeover (Higher Impact)
**Pattern:**
- `NS: sub.target.com → ns1.expired-registrar.com`
- Expired DNS provider → registrar releases nameserver domain
- Register `expired-registrar.com` → control all DNS for subdomain

**Impact:** Full DNS control over subdomain zone → full MitM on all traffic

### 5. MX Record Takeover
**Pattern:**
- `MX: mail.target.com → mail.unclaimed-service.com`
- `unclaimed-service.com` not registered or CNAME target deprovisioned
- Register mail service or domain → receive all email for `*@mail.target.com`

**Impact:** Email interception → password reset hijack, MFA code interception

### 6. Cookie Scope Abuse via Takeover
**Attack chain:**
1. `app.target.com` sets `Cookie: session=abc; Domain=.target.com; HttpOnly`
2. Take over `evil.target.com` (any subdomain)
3. Victim visits `app.target.com` → session cookie sent to `evil.target.com`
4. Serve page loading `app.target.com` in iFrame → session available

**Note:** HttpOnly cookies NOT directly accessible via JS, but subdomain can set conflicting cookies or chain with CSWH

### 7. CSP Source Allowlist Bypass via Takeover
**Chain:**
1. CSP: `script-src *.target.com`
2. Take over `cdn.target.com` (or any `*.target.com`)
3. Host malicious JS at `https://cdn.target.com/exploit.js`
4. Inject `<script src="https://cdn.target.com/exploit.js">` on main app

---

# subjack scan
# subzy scan
# nuclei subdomain takeover
# httpx probe to confirm takeover indicator
## Attack Surface (Parameter Matrix)

| Surface | Takeover Tests |
|---------|---------------|
| CNAME records | All subdomains with external CNAME targets |
| A/AAAA records | Subdomains pointing to cloud IPs |
| NS records | Subdomains with delegated nameservers |
| MX records | Mail subdomains pointing to external services |
| All discovered subdomains | Every subdomain from recon employee |
| CSP source list subdomains | Subdomains in script-src/connect-src |
| OAuth redirect_uri subdomains | Subdomains registered as OAuth callbacks |
| HSTS preload subdomains | includeSubDomains scope |

---

## HackerOne Report Patterns

**Pattern 1: GitHub Pages takeover (H1 #263622 type)**
`blog.target.com CNAME → targetblog.github.io` but GitHub Pages site deleted. Register GitHub account with `targetblog`, create Pages site → `blog.target.com` now serves attacker's content. Used to steal session cookies and bypass CSP.

**Pattern 2: S3 bucket name reuse (H1 #507791 type)**
`assets.target.com CNAME → target-assets.s3-website-us-east-1.amazonaws.com`. Bucket deleted but CNAME remains. Register new public S3 bucket `target-assets` in us-east-1 → full content control.

**Pattern 3: Heroku abandoned app (H1 multiple)**
`api.target.com CNAME → my-api.herokuapp.com`. Heroku app deleted but CNAME remains. Create new Heroku app with same name (if available) → control endpoint.

**Pattern 4: Azure App Service (H1 #1007097 type)**
Azure custom domain DNS set up but underlying App Service deleted. Azure allows reclaiming custom domain for any App Service in any subscription → takeover.

**Pattern 5: NS delegation to dropped domain**
`docs.target.com NS → ns1.droppedprovider.com`. DNS provider went out of business, domain expired. Register `droppedprovider.com` → control all DNS for `docs.target.com`.

---

## Zero-Day Research Hooks

### Novel Takeover Vectors
- GCP Cloud Run / Cloud Functions: custom domain mapping to deleted function → takeover
- Render.com: custom domain pointing to deleted service
- Railway.app: custom domain to deleted project
- Vercel deployments: custom domain to deleted deployment
- AWS CloudFront: CNAME to distribution that was deleted
- Elastic Beanstalk: CNAME to deleted environment
- AWS API Gateway: custom domain to deleted API

### Chain Attacks
- Takeover + SameSite cookie: subdomain takeover + SameSite=None → cookie theft
- Takeover + HSTS includeSubDomains: once HSTS preloaded, even HTTP on taken subdomain upgrades
- Takeover + OAuth: taken subdomain registered as OAuth redirect_uri → code interception

---

## False Positive Mitigation
- Confirm CNAME still points to external target (DNS not updated)
- Confirm service fingerprint matches known takeover indicator string
- Verify target is actually claimable (e.g., S3 bucket name available) before reporting
- Distinguish "generic 404" from service-specific takeover error page
- Only run subdomain_scan_enabled tests if `state["subdomain_scan_enabled"] == True`

---




## Hacker Mindset

**Subdomain takeover is about unclaimed DNS.** A CNAME pointing to `app.herokuapp.com` that no longer exists — anyone can create a Heroku app with that name and serve content under your target's domain.

**Cookie theft is the impact, not the takeover.** Taking over `cdn.target.com` lets you set cookies for `*.target.com`. Users visiting `app.target.com` will send those cookies.

**CSP bypass is the other impact.** If `script-src *.target.com` includes your taken subdomain, you can execute arbitrary JS on the main application.



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
- subjack
- subzy
- httpx


## Bypass Techniques

| Filter/Block | Bypass |
|-------------|--------|
| WAF block | Encoding, case variation, comment injection |
| Input sanitization | Double encoding, Unicode, null bytes |
| Rate limiting | X-Forwarded-For rotation, HTTP/2 multiplex |
| Blacklist | Alternative syntax, polyglot payloads |


## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/web/web-21-subdomain-takeover/`

**Files**:
- `wordlists/web/web-21-subdomain-takeover/payloads/takeover/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

