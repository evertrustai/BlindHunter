---
name: web3hunter
description: "Web3 / smart contract bug bounty hunting. ALWAYS activate for: smart contract audit, smart contract bug bounty, audit a protocol, review contracts for vulnerabilities, DeFi exploit hunting, find critical/high bugs in Solidity, 'hunt this protocol', invariant-based auditing, Echidna/Medusa fuzzing, reentrancy/oracle/inflation-attack hunting, code4rena/Immunefi/Cantina/HackenProof target analysis, contest repo review, Solana (Rust) or Move (Aptos/Sui) audit, and ANY request to find exploitable vulnerabilities in blockchain code. Drives the full kill chain: recon → pre-audit scan (entry points, invariants, threat model) → parallel specialty attack agents → dedup + judging gates → PoC verification (forge/cast + Echidna/Medusa fuzz) → bounty report. Zero false positives: every finding confirmed with a working PoC."
---

# Web3Hunt

Smart contract bug bounty hunter. Built on the Pashov Audit Group methodology (x-ray pre-audit scan, 12-lens parallel audit, Echidna/Medusa fuzz verification) adapted to opencode tooling. Zero false positives — a finding without a PoC is a LEAD, not a finding.

## Pipeline Overview

```
Phase 0  Setup            clone, toolchain (foundry/echidna/medusa), deps, build gate
Phase 1  Recon            scope, chains, docs, git history, prior audits
Phase 2  Pre-audit scan   enumerate, entry points, invariants, threat model   → x-ray/ folder
Phase 3  Parallel hunt    12 specialty attack agents (subagents)              → findings+leads
Phase 4  Dedup + gates    merge, judging gates, lead promotion                → candidate findings
Phase 5  PoC verify       forge test / cast trace / Echidna/Medusa fuzz      → CONFIRMED
Phase 6  Report           impact-driven bounty report with PoC + fix
```

Track phases with todowrite. Exactly one phase `in_progress` at a time.

## Run Modes (user prompts — resolve once at start)

| Prompt | Runs |
|---|---|
| `run an x-ray on the codebase` | Phases 0–2 only → stop. Deliverable: `x-ray/` folder. |
| `run the solidity auditor ... on <specified files>` | Phases 0–1 (setup + recon scoped), then Phase 3 on ONLY those files, 4–6. Scope table and entry-point list limited to the files; still write x-ray/ for them. |
| `run fizz on the codebase` | Standalone fuzz-suite generation (below), then Phases 5c/6-style verification only. |

Default = full pipeline (Phases 0–6). A prompt naming specific files (`*specified files*`) overrides scope; a prompt naming a single skill (x-ray / fizz) overrides pipeline length.

### Fizz mode (standalone fuzz suite)

Generate a stateful invariant suite under `test/fizz/` (+ metadata under `fizz_data/`), reusing the repo's existing deployment flow, and run a real campaign:

1. Phase 0 tooling gate (forge + at least one fuzzer; install medusa/echidna if missing — they are REQUIRED here, no read-only fallback).
2. `forge build` must pass; stop otherwise and report the blocker.
3. Extract the protocol's invariants from Phase 1 docs + Phase 2d synthesis, then write Foundry invariant tests for smoke/debug plus Echidna/Medusa harnesses (`handler`-based, one handler per actor; bound all `msg.sender`s; initialize from the repo's real deploy scripts).
4. Run campaigns: Echidna ≥ 2 min (or 100k+ calls), Medusa ≥ 2 min — or 3 coverage-extension cycles if time allows. Collect every broken property into `fizz_data/results.md` with the call sequence.
5. Broken invariant → promote to a candidate finding → Phase 4 gates → Phase 5c confirmation → Phase 6 report. A suite with zero breaks is still a deliverable: report the covered invariants + coverage as evidence.

## Phase 0 — Repo & Toolchain Setup (do FIRST)

1. **Foundry check** (EVM targets):
   ```bash
   forge --version || (curl -L https://foundry.paradigm.xyz | bash && foundryup)
   ```
