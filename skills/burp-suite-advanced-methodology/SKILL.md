---
name: burp-suite-advanced-methodology
description: >
  Master Burp Suite Professional for comprehensive web application security testing. Use this skill
  when performing manual web application assessments with Burp Suite including proxy interception,
  Scanner automation, Intruder attacks, Repeater analysis, and extension integration. Covers
  advanced techniques like match-and-replace rules, macro authentication, Collaborator for OOB
  testing, and Turbo Intruder for high-speed fuzzing.
domain: cybersecurity
subdomain: penetration-testing
category: Web Application
difficulty: intermediate
estimated_time: "2-6 hours"
mitre_attack:
  tactics: [TA0043, TA0001]
  techniques: [T1190, T1595]
platforms: [linux, windows, macos]
tags: [burp-suite, web-pentest, proxy, scanner, intruder, repeater, web-security, bug-bounty]
tools: [burpsuite-pro, turbo-intruder, autorize, logger-plus-plus]
version: "1.0"
author: CyberSkills-Elite
license: Apache-2.0
---

# Burp Suite Advanced Methodology

## When to Use
- When performing manual web application penetration testing
- When proxying and modifying HTTP traffic for vulnerability testing
- When running automated scans with Burp Scanner
- When testing authentication, authorization, and business logic flaws
- When fuzzing parameters with Intruder or Turbo Intruder


## Prerequisites
- Authorized scope and rules of engagement for the target environment
- Appropriate tools installed on the attack/analysis platform
- Understanding of the target technology stack and architecture
- Documentation template ready for findings and evidence capture

## Workflow

### Phase 1: Project Setup & Scope Configuration

```
# Burp Suite Professional Setup:
1. Launch Burp Suite Professional
2. Create New Project → "Disk Project" (saves progress)
3. Configure Project Options:
   - Target → Scope → Add target URLs
   - Include in scope: *.target.com
   - Exclusions: *.google.com, *.gstatic.com, logout URLs

# Proxy Setup:
1. Proxy → Options → Listeners: 127.0.0.1:8080
2. Configure browser to use localhost:8080
3. Install Burp CA certificate:
   - Navigate to http://burpsuite
   - Download CA certificate
   - Install in browser's certificate store

# Recommended Extensions:
- Autorize (IDOR/AuthZ testing)
- Logger++ (enhanced logging)
- Turbo Intruder (high-speed fuzzing)
- Hackvertor (encoding/decoding)
- Active Scan++ (enhanced scanning)
- Param Miner (hidden parameter discovery)
- JS Miner (JavaScript analysis)
- JSON Web Token Attacker
```

### Phase 2: Passive Reconnaissance (Spidering)

```
# Let Burp build the sitemap:
1. Browse the entire application through Burp proxy
2. Log in with all user roles available
3. Click every link, fill every form
4. Check Site Map → shows discovered endpoints

# Target → Site map analysis:
- Right-click target → "Spider this host"
- Review discovered endpoints
- Identify: API endpoints, forms, file uploads, WebSocket connections
- Note: Hidden parameters, commented-out code, JavaScript endpoints

# Engagement tools:
- Target → Engagement tools → "Find comments"
- Target → Engagement tools → "Find scripts"
- Target → Engagement tools → "Analyze target"
```

### Phase 3: Active Testing with Repeater

```
# Repeater — manual request manipulation:
# Send interesting requests from Proxy → Right-click → "Send to Repeater"

# Common tests in Repeater:
# 1. Authentication bypass
#    Remove/modify Authorization header
#    Change user ID in request body/URL

# 2. IDOR testing
#    Modify object IDs: /api/users/123 → /api/users/124
#    Change GUIDs, encoded values

# 3. SQL Injection
#    Add ' " ; -- to parameters
#    Test: param=1' OR '1'='1

# 4. Command Injection
#    Add: ; ls, | whoami, `id`

# 5. SSRF
#    Change URL parameters to internal addresses
#    http://169.254.169.254/latest/meta-data/

# 6. Header manipulation
#    Add: X-Forwarded-For: 127.0.0.1
#    Add: X-Original-URL: /admin
#    Add: X-Rewrite-URL: /admin

# Tips:
# - Use Comparer to diff responses
# - Right-click → "Change request method" (GET↔POST)
# - Use "Follow redirect" to trace redirect chains
```

### Phase 4: Automated Testing with Intruder

