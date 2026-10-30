---
name: subdomain-takeover
description: "Multi-Agent Subdomain Takeover & S3 Bucket Hunter. Enumerates dangling CNAMEs, verifies with dig/subzy, checks S3 buckets, GitHub Pages, Azure, Heroku, CloudFront, and 30+ services. Uses can-i-take-over-xyz fingerprints, HackerOne disclosed reports, and Medium research. Zero false positives — every finding is triple-verified."
---

# 🎯 subdomain-takeover: Subdomain & Cloud Resource Takeover Hunter

## ⚠️ WARNING: AUTHORIZED USE ONLY
This skill is for security research on assets you **own** or have **explicit written authorization** to test. Unauthorized access is illegal under CFAA and international computer fraud laws.

---

## Overview

`subdomain-takeover` orchestrates **four specialized agents** to perform comprehensive subdomain takeover and S3 bucket takeover detection with **zero false positives**:

| Agent | Role | Tools |
|-------|------|-------|
| **Recon-Agent** | Enumerate subdomains, discover CNAME chains, identify cloud resources | `dig`, `curl`, `host`, DNS analysis |
| **Fingerprint-Agent** | Match responses against 30+ service fingerprints from can-i-take-over-xyz | HTTP probing, response matching |
| **S3-Hunter-Agent** | Dedicated S3/CloudFront bucket takeover detection and verification | `curl`, `dig`, AWS endpoint checks |
| **Validator-Agent** | Triple-verify every finding, generate PoC-ready report | `dig`, `curl`, `subzy`, manual checks |

---

## Usage

When the user asks to check for subdomain takeover vulnerabilities:

```
"Run subdomain-takeover on target.com"
"Check if *.example.com has any dangling CNAMEs"
"Scan subdomains.txt for subdomain takeover"
"Check S3 bucket takeover on assets.target.com"
```

---

## 🔄 Complete Workflow

### Phase 1: Reconnaissance (Recon-Agent)
**Read**: `prompts/recon.md`

1. **Input Collection**: Accept target domain, subdomain list, or single subdomain
2. **CNAME Enumeration**: For each subdomain, run:
   ```bash
   dig CNAME <subdomain> +short
   dig A <subdomain> +short
   dig NS <subdomain> +short
   ```
3. **CNAME Chain Resolution**: Follow full CNAME chains to identify the ultimate destination
4. **Cloud Provider Identification**: Match CNAME destinations against known cloud provider patterns:
   - `*.s3.amazonaws.com` / `*.s3-website-*.amazonaws.com` → AWS S3
   - `*.cloudfront.net` → AWS CloudFront  
   - `*.azurewebsites.net` / `*.azure-api.net` / `*.cloudapp.azure.com` → Azure
   - `*.github.io` / `*.githubusercontent.com` → GitHub Pages
   - `*.herokuapp.com` → Heroku
   - `*.shopify.com` → Shopify
   - `*.pantheonsite.io` → Pantheon
   - `*.ghost.io` → Ghost
   - `*.myshopify.com` → Shopify
   - `*.wordpress.com` → WordPress
   - `*.surge.sh` → Surge
   - `*.bitbucket.io` → Bitbucket
   - `*.ghost.io` → Ghost
   - `*.helpjuice.com` → Helpjuice
   - `*.helpscoutdocs.com` → HelpScout
   - `*.feedpress.me` → Feedpress
   - `*.freshdesk.com` → Freshdesk
   - `*.zendesk.com` → Zendesk
   - `*.statuspage.io` → Statuspage
   - `*.tumblr.com` → Tumblr
   - `*.fly.dev` → Fly.io
   - `*.vercel.app` / `*.now.sh` → Vercel
   - `*.netlify.app` / `*.netlify.com` → Netlify
   - `*.render.onrender.com` → Render
   - `*.pages.dev` → Cloudflare Pages
   - `*.trafficmanager.net` → Azure Traffic Manager
   - `*.elasticbeanstalk.com` → AWS Elastic Beanstalk
   - `*.awsglobalaccelerator.com` → AWS Global Accelerator