2. **Target checkout** — if not already local, clone the EXACT scoped commit/branch the program pins (contest repos name it in README; bounties pin a commit):
   ```bash
   git clone <repo-url> <dir> && cd <dir>
   git checkout <scoped-commit-or-branch>
   git rev-parse HEAD   # verify against scoped commit
   ```
   Shallow clone is fine for read-only audits: `git clone --depth 1 --branch <b>`.
3. **Dependencies** — Foundry repos: `forge install --no-git` (or `forge install`); Hardhat repos: `npm install`. Note missing deps; do NOT block on failures unless the PoC needs execution.
4. **Build gate** — `forge build` must compile. Compile failure → audit proceeds read-only with the failure noted; PoC phase (5b) requires a working build.
5. **Fuzz tooling** (needed in Phase 5c) — verify and install if missing:
   ```bash
   echidna --version  || curl -L https://github.com/crytic/echidna/releases/latest/download/echidna-x86_64-linux.tar.gz | tar xz  # or: cargo install echidna
   medusa version     || go install github.com/crytic/medusa@latest
   ```
6. **RPC for fork tests** — if the user provided a `.env`/RPC URL, wire it (RPC_URL + chain id); else default to a public archive RPC at fork time. Never write secrets into reports.
7. **Non-EVM targets** — Solana: `cargo build` inside `programs/` (or `anchor build` if Anchor present); Move: `aptos move compile` / `sui move build`. Toolchain missing → fall back to pure static audit and say so.

Environment note: report which tools were present vs installed vs missing at the top of the final report — reviewers trust explicit setup state.

## Phase 1 — Recon (fast, read-only)

1. Identify stack: framework (`foundry.toml` / `hardhat.config.*`), Solidity version, src dir (`src=` in foundry.toml, else `contracts/`/`src/`).
2. Read `README.md` / spec / whitepaper docs (skip tutorials): extract doc-stated invariants, actors, trust assumptions, economic properties. Tag all claims `(per spec)` — never treat as code-verified.
3. Git history: `git log --oneline -30`, look for recent fixes near money functions ("fix: ... rounding", "prevent ...", "security"), unmerged TODOs, old audit remediation commits. Shallow/squashed clone → skip, note it.
4. Prior audits / contest READMEs: note what the auditors ALREADY covered so you hunt the seams instead.
5. Build the scope table: contract → subsystem → nSLOC. Skip `interfaces/`, `lib/` (vendored), `mocks/`, `test/`.

## Phase 2 — Pre-audit scan (x-ray pass)

Read `references/x-ray/templates.md` (output templates) and `references/x-ray/threats.md` (threat catalog by protocol type) — ported from pashov's x-ray — and follow them.

### 2a. Enumerate & measure
```bash
mkdir -p x-ray
grep -rnE 'function[[:space:]]+[[:alnum:]_]+[[:space:]]*\([^)]*\)[[:space:]]+(external|public)' <src>/ --include='*.sol' | grep -v '/interfaces/' | grep -v '/mocks/'
grep -rnE '^[[:space:]]*\)[[:space:]]+(external|public)' <src>/ --include='*.sol' -B5   # multiline sigs
```
Skip view/pure. Grep scan is the hard gate — the permissionless-entry-point list in your report MUST match it, not subagent memory.

### 2b. Read & extract per contract
For each in-scope file (direct reads if ≤20 files; subagents per subsystem if more), extract:
- **Delta writes**: per non-view function, `Δ(var) = ±expr` pairs in the same function body (e.g. `Δ(totalSupply) = +shares`, `Δ(balanceOf[msg.sender]) = +shares`).
- **Guard predicates**: every `require`/`assert`/`if-revert` referencing storage, verbatim + line.
- **Enum/one-shot transitions**: `require(var == X); ...; var = Y` recorded as `X@Ln → Y@Lm`. Skip togglable flags (a counterpart flips it back).
- **External calls + return value use**, fund flows (deposit/withdraw/mint/burn), role modifiers, reentrancy guards.

### 2c. Entry point classification
Classify each entry point: **permissionless** (verify body: no modifier AND no `msg.sender` check — `acceptOwnership`-style pending-address checks are role-gated, not permissionless), **role-gated** (modifier or internal sender check), **admin-only**. Record: caller, params trust level `(user-controlled|user-signed|keeper-provided|protocol-derived)`, state modified, value flow, reentrancy guard.

