---
name: p1-unauth-recon-agent
description: >
  Elite unauthenticated P1/P2 bug-hunting agent that finds critical vulnerabilities from nothing but a target TLD via pure recon — no account, no credentials, no insider access. ALWAYS activate for: unauthenticated bug hunting, pre-auth vulnerability, "just give me a domain", "find P1 bugs on target.tld", "recon-only hunting", "no login required", subdomain takeover, exposed S3/GCS/Azure buckets, exposed Jenkins/Kubernetes/Spring Actuator/Grafana/Kibana/Elasticsearch/MongoDB/Redis, .git/.env/.DS_Store exposure, source map leaks, GitHub/GitLab/Postman secrets leak, pre-auth RCE CVEs (Confluence CVE-2022-26134/CVE-2023-22515, Spring4Shell, Log4Shell, MOVEit, Citrix Bleed, GitLab, Atlassian, Fortinet, F5 BIG-IP, Telerik, Struts, Drupalgeddon, ImageMagick), unauthenticated SSRF, open redirect chains to OAuth ATO, CORS wildcard with credentials, cache poisoning, web cache deception, dependency confusion via public JS, origin IP disclosure / WAF bypass, default credentials on exposed services, dangling DNS, host header injection on password reset, SAML/OIDC misconfig from .well-known, public NPM packages with internal names, leaked API keys in JS bundles, exposed Swagger/GraphQL introspection, mass DNS subdomain enumeration, "give me bounties without auth", "P1 from TLD only", or ANY request to find critical vulnerabilities with zero authentication on a publicly-known domain. Full kill chain: TLD → DNS/cert → asset inventory → service fingerprint → CVE map → secret hunt → exposure scan → chain → PoC → report. Token-efficient. Authorized testing only.
---

# P1-UNAUTH-RECON-AGENT — Critical Bugs from Just a TLD

> **Scope reminder**: Confirm `target.tld` is in-scope for an active bug-bounty program / pentest engagement / CTF before any active probing. Many findings below are passive-discoverable, but PoCs require authorization.

---

## CORE PHILOSOPHY (read once)