5. **Output**: Structured JSON of all subdomains with their CNAME chains and identified providers

---

### Phase 2: Fingerprint Matching (Fingerprint-Agent)
**Read**: `prompts/fingerprint.md` and `references/fingerprints.yaml`

1. **HTTP Probing**: For each subdomain with a CNAME pointing to a cloud provider:
   ```bash
   curl -sIL -o /dev/null -w "%{http_code}" https://<subdomain>
   curl -sL https://<subdomain> 2>/dev/null | head -100
   ```
2. **Fingerprint Matching**: Compare HTTP response body/headers against the fingerprint database in `references/fingerprints.yaml`
3. **Vulnerability Classification**:
   - **VULNERABLE**: Response matches a known takeover fingerprint AND the service is confirmed exploitable per can-i-take-over-xyz
   - **POTENTIAL**: Response indicates missing resource but service has mitigations (e.g., domain verification)
   - **EDGE_CASE**: Ambiguous response, needs manual validation
   - **NOT_VULNERABLE**: Resource exists and is claimed

4. **Output**: List of subdomains with matched fingerprints and vulnerability classification

---

### Phase 3: S3 & Cloud Bucket Hunting (S3-Hunter-Agent)
**Read**: `prompts/s3_hunter.md` and `references/s3_patterns.yaml`

1. **S3 Bucket Discovery**:
   - Check CNAME records pointing to `*.s3.amazonaws.com`
   - Check for `NoSuchBucket` XML response:
     ```xml
     <Code>NoSuchBucket</Code>
     ```
   - Verify bucket name availability
   
2. **CloudFront Distribution Check**:
   - Check for orphaned CloudFront distributions
   - Look for `Bad Request` or custom error pages
   
3. **Azure Blob Storage**:
   - Check `*.blob.core.windows.net` endpoints
   - Look for `BlobNotFound` or `ContainerNotFound` errors

4. **Region Detection** (for S3):
   ```bash
   # Extract region from CNAME
   dig CNAME <subdomain> +short
   # If CNAME contains region: s3-website-us-east-1.amazonaws.com
   # Or check via curl headers
   curl -sI https://<subdomain> 2>/dev/null | grep -i 'x-amz-'
   ```

5. **GitHub Repository Takeover Check**:
   - If CNAME points to `*.github.io`, check if the GitHub user/org exists
   - If user/org is deleted, the subdomain is takeover-able
   ```bash
   curl -sI https://github.com/<username> | head -1
   ```

6. **Output**: Detailed findings for each cloud resource with evidence

---

### Phase 4: Validation & Reporting (Validator-Agent)
**Read**: `prompts/validator.md`

**Triple Verification Process:**

1. **DNS Verification** (Check 1):
   ```bash
   dig CNAME <subdomain> +short +trace
   dig A <subdomain> +short
   host <subdomain>
   ```
   - Confirm CNAME still points to unclaimed resource
   - Verify DNS propagation is consistent

2. **Subzy Verification** (Check 2):
   ```bash
   # Create temp file with target
   echo "<subdomain>" > /tmp/takeover_targets.txt
   subzy run --targets /tmp/takeover_targets.txt --timeout 15
   ```
   - Cross-reference subzy output with manual findings
   - If subzy confirms → strong signal
   - If subzy misses but manual check found it → document fingerprint gap

3. **Manual HTTP Verification** (Check 3):
   ```bash
   # Check HTTP response
   curl -sL -D - https://<subdomain> 2>/dev/null
   # Check with different User-Agents
   curl -sL -H "User-Agent: Mozilla/5.0" https://<subdomain> 2>/dev/null
   # Check both HTTP and HTTPS
   curl -sL http://<subdomain> 2>/dev/null | head -50
   curl -sL https://<subdomain> 2>/dev/null | head -50
   ```