### 2d. Invariant synthesis (high-signal pass)
Walk this taxonomy over the extraction:

1. **Conservation**: matched `Δ(A)=+e` / `Δ(B)=-e` pairs → `A == Σ B[k]` candidates. Also NEGATIVE conservation: a flow that ought to track (flashloan pull/push) with zero storage Δ is itself a finding signal.
2. **Guard lift** (the money-maker): for each storage guard, ask "does this imply a property that must hold across ALL calls?" If yes → Grep ALL write sites of the constrained variable. All sites enforce it → On-chain=Yes. ANY site writes without the guard → **On-chain=No — that gap is simultaneously an invariant violation AND a bug candidate.**
3. **Ratio**: `A = B * C / D` writes — note snapshot ordering (before/after other writes in same function).
4. **State machine**: one-shot latches and cyclic states from 1b.
5. **Temporal**: `block.timestamp`/`block.number` vs storage — checked-then-updated (safe) vs updated-then-checked (stale read risk).
6. **Cross-contract**: external call return value used in arithmetic → find callee's write sites; if callee can change it independently, the assumption is unvalidated.
7. **Economic derivation**: combine 1-6 into higher-order properties, cite source IDs.

**Verification gate**: cannot verify a candidate from code you've read → drop the row. "Could not verify" is not a row.

### 2e. Threat model
Protocol-type profile (AMM / lending / vault / governance / bridge / NFT / perp / yield):
- **AMM/DEX**: rounding, sqrt math, fee-on-transfer tokens, price manipulation via reserves, LP inflation, swap-fee accounting, donation attacks.
- **Lending**: oracle manipulation, bad-debt accounting, liquidation incentive math, interest accrual rounding, collateral factor misuse.
- **Vault/4626**: inflation attack (first-depositor), share rounding (deposit 1 wei), donate-to-inflate, malicious recovery.
- **Governance**: malicious proposal, quorum bypass, vote replay, delegation logic, timelock escape.
- **Bridge**: fake proof, replay across chains, fee/amount mismatch, pause bypass.
- **Perp**: oracle lag, funding rate math, leverage rounding, liquidation thresholds.
- **Cross-cutting**: reentrancy (incl. ERC-777/ERC-1155 hooks, flashloan reentrancy), access control gaps, signature replay/chain-ID/domain-separator issues, unchecked arithmetic (pre-0.8), tx.origin, delegatecall, storage collisions, selfdestruct, low-level call return values ignored, price staleness, admin backdoors (funds-extracting setters), rounding direction (floor vs ceil, dust accumulation), integer overflow in token decimals mismatches.

Centralization: list every privileged action, note timelock/multisig presence (role-transfer delay ≠ operational delay), flag which actions can extract user funds. Missing pause on a fund function worsens the role-compromise scenario — fold into the relevant attack surface, never a standalone section.

Write outputs to `x-ray/` (see Phase 2 output template below). Keep factual, no fabrication, "could not determine" when uncertain.

## Phase 3 — Parallel hunt (12 attack lenses)

Spawn agents in parallel with the Task tool (`subagent_type: general`). Each agent gets: the source files (path list — agents read their own files), this skill's lens, and the extraction from Phase 2. Tell agents: findings = file+function + root cause (one sentence) + minimal fix + concrete proof. Without proof → LEAD (honest calibration, still report it).

Lenses: each agent MUST read its full prompt from `references/hacking-agents/<lens>-agent.md` (12 files + shared-rules.md — these ARE the agent instructions) and follow it exactly. The one-line summaries below are only for lens selection/assignment:

1. **Math precision** — `math-precision-agent.md`
2. **Access control** — `access-control-agent.md`
3. **Economic security** — `economic-security-agent.md`
4. **Execution trace** — `execution-trace-agent.md`
5. **Invariant violation** — `invariant-agent.md` — take Phase 2d invariants, attack the On-chain=No rows first; each On-chain=Yes row — prove a call sequence that breaks it; state machine escapes; conservation breakers.
6. **Periphery** — `periphery-agent.md`
7. **First principles** — `first-principles-agent.md`
8. **Asymmetry** — `asymmetry-agent.md`
9. **Boundary** — `boundary-agent.md`
10. **Numerical gap** — `numerical-gap-agent.md`
11. **Trust gap** — `trust-gap-agent.md`
12. **Flow gap** — `flow-gap-agent.md`