```
# Intruder — automated parameter fuzzing:

# Positions tab: Mark injection points with § markers
# Attack types:
# - Sniper: One payload at a time, rotates through positions
# - Battering ram: Same payload in all positions
# - Pitchfork: Different payload list per position (parallel)
# - Cluster bomb: All combinations (cartesian product)

# Common Intruder attacks:

# 1. Directory bruteforce
#    Target: GET /§FUZZ§ HTTP/1.1
#    Payload: Wordlist (raft-medium-directories.txt)
#    Filter: Status code != 404

# 2. Credential stuffing
#    Target: POST /login
#    Type: Pitchfork
#    Position 1: §username§ → usernames list
#    Position 2: §password§ → passwords list

# 3. Parameter fuzzing
#    Target: GET /api/users?§param§=§value§
#    Type: Cluster bomb

# 4. IDOR enumeration
#    Target: GET /api/users/§1§
#    Payload: Numbers 1-10000
#    Grep extraction: Extract response fields

# Results analysis:
# Sort by: Length (different length = different response = interesting)
# Sort by: Status code
# Grep match: "admin", "password", "error"
```

### Phase 5: Turbo Intruder (High-Speed Fuzzing)

```python
# Extensions → Turbo Intruder → Send to Turbo Intruder

# Basic Turbo Intruder script:
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                          concurrentConnections=50,
                          requestsPerConnection=100,
                          pipeline=True)
    
    for word in open('/usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt'):
        engine.queue(target.req, word.rstrip())

def handleResponse(req, interesting):
    if req.status != 404:
        table.add(req)

# Race condition testing script:
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                          concurrentConnections=30,
                          requestsPerConnection=100,
                          pipeline=False)
    
    # Send 30 identical requests simultaneously
    for i in range(30):
        engine.queue(target.req, gate='race')
    
    engine.openGate('race')  # Release all at once

def handleResponse(req, interesting):
    table.add(req)
```

### Phase 6: Scanner Configuration

```
# Automated scanning:
# 1. Right-click target → "Actively scan this host"
# 2. Or select specific requests → "Do active scan"

# Scanner configuration (Dashboard → Scan):
# - Crawl settings: Max depth, form submission, login handling
# - Audit settings: Which vulnerability types to test
# - Resource pool: Control scan speed
# - Schedule: Time-based scanning

# Key scan types:
# - Crawl only: Discover endpoints without testing
# - Audit only: Test known endpoints for vulnerabilities
# - Crawl and audit: Full scan

# Results processing:
# - Dashboard → Issue activity: All findings
# - Sort by severity
# - Manually verify each finding (false positive check)
# - Generate report: Burp → Report wizard
```

## 🔵 Blue Team Detection
- **WAF rules**: Detect common Burp User-Agent strings and payloads
- **Rate limiting**: Detect rapid automated requests from Intruder/Scanner
- **Anomaly detection**: Alert on unusual parameter patterns (fuzzing signatures)
- **TLS inspection**: Detect MITM proxy certificates

## Key Concepts
| Concept | Description |
|---------|-------------|
| Proxy | Intercept and modify HTTP/HTTPS traffic |
| Repeater | Manual request modification and resending |
| Intruder | Automated Parameter fuzzing and brute forcing |
| Scanner | Automated vulnerability detection |
| Collaborator | Out-of-band interaction detection server |
| Turbo Intruder | High-performance HTTP fuzzer extension |
| Autorize | Authorization testing extension |

## Output Format
```
Burp Suite Assessment Report
==============================
Target: https://app.target.com
Scanner Findings: 3 High, 7 Medium, 12 Low, 5 Informational
Manual Findings: 2 Critical, 1 High

Custom Finding: SQL Injection in /api/search
  Method: POST /api/search?q=test
  Parameter: q
  Payload: ' OR 1=1--
  Evidence: Response contains all database records (5000+ items vs 3)
  Verified: Manually confirmed in Repeater
```

## 🛡️ Remediation & Mitigation Strategy
- **Input Validation:** Sanitize and strictly type-check all inputs.
- **Least Privilege:** Constrain component execution bounds.


## 📚 Shared Resources
> For cross-cutting methodology applicable to all vulnerability classes, see:
> - [`_shared/references/elite-chaining-strategy.md`](../_shared/references/elite-chaining-strategy.md) — Exploit chaining methodology and high-payout chain patterns
> - [`_shared/references/elite-report-writing.md`](../_shared/references/elite-report-writing.md) — HackerOne-optimized report writing, CWE quick reference
> - [`_shared/references/real-world-bounties.md`](../_shared/references/real-world-bounties.md) — Verified disclosed bounties by vulnerability class

## References
- PortSwigger: [Burp Suite Documentation](https://portswigger.net/burp/documentation)
- PortSwigger: [Web Security Academy](https://portswigger.net/web-security)