4. **False Positive Elimination**:
   - If the service has **domain verification** (e.g., TXT record requirement) → mark as `NOT_EXPLOITABLE`
   - If the service has **been patched** against takeover → mark as `MITIGATED`
   - Cross-reference with `references/not_vulnerable_services.yaml` for services that have fixed the issue
   - Check can-i-take-over-xyz current status for each service

5. **Report Generation**: Use template from `templates/report.md`

---

## 📁 Skill File Structure

```
subdomain-takeover/
├── SKILL.md                              # This file - main instructions
├── prompts/
│   ├── recon.md                          # Recon-Agent system prompt
│   ├── fingerprint.md                    # Fingerprint-Agent system prompt
│   ├── s3_hunter.md                      # S3-Hunter-Agent system prompt
│   └── validator.md                      # Validator-Agent system prompt
├── scripts/
│   ├── cname_checker.sh                  # Batch CNAME enumeration script
│   ├── s3_bucket_checker.sh              # S3 bucket existence checker
│   ├── fingerprint_matcher.sh            # HTTP fingerprint matching
│   └── verify_takeover.sh               # Final verification pipeline
├── references/
│   ├── fingerprints.yaml                 # 30+ service fingerprint database
│   ├── s3_patterns.yaml                  # S3/CloudFront/Azure patterns
│   ├── not_vulnerable_services.yaml      # Services that have been patched
│   ├── hackerone_reports.yaml            # Disclosed HackerOne report references
│   └── cname_providers.yaml             # CNAME-to-provider mapping database
└── templates/
    └── report.md                         # Bug bounty report template
```

---

## 🔧 Tool Requirements

The following tools should be available on the system:
- `dig` - DNS lookups (part of `dnsutils` / `bind-utils`)
- `curl` - HTTP requests
- `host` - DNS resolution
- `subzy` - Automated subdomain takeover checker (optional but recommended)
- `jq` - JSON processing (for script outputs)

If `subzy` is not installed, the skill will still work using manual verification with dig + curl + fingerprint matching.

---

## 📊 Severity Classification

| Scenario | Severity | CVSS Range |
|----------|----------|------------|
| S3 bucket takeover (serves JS/CSS for main domain) | **Critical** | 9.0-9.8 |
| S3 bucket takeover (standalone assets) | **High** | 7.0-8.5 |
| GitHub Pages takeover | **High** | 7.0-8.0 |
| CloudFront distribution takeover | **High** | 7.0-8.5 |
| Azure App Service takeover | **High** | 7.0-8.0 |
| Heroku app takeover | **Medium-High** | 6.0-7.5 |
| Generic service takeover | **Medium** | 5.0-7.0 |
| Service with domain verification | **Informational** | N/A |

---

## 📚 Research Sources

This skill's methodology is built from:
1. **[EdOverflow/can-i-take-over-xyz](https://github.com/EdOverflow/can-i-take-over-xyz)** - Primary fingerprint database
2. **HackerOne Disclosed Reports** - See `references/hackerone_reports.yaml`
3. **OWASP Testing Guide** - Subdomain takeover methodology
4. **Medium/InfoSec Write-ups** - Community research and techniques
5. **Subzy fingerprint database** - Cross-referenced with manual findings

---

## ⚡ Quick Start Agent Instructions

When this skill is activated, the orchestrating agent MUST:

1. **Read all four agent prompts** from `prompts/` directory
2. **Load the fingerprint database** from `references/fingerprints.yaml`
3. **Define four subagents** matching the agent roles above
4. **Execute in sequence**: Recon → Fingerprint → S3 Hunter → Validator
5. **Generate final report** using `templates/report.md`

### Agent Definition Pattern:
```
1. Define "Recon-Agent" → runs cname_checker.sh, outputs subdomain map
2. Define "Fingerprint-Agent" → matches HTTP responses against fingerprints.yaml
3. Define "S3-Hunter-Agent" → deep-dives into S3/CloudFront/Azure buckets
4. Define "Validator-Agent" → triple-verifies, runs subzy, generates report
```

Each agent passes its output to the next agent in the pipeline. The final Validator-Agent produces the report artifact.
