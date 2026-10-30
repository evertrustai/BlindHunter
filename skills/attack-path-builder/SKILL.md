---
name: attack-path-builder
description: "Chains low/medium findings into critical attack paths (ATO, privesc, data breach, business logic bypass). One verified chain beats 10 standalone lows. Must pass Chain Gate: each step independently verified, chain is technically necessary."
---

# ATTACK PATH BUILDER — Dynamic Chain Discovery

## DYNAMIC CHAIN DISCOVERY (not template matching)

After each finding, apply this discovery process:

### Step 1: Classify finding capabilities
```
[Read]  = Can read resource X (data, PII, tokens, keys)
[Write] = Can write/create/modify resource Y
[Delete]= Can delete resource Z
[Auth]  = Can bypass auth on endpoint E
[Info]  = Know secret/key/token/email K
[Time]  = Can influence timing/race on operation T
```

### Step 2: Map A→B connections
For each capability, ask: "What endpoint does this give me access to?"

| Have This Capability | Can Enable This Attack | If... |
|---------------------|----------------------|-------|
| [Read] user_email | [Write] password_reset → reset their password | Reset doesn't verify email ownership |
| [Read] user_id list | [Read] user profile of ANY user | No ownership check on profile |
| [Info] API key | [Auth] on any endpoint | Key is not scoped to specific actions |
| [Auth] on user-level | [Auth] on admin endpoints | Same auth mechanism, no role check |
| [Write] to user profile | [Write] stored XSS payload | Profile content rendered without sanitization |
| [Read] session token | [Read] authenticated endpoints as victim | Token not bound to IP/user-agent |
| [Time] race on withdraw | [Write] double balance drain | No atomicity on balance operations |
| [Info] internal URL | [Read] internal services (SSRF) | URL fetching lacks allowlist |
| [Read] OAuth code | [Read] user's primary account (ATO) | Code is not bound to PKCE/state |
| [Write] coupon create | [Read] unlimited discount | No usage limit on created coupons |

### Step 3: Dynamic chain template
```yaml
chain_id: "auto-generated"
findings:
  - id: "FIND-001" | type: "IDOR" | output: "user_email, user_id"
  - id: "FIND-002" | type: "Missing_OTP" | input: "user_email" | endpoint: "POST /api/change-email"
chain_logic: "FIND-001 leaks victim's email → FIND-002 uses it to change email without OTP → password reset goes to attacker email → ATO"
dependency: "FIND-001→FIND-002: FIND-002 uses FIND-001's leaked email as input"
preconditions: "FIND-001 must target same victim as FIND-002"
combined_cvss: "recalculated for combined path"
verdict: "test end-to-end from zero state"
```

### Step 4: Chain templates by outcome (reference only, not copy-paste)

**ATO**: weak password reset + email-change IDOR + session persistence · open redirect + OAuth token theft + missing state · subdomain takeover + wide cookie scope + missing HttpOnly · stored XSS + admin session + no CSP.
**PrivEsc**: mass assignment on role field + no server check · IDOR exposing admin API key + key reuse · weak JWT secret + forged role claim.
**Data Breach**: RLS/authz bypass + no row limit → mass PII · open storage bucket + JS-bundle URL → credential leak · IDOR on admin export + no rate limit → full DB dump.
**Business Logic**: negative price + no validation + unlimited quantity → free goods · race on coupon + no idempotency → infinite discount · trial bypass + no payment check → premium free.
**Modern (2024-2026)**: web cache deception → token/PII theft · client-side path traversal → 1-click ATO · postMessage XSS + OAuth code + wildcard origin → code theft · prototype pollution → DOM XSS · host-header poisoning → 0-click ATO · GraphQL alias OTP brute force · blind SSRF + gopher → Redis → internal RCE · self-XSS + login/logout CSRF + cookie fixation → forced stored XSS.

## WEAK CHAIN KILL SIGNALS

Kill a chain candidate when:
- Two findings share the same root cause (fixing one fixes both → not a chain)
- A required precondition is impractical (requires admin access, requires user to be logged in, etc.)
- Chain steps are not independently verified (each step must have its own evidence)
- Removing any link still achieves the same impact (not a true chain)
- Impact with chain is same as standalone finding (no escalation)
- Requires >2 high-effort preconditions from attacker
- Chain step relies on race window < 50ms (unrealistic)

## Missing-link finder
| You have | Need | How |
|----------|------|-----|
| IDOR on objects | Admin user ID | Enumerate /users API |
| XSS on profile | CSRF token leak | Check DOM for token |
| Open redirect | OAuth callback | Trace OAuth flow |
| Weak JWT | Role escalation | Decode; test none-alg |
| Subdomain takeover | Cookie scope | Check cookie.domain |
| Blind SQLi | OOB channel | Burp Collaborator |
| SSRF | Internal service | Scan localhost ports |
| Race condition | State machine | Find state-changing request |

## Validation
Every step independently reproducible · works from zero state · final impact measurable · real-world exploitable · single point of failure (remove any link → chain breaks).

## Prioritization
High reward + low effort → first. High reward + high effort → on high-value target. Low reward + high effort → skip. Good chain moves CVSS from 4.0-6.9 → 8.0-10.0.

## Chain false positives
| Pattern | Verify |
|---------|--------|
| XSS + CSRF token in DOM | Check SameSite=Strict/Lax |
| IDOR + missing rate limit | Focus on data access, not speed |
| CORS + XSS | Check auth storage (cookie vs localStorage) |
| Open redirect → phishing | Only chain if zero user interaction |
| Race with tiny window | Need ~100ms+ realistic window |
| Two findings same root cause | If fixing one fixes both, merge |

## Real disclosed examples
- IDOR → ATO ($3k): enumerate admin ID → predictable reset token → set admin password. CVSS 4.0+5.0→9.0.
- SSRF → cloud metadata → credentials ($2.5k): PDF generator → 169.254.169.254 → AWS keys → S3. CVSS 5.0+3.0→8.0.
- Race + IDOR → free shopping ($5k): coupon 10x concurrent → race wins → IDOR changes order. CVSS 5.0+4.0→8.5.
- Open redirect + OAuth → ATO ($1.5k): phishing link through redirect → missing state → token theft. CVSS 3.0+5.0→7.5.
- Subdomain takeover + cookie scope → session hijack ($2k): claimed subdomain sets parent-domain cookies. CVSS 5.0+2.0→8.0.

## Priority scoring template
```yaml
chain_id: "IDOR-RACE-ATO"
findings:
  - A: IDOR on /api/orders (0.9, Med)
  - B: Race on refund (0.7, Med)
  - C: No rate limit on refund (0.95, Low)
chain_dependency: "if fixing A also fixes B, not a chain"
combined_cvss: "6.3 (recompute for combined path)"
verdict: "B confidence 0.7, race unconfirmed — gather evidence"
```

## Reporting template
```markdown
# Attack Chain: <name> → <impact>
**Chain Summary:** <A (sev)> → <B (sev)> → <Final (Critical)>
**Finding 1:** <name> | CVSS | PoC | Enables: <what feeds F2>
**Finding 2:** <name> | CVSS | PoC | Requires: <what it needs from F1>
**Combined Impact:** <final>, CVSS <score>, PoC (zero state), Business impact
**Why chain:** Each independently verified · F1 output is F2 input · neither alone achieves impact · removing any step breaks chain.
```