1. **A TLD is more attack surface than you think.** From `target.tld` alone you can usually find 100–10,000 subdomains, 50+ tech stacks, dozens of exposed services, and at least one P1 within hours — if you know where to look.
2. **Unauth bugs are higher-impact by definition.** Every "no auth required" finding multiplies severity (CVSS AV:N/PR:N), and triagers fast-track them.
3. **The four highest-yield buckets, in order:**
   - **Exposure** (something internal facing the internet that shouldn't)
   - **Takeover** (dangling DNS, abandoned cloud resource, expired domain)
   - **Pre-auth CVE** (the asset runs a known-vulnerable version)
   - **Secrets** (credentials/tokens/keys leaked in public code or JS)
4. **Recon is the bug.** ~70% of unauth P1s are found in Phase 1–2 (recon + fingerprint) before you ever send an exploit payload.
5. **Verify before you celebrate.** A naked Jenkins login page is not a P1. A Jenkins with anonymous read on `/script` is. Always click through.
6. **Never exfil real data.** Read enough to prove impact (one record, one config key, one PII field) and stop.

---

## PHASE 0 — INPUT NORMALIZATION

You are given `target.tld` (e.g. `acme.com`). Normalize before working:

```
T=acme.com                       # primary TLD
APEX=$(dig +short $T NS | head -1) # confirm authoritative NS
ORG=$(whois $T | grep -iE 'organi[sz]ation|registrant')
ASN=$(whois -h whois.cymru.com " -v $(dig +short $T)" | tail -1)
```

Decide: is this a **single-product** TLD (one app, one host), a **corporate umbrella** (hundreds of subdomains), or an **infra-only** TLD (CDN/edge only)? The killchain differs.

---

## PHASE 1 — PASSIVE RECON (zero traffic to target)

Read `references/recon-passive.md` for full one-liners. Minimum viable harvest:

```bash
# Subdomains (multi-source, dedupe)
subfinder -d $T -all -silent -o subs.txt
amass enum -passive -d $T -silent >> subs.txt
curl -s "https://crt.sh/?q=%25.$T&output=json" | jq -r '.[].name_value' | tr ',' '\n' >> subs.txt
chaos -d $T -silent >> subs.txt
github-subdomains -d $T -t $GH_TOKEN >> subs.txt
cero $T >> subs.txt                     # cert-SAN-based, finds internal-looking hosts
sort -u subs.txt > subs.uniq

# Historical URLs (great for hidden/old endpoints)
gau --threads 10 $T > urls.gau
waybackurls $T > urls.wb
cat urls.* | grep -E '\.(json|xml|env|bak|swp|sql|zip|tar|gz|7z|log|pem|key)$' > juicy.urls

# Public secrets under the org (high signal)
trufflehog github --org=$ORG --only-verified
gitleaks --repo-search $ORG
noseyparker scan github --org $ORG

# Public NPM/PyPI packages mentioning the org (dependency-confusion seeds)
npm search "@$ORG/" || npm search "$ORG"
pip search "$ORG"
```

**Decision gate — proceed to Phase 2 only when:**
- ≥1 subdomain list with ≥50 hosts (or all of them if the TLD is small)
- Historical URLs collected
- Org GitHub/GitLab presence enumerated

---

## PHASE 2 — ACTIVE FINGERPRINTING

```bash
# Probe alive + tech + IP + CNAME (CNAME is the takeover signal)
httpx -l subs.uniq -silent -status-code -title -tech-detect -ip -cname -cdn -json > probe.json

# Port scan unique IPs (top 1000, then deep on interesting ones)
awk '{print $NF}' probe.json | jq -r '.host' | sort -u > hosts.uniq
naabu -list hosts.uniq -top-ports 1000 -o ports.txt
nmap -sV -sC -p- --min-rate 5000 -iL hosts.uniq -oA nmap.deep

# Screenshot everything (visual triage is fast)
gowitness file -f subs.uniq -P shots/

# JS harvest + endpoint extraction
katana -list subs.uniq -d 5 -jc -kf all -aff -fs fqdn -o crawled.txt
cat crawled.txt | grep -E '\.js(\?|$)' | uniq > js.urls
mkdir -p js && cd js && wget -q -i ../js.urls && cd ..
linkfinder -i 'js/*.js' -o cli > js.endpoints
jsluice urls js/*.js
trufflehog filesystem js/ --only-verified  # secrets in JS

# Source maps (huge — full source disclosure)
grep -rE 'sourceMappingURL=' js/ | awk -F'=' '{print $NF}' > sourcemaps.txt
```

**Decision gate — what to attack first (route to phases 3.X):**
| Signal | Route |
|---|---|
| CNAME points to abandoned cloud provider | **3.1 Subdomain Takeover** |
| `.git/HEAD`, `.env`, `web.config`, `.DS_Store` reachable | **3.2 Source/Config Exposure** |
| Banner = Jenkins/Spring/Grafana/Kibana/ES/Mongo/Redis/Solr/Druid/Airflow/Argo/Consul/Etcd | **3.3 Exposed Services** |
| Title/tech matches known pre-auth CVE | **3.4 Pre-auth CVE** |
| AWS/GCS/Azure bucket reference in JS or HTML | **3.5 Cloud Storage** |
| `?url=`, `?image=`, `?callback=`, `?return_to=` unauth | **3.6 Unauth SSRF / Open Redirect** |
| `Access-Control-Allow-Origin: *` + `Allow-Credentials: true` | **3.7 CORS Misconfig** |
| GraphQL endpoint with introspection on, unauth | **3.8 GraphQL Unauth** |
| Verified secret hit from trufflehog/gitleaks | **3.9 Live Secret** |
| Internal-named NPM/PyPI package in `package.json` of JS bundle | **3.10 Dependency Confusion** |
| Origin IP behind CDN guessable (cert SAN, historic DNS, favicon hash) | **3.11 WAF/Origin Bypass** |

---

## THE TOP-10 UNAUTH P1 BUG CLASSES (canonical taxonomy)

Every finding should map to one of these. CVSS scores are the typical ceiling when impact is fully demonstrated. Manual hunting techniques first — automation (nuclei/sqlmap) is a confirmation aid, never the discovery method.

| # | Bug class | CVSS ceiling | Manual signal to hunt |
|---|---|---|---|
| 1 | **Pre-auth RCE** | 10.0 | Banner/version match for vulnerable product; old endpoints in wayback; debug routes; dev/stage hosts |
| 2 | **SQLi — auth bypass / dump** | 9.8 | Error strings, time-skew on `'`/`"`/`;`, ORDER BY differential, header & cookie reflection in queries |
| 3 | **Unauth SSRF (full internal access)** | 9.8 | Any `url=`/`image=`/`fetch=`/`webhook=`/`callback=` param on unauth path, PDF/image renderer, link preview |
| 4 | **IDOR — mass data exposure** | 9.1 | `/api/.../{id}` sequential IDs, public exports, GUID predictability, `/profile/{slug}`, `/invoice/{n}` |
| 5 | **Auth bypass via JWT / token flaws** | 9.8 | `alg:none`, `kid` traversal/SQLi, weak HS256 secret, public-key confusion, no signature verification |
| 6 | **XXE** | 9.1 | XML POST endpoints, SOAP, SAML, SVG/DOCX/XLSX upload, OOXML, RSS importer |
| 7 | **Path traversal → arbitrary file R/W** | 9.3 | `?file=`, `?path=`, `?download=`, `?template=`, double-encoded `..%2f`, archive extraction |
| 8 | **BOLA on GraphQL/REST (no-auth API)** | 9.1 | Endpoint reachable without cookie/JWT; `node(id:"...")`; verb-tunneling; `/internal/`; mobile API origin |
| 9 | **Unauth RFI / LFI** | 8.8 | `?page=`, `?include=`, `?module=`, PHP wrappers (`php://filter`, `data://`), log poisoning |
| 10 | **Exposed admin panels / default creds** | 8.8 | Title/favicon match, `/admin`, `/manager`, `/jenkins`, `/grafana`, `/console`, vendor default creds |

→ Detailed manual playbooks for each: `references/top10-unauth.md`

---

## PHASE 3 — UNAUTH P1 KILLCHAINS

### 3.1 — Subdomain Takeover
**Why P1**: Cookie scope, OAuth `redirect_uri`, CORS allowlist, SSO origin, brand abuse.

Read `references/subdomain-takeover.md`. Quick check:
```bash
nuclei -l subs.uniq -t http/takeovers/ -severity high,critical
subzy run --targets subs.uniq --concurrency 50 --hide_fails
# manual: dig CNAME, fetch URL, look for provider-specific 404 fingerprints
```
**Escalation**: claim the dangling resource → host JS / cookies → ATO via cookie injection on sibling subdomain → tenant-wide impact.

### 3.2 — Source Code / Config Exposure
**Why P1**: Full source → secrets → DB creds → RCE chain.
```bash
nuclei -l alive.txt -t http/exposures/ -severity high,critical
# Targeted .git
for u in $(cat alive.txt); do curl -s -o /dev/null -w "%{http_code} $u/.git/HEAD\n" $u/.git/HEAD; done | grep '^200'
# Then full dump
git-dumper http://x.target.com/.git/ ./dumped
# .env / web.config / actuator / Swagger / phpinfo / server-status / .well-known
ffuf -w wordlists/sensitive.txt -u https://FUZZ.$T/FUZZ2 -mc 200,403 -ac
```
**Escalation**: clone repo → trufflehog the history → find DB / cloud creds → pivot.

### 3.3 — Exposed Services (the gold mine)
Read `references/exposed-services.md`. Per-service unauth checks:

```
Jenkins         → /script (Groovy console), /jnlpJars/jenkins-cli.jar, /env-vars.html, /asynchPeople/
                  Pre-auth RCE: CVE-2024-23897 (file read → secret → RCE chain)
Spring Boot     → /actuator/env, /actuator/heapdump (! creds in memory), /actuator/jolokia
Kubernetes API  → /api/v1/namespaces (anonymous), /version, /apis
Etcd            → :2379/v2/keys (cluster secrets)
Consul          → :8500/v1/kv/?recurse
Elasticsearch   → /_cat/indices?v, /_search?q=password
MongoDB         → mongo --host x.target.com (no auth?)
Redis           → redis-cli -h x.target.com (no auth?), then SLAVEOF / CONFIG SET dir for RCE
Memcached       → stats, get *
Grafana         → /api/datasources (auth=anon), CVE-2021-43798 path traversal
Kibana          → /api/console/proxy, /app/kibana#/dev_tools
Airflow         → /admin/airflow/dag_code (DAG source), pre-auth RCE CVE-2022-40127
Argo Workflows  → /api/v1/workflows (anon)
Zeppelin        → /#/notebook (no auth) — RCE via Shell interpreter
Drupal          → /core/COMPOSER.json (version), Drupalgeddon variants
GitLab          → /-/users/sign_in (version banner), CVE-2023-7028 (no-click ATO via secondary email)
Confluence      → /login.action?logout=true (version footer), CVE-2022-26134 (OGNL), CVE-2023-22515 (admin creation), CVE-2023-22518 (config wipe)
Atlassian Jira  → /servicedesk/customer/user/login (Jira SD), CVE-2022-0540 / CVE-2023-22501
Citrix ADC      → /vpn/index.html (Citrix Bleed CVE-2023-4966 session hijack)
Fortinet        → /remote/login (FortiOS), CVE-2024-21762, CVE-2022-42475
F5 BIG-IP       → /tmui/login.jsp, CVE-2023-46747, CVE-2022-1388
MOVEit          → /human.aspx → CVE-2023-34362
PaperCut        → CVE-2023-27350 pre-auth RCE
Telerik         → /Telerik.Web.UI.WebResource.axd?type=rau — CVE-2019-18935
Apache Struts   → /struts2-showcase/ → CVE-2017-5638
GhostScript     → upload-based, parser confusion
Apache OFBiz    → CVE-2023-49070 / CVE-2023-51467 (auth bypass + XML-RPC RCE)
```

### 3.4 — Pre-auth CVE Catalog
Read `references/preauth-cves.md` for the comprehensive list. Workflow:
```bash
# Mass fingerprint then map to nuclei templates
nuclei -l alive.txt -severity critical,high -t cves/ -t exposed-panels/ -t default-logins/ -rl 100
# For each hit, MANUALLY confirm version + try public PoC against your own clone first, never blind on prod
```

### 3.5 — Cloud Storage Exposure
Read `references/cloud-storage.md`.
```bash
# Bucket name candidates
for kw in $T $ORG ${T%.*} prod stage dev backup assets media; do echo $kw; done > bn.txt

# S3
for b in $(cat bn.txt); do
  aws s3 ls s3://$b --no-sign-request 2>/dev/null && echo "PUB: $b"
done
# GCS / Azure variants
gsutil ls -p $b gs://$b 2>/dev/null
curl -s "https://$b.blob.core.windows.net/?comp=list"

# Public-write check (only if explicitly in scope and you can PoC with a marker file)
aws s3 cp poc.txt s3://$b/poc-$(date +%s).txt --no-sign-request
```
**Escalation**: writeable JS bundle → supply-chain XSS on every customer page → ATO at scale.

### 3.6 — Unauth SSRF / Open Redirect
Sources from JS / wayback: `url=`, `image=`, `callback=`, `next=`, `redirect=`, `return_to=`, `dest=`, `link=`, `target=`.
```bash
# SSRF probe with collaborator
qsreplace 'http://OOB.collab/SSRF' < urls.params > probe.urls
httpx -l probe.urls -silent
# Open redirect mass test
echo "$T" | gau | gf redirect | qsreplace 'https://evil.com' | httpx -fr -mc 301,302 -location
```
**Escalation**: SSRF → 169.254.169.254 / metadata.google.internal → IMDS creds → S3/source → pivot to higher P1.
**Open redirect → OAuth `redirect_uri` ATO** when the OAuth client allows wildcard / suffix match.

### 3.7 — CORS w/ Credentials
```bash
# Look for ACAO reflection + ACAC:true
for u in $(cat alive.txt); do
  r=$(curl -s -H "Origin: https://evil.com" -I $u)
  echo "$r" | grep -i 'access-control-allow-origin: https://evil.com' >/dev/null && \
    echo "$r" | grep -i 'access-control-allow-credentials: true' >/dev/null && \
    echo "VULN: $u"
done
```
**Escalation**: read authenticated user data via XHR from attacker page → ATO.

### 3.8 — GraphQL Unauth
```bash
for u in $(cat alive.txt); do
  for p in /graphql /api/graphql /v1/graphql /graphiql; do
    r=$(curl -s -X POST $u$p -H 'Content-Type: application/json' \
      -d '{"query":"{__schema{types{name}}}"}')
    echo "$r" | grep -q '__schema' && echo "INTRO ON: $u$p"
  done
done
```
**Escalation**: introspect → find admin/internal queries → BOLA/IDOR → cross-tenant data.

### 3.9 — Live Secret Hunt
Already done in Phase 1, but escalate verified hits:
- AWS key → `aws sts get-caller-identity` → enumerate via `pacu` / `enumerate-iam`
- GitHub PAT → `curl -H "Authorization: token X" https://api.github.com/user`
- Slack token → check `auth.test`, `team.info`, `users.list`
- Stripe / Sendgrid / Twilio → check key type (test vs live) before reporting
**Never** use creds beyond `whoami`-style identity confirmation unless explicit scope says so.

### 3.10 — Dependency Confusion
Read `references/dependency-confusion.md`.
```bash
# Find internal-looking package names in client JS / package.json leaks
grep -rEoh '"@[a-z0-9-]+/[a-z0-9-]+"' js/ | sort -u > pkgs.scoped
grep -rEoh '"[a-z][a-z0-9-]+":\s*"[\^~]?[0-9]' js/ | awk -F'"' '{print $2}' | sort -u > pkgs.flat
# Check which are NOT on npm (the takeable ones)
for p in $(cat pkgs.scoped pkgs.flat); do
  npm view $p name 2>/dev/null || echo "UNCLAIMED: $p"
done
```
**Escalation only with explicit scope**: publish marker package to a private namespace you control; observe DNS callback from build agent. Never ship malicious code.

### 3.11 — WAF / Origin IP Bypass
```bash
# Cert SAN history (origin often in old certs)
curl -s "https://crt.sh/?q=%25.$T&output=json" | jq -r '.[].name_value' | sort -u
# Favicon hash → Shodan
fav=$(curl -s https://$T/favicon.ico | md5sum)
shodan search "http.favicon.hash:$fav"
# Email headers (Received: from real IP)
# DNS history (SecurityTrails, ViewDNS)
```
**Escalation**: bypass CDN → hit origin directly → bypass WAF rules → re-enable disabled endpoints.

---

## PHASE 4 — IMPACT MAXIMIZATION

For each finding, run the **unauth multiplier checklist**:

```
Q1. Confirmed PRE-AUTH (no cookie, no header, no referrer trick)?      → +1 tier
Q2. Affects ALL customers / cross-tenant?                              → +2 tiers
Q3. Reveals credentials, source, or PII?                               → +1 tier
Q4. Persistent (stored / dangling / DNS-level)?                        → +1 tier
Q5. Chains to RCE / SQLi / ATO?                                        → +2 tiers
Q6. Mass-exploitable via automation?                                   → +1 tier
Q7. Zero user interaction?                                             → +1 tier
```

Three+ "yes" answers = TIER S report ($20K+ if in a paying program).

---

## PHASE 5 — REPORT

Read `references/report-writing.md`. Required sections:
1. **Title** — `[Pre-auth] {Class} on {host} → {impact}`
2. **Summary** — one paragraph, no jargon, lead with impact
3. **Steps to reproduce** — copyable curl/HTTP, exact URLs, no Burp screenshots only
4. **PoC** — minimal, deterministic, marker-file based
5. **Impact** — concrete data exposed (counts, types, examples — redacted)
6. **CVSS 3.1 vector** — be honest, AV:N/AC:L/PR:N/UI:N for true unauth
7. **Suggested fix** — vendor patch ref, config change, IAM tightening
8. **Disclosure timeline** — when you found, when you contacted, when you'll publish

---

## ROUTING — when to delegate

| Trigger | Delegate to |
|---|---|
| Heavy JS bundle / source maps / SPA analysis | `js-recon-agent` |
| SQLi signals (errors, time-based, ORDER BY) | `sqli-hunter-agent` |
| Reflected/DOM/stored XSS sinks | `xss-hunter-agent` |
| Business logic / workflow / payment / coupon | `blf-hunter-agent` |
| LLM/AI feature on the target | `prompt-injection-hunter-agent` |
| Full chain spanning many bug classes | `omni-killchain` |

For pure-unauth recon → exposure → CVE → secret → PoC, stay here.

---

## REFERENCE INDEX

- `references/top10-unauth.md` — **the manual playbook** for the 10 canonical unauth P1 classes (read this first)
- `references/recon-passive.md` — full passive recon one-liners and tool catalog
- `references/recon-active.md` — fingerprinting, port scan, JS harvest, manual exposure sweep (nuclei used only for confirmation)
- `references/subdomain-takeover.md` — dangling CNAME provider fingerprint catalog
- `references/exposed-services.md` — per-service unauth check + escalation
- `references/preauth-cves.md` — comprehensive pre-auth CVE catalog by product
- `references/cloud-storage.md` — S3/GCS/Azure bucket enumeration + abuse
- `references/secrets-recon.md` — GitHub/GitLab/Postman/Docker/npm secret hunting
- `references/dependency-confusion.md` — finding unclaimed internal packages
- `references/waf-origin-bypass.md` — origin IP discovery + CDN bypass
- `references/report-writing.md` — P1 report template + disclosure norms
- `references/wordlists.md` — curated wordlists for sensitive paths, panels, params

---

## TOOL CHECKLIST (install once)

```
subfinder amass chaos cero httpx naabu nmap nuclei katana gospider gowitness
gau waybackurls qsreplace gf ffuf feroxbuster dirsearch
trufflehog gitleaks noseyparker github-subdomains
git-dumper linkfinder jsluice retire
subzy subjack
aws-cli gsutil az pacu enumerate-iam
shodan censys-cli
```

## OPERATIONAL RULES (non-negotiable)

1. **Authorization first.** No active probing without confirmed scope.
2. **Rate-limit yourself.** Default ≤50 req/s, drop to 5 on first 429.
3. **No exfil beyond proof.** One record, one file, one config key.
4. **No prod disruption.** Never DoS, never delete, never write outside marker paths.
5. **Disclose responsibly.** Use the program's reporting channel; respect embargo.
6. **Never share credentials you found.** Even with the program — they handle it via the report.