Each subagent gets: (a) the path to its agent file, (b) `references/hacking-agents/shared-rules.md` path, (c) the source file path list, (d) Phase 2 extraction. Agents read those files themselves.

Max 2 leads per lens per contract — quality over quantity. Dedup is the orchestrator's job.

## Phase 4 — Dedup + judging gates

Read `references/judging.md` and follow it as the authoritative gate procedure (this section is the condensed gate summary):

1. **Dedup**: group by (Contract, function). Same function with distinct mechanisms = distinct findings — never merge away a mechanism. Fixes: if ≥2 distinct fixes, present as Options.
2. **Judging gates** (each finding, fixed order, one pass, no revisit):
   - G1 **Reachability**: is the vulnerable path callable by anyone, or does it require admin/luck? What does the code ALLOW, not what the deployer intends.
   - G2 **Impact**: does it move/steal/lock funds, or only grief? No fund impact + no direct user harm = N/A (except gas-griefing in niche cases — usually reject).
   - G3 **Exploitability**: is the trigger feasible (flashloan, MEV bot, single tx, oracle mismatch)? Does a sandwitch/arbitrage path exist?
   - G4 **Duplication vs design**: would a reasonable auditor call this a bug, or is it documented design?
   - Verdict: `BLOCKS` (kill) / `ALLOWS` (keep) / `UNCERTAIN` (= ALLOWS). `UNCERTAIN` commits — no re-examination.
3. **Lead promotion**: LEAD → FINDING if full exploit chain visible in source, or ≥2 lenses independently hit the same seam. `UNCERTAIN` execution → demote to LEAD.

## Phase 5 — PoC verification (HARD requirement)

Every finding gets a working PoC before report. Zero exceptions.

### 5a. Fast trace (no repo build needed)
```bash
forge create / cast call / cast send --rpc-url <rpc> --private-key ...
cast trace <tx>  # for post-mortem of a live exploit pattern
```

### 5b. Foundry test PoC
```solidity
// test/PoC.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;
import {Test} from "forge-std/Test.sol";
import {Target} from "../src/Target.sol";

contract PoC is Test {
    function test_Exploit() public {
        // 1. deploy, 2. setup state, 3. attacker action, 4. assert the loss
    }
}
```
Run: `forge test --match-test test_Exploit -vvvv`. Assert the attacker's balance/protocol loss explicitly.

### 5c. Echidna/Medusa fuzz (for invariant-based findings)

Full suite generation lives in `references/fizz/` — ported from pashov's fizz skill: `references/fizz/templates/` ships ready-to-copy Solidity (handlers, Properties.sol, Actor.sol, Snapshots.sol, utils/) and `references/fizz/scripts/` has the run pipeline (`extract_abis.js`, `generate_handlers.js`, `run_echidna.js`, `run_medusa.js`, `ensure_foundry.sh`). Use them directly instead of hand-writing harnesses.

For a single invariant finding, a minimal property test is fine:

```solidity
// contract with fuzz target
function echidna_test_conservation() public view returns (bool) {
    return vault.totalAssets() >= vault.totalShares(); // every sequence of calls
}
```
- Echidna: `echidna test/PoC.sol --contract PoC --test-mode property` (or via foundry: `echidna . --contract PoC`)
- Medusa: `medusa fuzz` with `medusa.json` config
- Let each run ≥2 min / ≥100k calls. A counter-example IS the PoC — save the failing call sequence.
- For math findings: `forge fuzz` or a bounded brute-force over the input space in a test is acceptable if a full fuzzer is unavailable.

### 5d. Real-chain verification (best)
Fork mainnet: `forge test --fork-url <rpc> --fork-block-number <block>` with real token/price state for oracle/MEV findings.

**Failure rule**: PoC does not reproduce → downgrade to LEAD or drop. Never report an unverified claim.

