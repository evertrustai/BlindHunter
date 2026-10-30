---
name: sql-ninja
description: >
  Trained on 60+ real HackerOne SQLi reports + PortSwigger + OWASP + PayloadsAllTheThings.
  Multi-Agent SQL/NoSQL Injection Hunter for unauth + auth surfaces.
  Hunts blind, error-based, time-based, OOB, second-order, stacked, NoSQL.
  WAF bypass engine: HPP, HPF, comment injection, encoding, case mutation, buffer overflow.
  Outputs bounty-ready reports with curl PoC commands.
---

# sql-ninja — CLAUDE + SQL SKILL = TRIAGE + BOUNTY

## ⚠️ AUTHORIZED USE ONLY
For assets you own or have explicit written permission to test. Unauthorized access is illegal.

## Overview
`sql-ninja` orchestrates 4 specialized agents trained on 60+ real HackerOne SQLi disclosures:

1. **Recon-Agent**: Maps endpoints, parameters, auth surfaces (cookies, JWT, headers), WAF fingerprinting
2. **Fuzzer-Agent**: Injects 500+ payloads — general, DB-specific, NoSQL, WAF bypass variants
3. **Validator-Agent**: Differential retesting, time-based statistics, OOB confirmation, secondary queries
4. **Reporter-Agent**: Generates bounty-quality reports with curl PoC commands

## Training Data Sources (60+ Real Reports)
```
531051 297478 868436 819738 811111 816254 758654 383127 881901 786044
403616 761304 781205 962889 592400 894325 1044716 745938 711075 363815
549355 273946 2051931 816086 777693 295841 435066 1039315 1224660 818972
2958619 1046084 1044698 3578842 824307 3249794 1525200 768195 816560 1842674
923020 2633959 1069561 1109311 2312334 795291 3198980 3292573 2209130 150156
3395221 2737595 365011 790005 687908 1893800 1104120 790914 390879 1042746
```

## Research References Baked In
- PortSwigger SQLi Cheat Sheet / Blind / UNION / OAST
- PayloadsAllTheThings (MySQL, MSSQL, PostgreSQL, Oracle, SQLite, NoSQL)
- OWASP WAF Bypassing Guide (HPP, HPF, normalization bypass)
- SQLmap Tamper Scripts wiki
- Orange Tsai chained SQLi research
- AssetNote PDO prepared statement bypass (CVE-2025)

## Attack Surface Types
| Surface | Description |
|---------|-------------|
| **Unauthenticated** | Public endpoints: search, product listing, login, contact forms |
| **Authenticated** | Dashboard, profile, settings, API with cookies/JWT/Bearer |
| **Headless** | JSON body params, GraphQL queries, REST API payloads |
| **Cookie-based** | Session cookies, tracking cookies, remember-me tokens |
| **Header-based** | User-Agent, Referer, X-Forwarded-For, Accept-Language |

## Injection Classes Covered
- In-band: UNION, error-based (EXTRACTVALUE, CAST, CONVERT)
- Blind boolean: conditional responses, conditional errors
- Blind time-based: SLEEP, WAITFOR, pg_sleep, BENCHMARK, heavy queries
- Out-of-band (OAST): DNS exfil, HTTP exfil
- Stacked queries: `;` separator
- Second-order: stored payloads triggered later
- NoSQL: MongoDB `$where`, `$gt`, `$regex`, `$ne`
- PDO prepared statement bypass (CVE-2025)
- BigQuery / Cassandra / DB2 / SQLite specific

## WAF Bypass Techniques
| # | Technique | Examples |
|---|-----------|----------|
| 1 | Comment injection | `un/**/ion+se/**/lect` |
| 2 | Case mutation | `UnIoN SeLeCt` |
| 3 | Double encoding | `%2555nion` |
| 4 | HTTP Parameter Pollution (HPP) | `?id=1/*&id=*/union/*&id=*/select` |
| 5 | HPF (Parameter Fragmentation) | `?a=1+union/*&b=*/select+1,2` |
| 6 | Whitespace substitution | `%09`, `%0A`, `%0B`, `%0C`, `%0D`, `%A0` |
| 7 | Buffer overflow | Long junk prefix to crash WAF parser |
| 8 | Null byte injection | `%00` |
| 9 | Unicode normalization | `%CA%BA` → `"`, `%CA%B9` → `'` |
| 10 | Scientific notation | `1e1` instead of `10` |
| 11 | No commas | `LIMIT 1 OFFSET 0`, `JOIN` instead of `,` |
| 12 | No spaces | Parentheses wrapping, `%09`, `%0A` |
| 13 | No equals | `LIKE`, `IN`, `BETWEEN`, `REGEXP` |
| 14 | Hex obfuscation | `0xHEX`, `unhex()`, `char()` |

## Quickstart
```bash
# With auth (cookies)
/cm-start "Run sql-ninja on https://target.com with cookie 'session=abc123' targeting auth endpoints"

# Without auth
/cm-start "Run sql-ninja on https://target.com"

# Specific endpoint
/cm-start "Run sql-ninja on https://target.com/api/search?q=test method=POST body='{\"query\":\"test\"}'"

# NoSQL target
/cm-start "Run sql-ninja on https://target.com/api/users method=GET with JWT 'Bearer eyJ...' targeting NoSQL injection"
```

## Workflow
```
Recon ──► Fuzzer ──► Validator ──► Reporter
  │          │            │            │
  ├─ Endpoints         ├─ 500+ payloads   ├─ Diff retest     ├─ curl PoC
  ├─ Params            ├─ Per-DBMS        ├─ Time stats      ├─ Screenshot cmds
  ├─ Auth surface      ├─ Per-WAF bypass  ├─ OOB check       ├─ Impact
  ├─ WAF fingerprint   ├─ Auth variants   ├─ 2nd order check ├─ Remediation
  └─ DB fingerprint    └─ NoSQL           └─ PDO check       └─ References
```

## Agent Prompts
- Recon: `prompts/recon.md`
- Fuzzer: `prompts/fuzzer.md`
- Validator: `prompts/validator.md`
- Payloads: `references/payloads.yaml`

## ⚠️ Common False Positive: WordPress LIKE Search
`?s=` (WordPress search) uses `LIKE '%input%'`. Injecting a quote changes the search string — different response sizes from `1=1` vs `1=2` just mean different search terms matched different posts, NOT SQL injection. The Validator-Agent's Section I tests for this specifically using gibberish + identical search text.