## Phase 6 — Bounty report

Read `references/report-formatting.md` and `references/senior-auditor-sop.md` and follow them; the block below is the condensed template:

```markdown
# [Severity] Title
- **Target / contract:** <file>:<line>
- **Category:** <CWE / class>
- **Severity rationale:** 1-2 lines (funds at risk, who triggers, how often)

## Summary
3-5 lines: what the bug is, why it matters.

## Root cause
The code-level defect, one paragraph, with code quote.

## PoC
- Full exploit scenario step-by-step (actor, call sequence)
- Working test/script output (attach `forge test -vvvv` result)
- For funds-based: before/after balances

## Impact
Concrete worst-case: max USD at risk, affected users, reachability.

## Suggested fix
Minimal diff or pseudocode.
```

Report rules:
- Never claim impact you didn't demonstrate (no "could lead to..." without trace).
- Always include severity per program rubric (Code4rena: Critical/High/Medium; Immunefi: Critical/High/Medium/Low + asset tier).
- One root cause per report. Distinct mechanisms → distinct reports.
- Tag doc-stated claims `(per spec)` vs code-verified.

## Phase 2 Output Templates

### x-ray/invariants.md
Four sections: **Enforced Guards** (per-call requires, mechanical dump with Purpose line), **Inferred Single-Contract** (I-N), **Inferred Cross-Contract** (X-N), **Economic** (E-N). Heading blocks `#### I-1` (slug anchors for cross-linking), not tables. Every inferred block MUST cite the Δ-pair / guard-lift+write-sites / edge / NatSpec claim that produces it — no citation, no block.

### x-ray/entry-points.md
Permissionless entry points first (full detail: access, caller, params, call chain, state modified, value flow, reentrancy guard). Then role-gated and admin (compact tables if >30 functions). Then protocol flow paths: arrow chains per actor showing precondition ← writer-of-precondition ← deployment, with `◄──` annotations for time/market conditions.

### x-ray/x-ray.md
Header (commit, branch, nSLOC from enumeration, coverage status), scope table by subsystem, threat model (adversaries by protocol type), actors + trust boundaries, key attack surfaces (cross-link invariant IDs), test gaps (only from enumeration — never infer "no tests" from forge coverage failure), git observations (analyzed branch only; `squashed_import` → state no evolution, skip fix analysis). Verdict tier at the end.

## Constraints

- Zero false positives: PoC before report, always.
- No fabrication: "could not determine" is a valid answer.
- Single pass, no partial outputs.
- Never reference contest/bounty rules in x-ray files (vendor-neutral); contest framing lives only in the final Phase 6 report.
- Coverage tool failure does NOT mean missing tests — enumeration (file/test counts) is the source of truth for test existence.
- Never describe code state from other branches; only analyze the checked-out branch.
- If a Phase tool fails (forge missing, fuzz not installed), fall back to a pure-code proof (explicit trace over storage deltas) and note the fallback.

## References provenance

`references/` is ported verbatim from https://github.com/pashov/skills (MIT © contributors) — solidity-auditor (hacking-agents/, judging.md, report-formatting.md, senior-auditor-sop.md), x-ray (templates.md, threats.md), fizz (agents/, scripts/, templates/). Update by re-copying from the upstream repo; do not edit these files in place — any deviations belong in SKILL.md itself.

## Quick Reference — Top Exploit Patterns (2026 payout-weighted)

1. Governance: malicious proposal / quorum bypass / vote replay → highest single payouts.
2. Oracle manipulation: flashloan price moves, stale/laggy oracles, spot-vs-TWAP mismatch.
3. ERC-4626/vault: first-depositor inflation, donate-to-inflate, share-rounding theft.
4. Cross-contract composition: return values trusted, hook callbacks (v4), adapter trust.
5. Signature flaws: EIP-2612 replay (chain/domain), ECDSA malleability, missing nonce.
6. Rounding asymmetry: mint floors, burn ceils → repeated 1-wei extraction.
7. Fee-on-transfer / rebasing / deflationary tokens breaking balance accounting.
8. Event spoofing for off-chain indexers (2026 trend — check `tx.meta.err`/revert on indexed data).
