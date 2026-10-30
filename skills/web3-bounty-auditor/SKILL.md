---
name: web3-bounty-auditor
description: "Web3 / smart contract security analysis for bug bounties. Covers Solidity, Rust (Solana), Move (Aptos/Sui), and general blockchain dApp vulnerabilities. Zero false positives. Every finding confirmed with working PoC."
---

# Web3 Bounty Hunter & Smart Contract Auditor

Methodical, phase-driven web3 security analysis. Zero false positives. Every finding confirmed with a working PoC before reporting.

---

## Live Attack Landscape (July 2026 — DeFiLlama Hacks DB)

**Hot bugs RIGHT NOW** — these are actively being exploited in the wild. Hunt these patterns.

| Date | Protocol | Lost | Chain | Technique | Unique Angle |
|------|----------|------|-------|-----------|--------------|
| Jul 17 | Across Protocol | $0 | Solana | Event spoofing (failed tx) | Off-chain indexer didn't check `tx.meta.err` |
| Jul 16 | DeFiTuna | $580k | Solana | Lending pool logic | — |
| Jul 15 | Ostium | $18M | Arbitrum | **Price Oracle Manipulation** | Perpetual DEX oracle lag |
| Jul 14 | BarnBridge | $776k | ETH | **Malicious Governance Proposal** | Governance takeover via proposal |
| Jul 14 | Drips Network | $24.9k | ETH | **Math Mistake Exploit** | Simple arithmetic bug cost real $
| Jul 13 | Lumi Finance | $270k | Arbitrum | **Silent Auto-Approval Hack** | NEW — approval without user noticing |
| Jul 13 | Chi Protocol | $8.5k | ETH | **Flashloan Accounting Logic Exploit** | balanceOf vs internal accounting diff |
| Jul 11 | Bonzo Lend | $10.05M | Hedera | Price Oracle Manipulation | Lending oracle on non-EVM chain |
| Jul 6 | BonkDAO | $21.3M | Solana | **Malicious Governance Proposal** | Governance is #1 attack vector 2026 |
| Jul 5 | Lazy Summer | $6M | ETH | **Donation Attack** | ERC-4626 inflation attack variant |
| Jul 2 | Hinkal | $820k | ETH | **prooflessDeposit() Exploit** | ZK proof verification bypass |
| Jun 30 | Edel | $403k | ETH | Flashloan Price Oracle Attack | Classic but still working |
| Jun 28 | AIDC | $121 | BSC | **Burn-from-LP Exploit** | LP token burning abuse |
| Jun 25 | Polymarket | $3M | Polygon | Front-end Vulnerability | Off-chain attack, not contract bug |
| Jun 25 | Lixir | $12.3k | ETH | **Broken Signature Verification** | ECDSA flaw |
| Jun 23 | SecondFi | $2.4M | Cardano | Predictable Private Key | Infrastructure, not contract |
| Jun 23 | Royal.io | $263k | Polygon | **Hook Manipulation Hack** | Uniswap v4 hook abuse |
| Jun 21 | Taiko Bridge | $1.7M | Taiko | **Fake Proof Exploit** | Bridge proof verification bug |
| Jun 20 | LABUBU/OLPC | $1.1M | BSC | **Deflationary Reserve Poisoning** | Tokenomics manipulation |
| Jun 20 | JaredFromSubway | $7.5M | ETH | **Reverse MEV Honeypot** | MEV bot got MEV'd |
| Jun 19 | mySwap CL | $300k | Starknet | **CL Pool Accounting Hack** | Concentrated liquidity math |

**2026 Mega-exploits:**
- **Drift Protocol (Apr)**: $285M — governance + social engineering + durable nonce pre-signed txns
- **BonkDAO (Jul 6)**: $21.3M — malicious governance proposal on Solana
- **Ostium (Jul 15)**: $18M — oracle manipulation on Arbitrum perps

**Key takeaway**: Governance attacks, oracle manipulation, and cross-contract composition bugs are the top earners in 2026.

---

## HackenProof Platform (July 2026)

**Key stats:** 400+ programs, $26M+ paid, 85k+ reports, 82k+ hackers. ISO 27001 certified. $95B+ protected.

**Platform type:** Managed bounties + crowdsourced audits (DualDefense contests). AI MCP server for triage launched 2026.
**Best for:** Exchange/CEX targets (OKX, KuCoin, Gate.io), L1 ecosystems (Aurora, NEAR, Sui), NFT marketplaces, Web2 apps
**Payout range:** $50–$1M+ per finding. Critical $5k–$30k typical, High $2k–$5k.
**Critical detail:** HP offers "Hidden Gems" badge — programs with fewer hackers, less competition, higher hit rate.

---

## OKX — Full Attack Surface (3 Programs, $2M+ in Rewards)

### Program 1: HackenProof — OKX CEX (Web + Apps + Blockchain)
- **Bounty:** Up to $1,000,000 | Critical $5k–$30k | 120 rep required | PoC required
- **Paid so far:** $63,990 across 523 submissions from 274 hackers
- **Scope:** `*.okx.com` (all subdomains), Android App, iOS App, Blockchain layer
- **Type:** CEX + NFT Marketplace → web injection, API auth bypass, business logic, P2P exploits
- **Gaps to hunt (likely under-hunted):**
  - Web2 bugs hiding in Web3 (SSRF, path traversal, mass assignment) — HP has a dedicated article on this blind spot
  - OKX P2P trading logic — dispute system, escrow bypass
  - OKX Earn / Staking product logic
  - API key permission escalation
  - Rate limiting / bruteforce on 2FA recovery flows

### Program 2: Cantina — OKX DEX Onchain ($1M Pool)
- **Bounty:** Critical up to $1,000,000 | High up to $100,000 | Medium up to $10,000
- **Started:** Jan 30, 2026 | **Findings submitted:** 538 | KYC required | $10 deposit
- **Scope:** Production DEX routing infrastructure across **multiple ecosystems**:
  - DEX routers (multi-ecosystem)
  - Related onchain components handling user asset transfers
  - Mainnet-deployed contracts only
- **Repo scope published on Cantina bounty page**
- **What to hunt here (DEX router bugs):**
  - Slippage calculation rounding — Balancer-style $121M precision loss
  - Cross-chain routing — trust assumptions between chains, bridge dependency
  - Permit2 / signature replay across chains
  - MEV sandwich resistance logic flaws
  - Fee calculation — skim, donate, or rounding attacks
  - Path validation — malicious token pair injection
  - Quoter vs swap consistency — quote manipulation leading to bad execution

### Program 3: OKX Threat Hunters (Own Program)
- **Bounty:** Up to $1,000,000 | **Total paid:** $2.3M | **Reports:** 2,500+ | **Top range:** $1.5k–$24k
- **Scope:** All OKX products — exchange, wallet, infrastructure
- **Live hacking events, leaderboard, KYC required for high bounties**

### Past OKX Vulnerabilities (Know What's Already Been Found)
- **CertiK RCE (Dec 2023)**: Critical remote code execution in OKX iOS app — patched v6.45.0. iOS app security is a known attack surface.
- **CertiK threshold-lib audit**: Multi-party computation wallet — cryptographic implementation verified, focus areas already audited
- **SlowMist AA audit**: Account Abstraction — low risk, all issues fixed. If you can find something missed here, it's fresh
- **OKX Wallet main contracts**: DexRouter, NFTMarketAggregator, Entrance — audited by CertiK but continuous program
- **No major exchange hack** — OKX claims clean record. The first critical finding is worth a lot.

### OKX Hunting Strategy (Priority Order)

```
1. Cantina DEX routers ($1M max) → Cross-chain routing bugs, rounding, signature replay
2. HP OKX Web target ($30k max) → P2P logic, API auth, SSRF/OAST chain to internal
3. HP OKX Mobile → iOS/Android specific: RCE, deep link hijacking, insecure storage
4. OKX Threat Hunters → Any finding from above also qualifies here; double-dip opportunity?
```

**Key insight:** The Cantina DEX Onchain program has 538 submissions but **zero public disclosures** — means either the bar is high or findings are being kept quiet. Attack surface: multi-chain DEX routers are notoriously complex and hard to audit perfectly.

---

## Phase 0 — Target Reconnaissance (Read First, Touch Nothing)

1. **Identify the stack**
   - Solidity version + compiler flags
   - Framework (Hardhat, Foundry, Truffle, Brownie)
   - Dependencies (OpenZeppelin, Uniswap, Chainlink, etc.)
   - Upgradeability pattern (UUPS, transparent proxy, beacon)
   - External protocols / oracles integrated
   - ERC standards used (20, 721, 1155, 4626, 2612, etc.)

2. **Map the attack surface**
   - Entry points: external/public functions (no `onlyOwner` guard)
   - State-altering functions versus view/pure
   - Functions accepting raw user calldata / addresses / arrays
   - `delegatecall` usage
   - `selfdestruct` or `create2` usage
   - Low-level calls (`call`, `staticcall`, `assembly`)
   - Reentrancy guards present or absent
   - Access control modifiers per function

3. **Check compiler version for known bugs**
   - [Solidity known vulnerabilities](https://soliditylang.org/blog/category/security/)
   - Check `pragma` against known-bug compiler versions

4. **Review the test suite**
   - What's tested? What's NOT tested?
   - Edge cases in tests reveal intended vs actual behavior

> Complete recon before any reporting. Mental map first.

---

## Phase 1 — OWASP Smart Contract Top 10 2026 Priority Map

Ranked by 2025 incident frequency and dollar loss ($905.4M total across 122 incidents).

| Rank | Category | 2025 Loss | AI Detection | Human Detection | Key Gap |
|------|----------|-----------|-------------|----------------|---------|
| 1 | Access Control | $220M | 75% | 92% | 17pts |
| 2 | Business Logic | $189M | 31% | 78% | **47pts** |
| 3 | Price Oracle Manipulation | — | 48% | 82% | 34pts |
| 4 | Flash Loan Attacks | — | 42% | 80% | 38pts |
| 5 | Input Validation | — | 81% | 90% | 9pts |
| 6 | Unchecked External Calls | — | 78% | 91% | 13pts |
| 7 | Arithmetic Errors (NEW) | $138M | 64% | 86% | 22pts |
| 8 | Reentrancy | — | 94% | 96% | 2pts |
| 9 | Integer Overflow | $260M | 89% | 92% | 3pts |
| 10 | Proxy & Upgradeability (NEW) | — | 67% | 88% | 21pts |

**Focus where AI fails**: Business Logic, Flash Loan composition, Oracle manipulation, Proxy patterns — these are where senior human auditors still dominate.

---

## Phase 2 — Smart Contract Vulnerability Hunting

Work categories in **OWASP 2026 priority order**. Skip only if provably inapplicable.

### 2A. Access Control (SC01 — $220M lost 2025)
- `tx.origin` usage (phishing risk — EIP-7702 makes this obsolete)
- Missing `onlyOwner` / `onlyRole` on critical functions
- `initialize()` callable by anyone (uninitialized proxy pattern)
- `Ownable` ownership renounced or transferred to zero address
- `_mint` vs `_safeMint` misuse
- `permit()` / `ERC20Permit` signature replay across chains (EIP-2612)
- **2025 trend**: Uninitialized ERC1967 proxies automated attack campaigns (Kinto $1.55M, ResupplyFi $9.8M)
- **Solana Anchor CVE-2026-45137**: `Program<'a, System>` type validation flaw — any executable account accepted instead of system program

### 2B. Business Logic (SC02 — $189M lost 2025, WIDEST AI GAP)
- Share/balance accounting manipulation
- Fee-on-transfer / rebasing token compatibility
- Staking: reward rate manipulation, early withdrawal abuse
- Liquidation: can liquidator frontrun their own liquidation?
- Voting: proposer can vote on own proposal, quorum bypass
- Bridging: message replay, relayer griefing, spoofed source
- **Cross-module invariant violations** — check interactions between separate contracts
- **Reward/fee logic** — Stream Finance lost $93M to reward logic flaws
- **Rollover pricing manipulation** (Cork Protocol — Uniswap v4 hook pricing abuse)
- **Liquidation health check bypass** — wrong debt/col alterations before liquidation check
- **Self-transfer edge cases** — yield-bearing NFTs transferring to self could mint extra rewards
- **Across Solana event spoofing**: Failed Solana transactions still emit event data — off-chain indexers that don't check `tx.meta.err` will process fake deposit events. Relayers fill orders against phantom deposits.

### 2C. Price Oracle Manipulation (SC03)
- TWAP oracle manipulation window (short TWAP = manipulable)
- Spot price oracle used for liquidation — flash loan + spot price = drain
- Chainlink staleness check missing
- Single-source oracle dependency
- **Solana**: TWAP window configurable to 1 slot enables atomic oracle manipulation (F-002 finding)
- **Lending**: Single-block DEX spot price → flash-loan-funded reserve skew → 1000× redemption rate
- **GMX July 2025**: Cross-contract reentrancy combined with price manipulation

### 2D. Flash Loan-Attacks (SC04 — up from #7 in 2025)
- Price manipulation via flash loan + spot oracle
- Voting manipulation (governance tokens with flash loan)
- Yield manipulation (deposit/withdraw in same block)
- Check: is `balanceOf` used instead of internal accounting?
- **EIP-7702 variant (2025)**: POT Token exploit — EOA delegation bypassed `tx.origin == msg.sender` flashloan protection check
- **Balancer v2 $121M**: Flash-loan-funded liquidity manipulation to create low-liquidity state, then 17-wei rounding exploit repeated hundreds of times

### 2E. Input Validation (SC05)
- Missing bounds checks on user-supplied arrays
- Unvalidated address parameters (zero address, self address)
- Unchecked return values from external calls (especially ERC20 transfers)
- **2025 trend**: Signature replay from missing chain ID / nonce / deadline validation
- **Solana**: Anchor `TryFrom<&AccountInfo>` logic error — accepts any program ID when system program required (CVE-2026-45137)

### 2F. Unchecked External Calls (SC06)
- Low-level `call` without return value check
- ERC20 `transfer`/`transferFrom` return value not checked (USDT returns void)
- `delegatecall` to user-controlled address
- **GMX July 2025**: Cross-contract reentrancy via unchecked callback
- **Solana CPI**: Missing PDA signer verification in Cross-Program Invocations

### 2G. Arithmetic Errors — Rounding & Precision (SC07 — NEW for 2026, $138M)
- **Balancer v2 $121M**: `_upscale` always rounding down (`mulDown`) regardless of swap direction. 17 wei vs 18 wei repeated exploit.
- **Yearn yETH**: Solver's product accumulator truncated to 0 via repeated `unsafe_div` floor-rounding → massive LP over-minting
- **Beets on Sonic**: Same Balancer rounding bug, fork affected too — $3M stolen
- Division before multiplication (precision loss)
- Rounding direction favoring user vs protocol
- Share price manipulation via donation (ERC-4626 inflation attack)
- **Bidirectional rounding** — common in DeFi, both directions must be checked

### 2H. Reentrancy (SC08 — down from #5, tooling is good)
- Cross-function reentrancy (state not updated before external call)
- Cross-contract reentrancy (ERC-777 hooks, ERC-1155 `onERCReceived`)
- Read-only reentrancy (view function reads stale state)
- `delegatecall` + selfdestruct pattern
- Check: is CEI (Checks-Effects-Interactions) pattern used?
- Check: is `ReentrancyGuard` present and correctly placed?
- **GMX July 2025**: Cross-contract reentrancy enabling price manipulation across 2 contracts

### 2I. Integer Overflow / Underflow (SC09 — $260M lost)
- Solidity <0.8 without SafeMath
- `unchecked` blocks re-introducing underflow (2025 finding: unchecked math underflow → infinite balance)
- SafeMath not used in assembly blocks
- **Paxos $300T mint**: No supply cap — permissioned entity minted arbitrarily large amount, no failsafe

### 2J. Proxy & Upgradeability (SC10 — NEW for 2026)
- Storage collision between implementation and proxy
- `delegatecall` to user-supplied address
- Selfdestruct in implementation kills all proxies (UUPS vulnerability)
- `initializer` modifier missing (re-initialization attack)
- Function selector clashes between proxy and implementation
- **CPIMP (Clandestine Proxy) July 2025**: Malicious proxy inserted between existing proxy and implementation
- **Uninitialized ERC1967 proxies**: Automated attack campaigns in 2025 (Kinto $1.55M, ResupplyFi $9.8M)
- **Bybit $1.4B (Feb 2025)**: Safe Wallet UI compromised — malicious JS redirected implementation slot to attacker-controlled address

### 2K. Emerging & Uncommon Bug Patterns (from July 2026 DeFi attacks)

These are the LESS common patterns that are actively being exploited NOW. Most auditors miss these.

**Silent Auto-Approval Hack** (Lumi Finance, Jul 13 — $270k)
- User unknowingly approves infinite spending via misleading tx data
- Check: Does the frontend show accurate approval amounts? Can the contract call `approve` on behalf?
- **Hunt**: Look for any function that triggers `approve`/`increaseAllowance` without explicit user confirmation

**prooflessDeposit() Exploit** (Hinkal, Jul 2 — $820k)
- ZK privacy protocol had a function that bypassed proof verification
- **Hunt**: In any ZK protocol, check if every state-changing function actually verifies the proof. Look for admin-only bypass functions, debug endpoints, or code paths where proof verification is skipped

**Hook Manipulation Hack** (Royal.io, Jun 23 — $263k)
- Uniswap v4 hook contract had arbitrary execution logic
- **Hunt**: v4 hooks (`beforeSwap`, `afterSwap`, `beforeDonate`, etc.) — can they manipulate state outside their intended scope? Can they re-enter the pool?

**Fake Proof Exploit** (Taiko Bridge, Jun 21 — $1.7M)
- Bridge accepted fake/forged withdrawal proofs
- **Hunt**: In any bridge/rollup: can an attacker craft a proof that passes verification but wasn't actually committed on L1? Check proof verification logic for edge cases

**Deflationary Reserve Poisoning** (LABUBU/OLPC, Jun 20 — $1.1M)
- Deflationary token with transfer fee caused reserve ratio manipulation
- **Hunt**: Any pool with deflationary/fee-on-transfer/rebasing tokens — test reserve math with transfer fees applied

**Reverse MEV Honeypot** (JaredFromSubway, Jun 20 — $7.5M)
- MEV bot got trapped by a contract that appeared profitable but stole the bot's funds
- **Hunt**: Contracts with `balanceOf`-based profit calculations that can be manipulated via callbacks

**Math Mistake Exploit** (Drips Network, Jul 14 — $24.9k)
- Simple arithmetic error in distribution logic
- **Hunt**: Every calculation. Test with zeros, max values, and edge-case inputs

**Burn-from-LP Exploit** (AIDC, Jun 28 — $121)
- Attacker burned LP tokens from the pool directly, causing price manipulation
- **Hunt**: Can any non-holder burn tokens? Check `burn` access controls, LP token contracts

**CL Pool Accounting Hack** (mySwap CL, Jun 19 — $300k)
- Concentrated liquidity position accounting had precision/rounding flaw
- **Hunt**: CL math — tick math, liquidity delta calculations, fee growth accounting

**Flashloan Accounting Logic Exploit** (Chi Protocol, Jul 13 — $8.5k)
- Protocol used `balanceOf` instead of internal accounting → flashloan inflated balance
- **Hunt**: Everywhere `balanceOf`/`totalSupply` is used instead of internal accounting variables

**Cross-Contract Composition ("The Seam")** — From SCTF 2026 research
- The bug is in how pieces COMPOSE, not in any individual piece
- Example: Contract A locks TWAP at request time, Contract B reads separately-skewable TWAP at claim time
- **Hunt**: Map the trust chain between contracts, not just individual contracts. Look for time-axis disagreements between separate contract calls in the same flow

### 2L. Solana & Cross-Chain Specific (NEW — from 2025/2026 incidents)

**Solana Event Handling:**
- Solana has no canonical event system — events reconstructed from instruction data / program logs
- Failed transactions still emit event data → missing `tx.meta.err` check allows fake event spoofing
- **Across Protocol ($0 lost, bug bounty)**: Off-chain event indexer didn't check tx status. Attacker could deposit → trigger event → force tx revert → relayer fills phantom order
- **Self-CPI events**: Must verify PDA signer for legitimate event authority

**Anchor Framework (Solana):**
- CVE-2026-45137 (CVSS 8.2): `TryFrom<&AccountInfo>` for `Program<'a, T>` logic error — T = () and T = System both default to `Pubkey::default()` → any executable account accepted as system program → arbitrary CPI or payment bypass
- Anchor 1.0.0-1.0.1 affected, fixed in 1.0.2

**Cross-Chain / Bridge:**
- Off-chain event indexers are the weakest seam — trust boundary between on-chain state and off-chain relayer software
- Failed tx state rollback ≠ event log rollback on Solana
- Relayer-side risk: relayers fill before finalization, take on reorg risk
- Source chain spoofing in bridge messages
- **POT Token $85k**: EIP-7702 delegation bypassed EOA-only flashloan protection on BSC

**Supply Chain:**
- Compromised developer machines → malicious UI injection (Bybit $1.4B)
- Compromised private keys (January 2025: ~$XXM lost)
- Dependency confusion in npm/cargo packages used by protocols

### 2L. MEV & EIP-7702 (NEW attack surface)
- EIP-7702 broke `tx.origin == msg.sender` EOA checks — this was used for flashloan protection and permission gating
- **POT Token**: Flashloan protection bypassed via delegated EOA
- **Gana Payment $3.1M**: Compromised owner key + EIP-7702 delegation to change operational params + unstake
- **Wallet draining evolution**: Single delegation tx can sweep all tokens, drain ETH, liquidate positions, bridge assets in one atomic operation
- **Check**: any contract using `tx.origin == msg.sender` as a security check is now broken post-EIP-7702

---

## Phase 3 — Off-Chain & Indexer Vulnerabilities (CRITICAL gap 2025-2026)

These are the highest-ROI hunting targets because most auditors only check on-chain code.

### 3A. Solana Event Indexers
- **Missing `tx.meta.err` check**: Failed transactions still emit instruction data/events. Indexers that don't verify tx success will process phantom events.
- **Across Protocol finding (Asymmetric Research, Apr 2026)**: Solana event parser iterated `meta.InnerInstructions` without checking tx status → fake deposit events → relayer fills non-existent orders
- **Self-CPI event authority**: Must verify PDA signer is present in accounts. Any program can emit matching instruction data without the correct PDA.
- **Check**: Does indexer verify `transaction.meta.err === null` before processing events?

### 3B. Off-Chain Relayer / Bot Logic
- **Race conditions in fill decisions**: Relayers that compete on speed may skip safety checks
- **Refund bundle validation**: Can attacker craft bundles that get refunded but never actually filled?
- **Capital lockup griefing**: Relayer fills order → discovers invalid → loses capital
- **Check**: Does relayer verify on-chain state (not just indexer events) before filling?

### 3C. Cross-Chain Message Verification
- **Event log reconstruction**: Off-chain code that parses events from different chain architectures (EVM logs vs Solana instruction data vs SVM events)
- **Source chain spoofing**: Bridge messages without verified `_fromChain` or `_fromAddress`
- **Message replay**: Same message valid on multiple destination chains
- **Check**: Does the off-chain verifier validate the source chain's consensus, not just the event data?

### 3D. Supply Chain & UI Attacks
- **Compromised developer machine** → malicious JS in production UI (Bybit $1.4B)
- **Dependency confusion**: npm/cargo packages using internal names
- **Check**: Is there a Software Bill of Materials (SBOM)? Are dependencies pinned with hash locks?

---

## Phase 4 — Web3-Specific Bug Bounty Hunting

### 4A. Bridge & Cross-Chain
- Relayer can submit arbitrary messages
- Source chain validation missing (spoofed `_fromChain`)
- Packed data parsing ambiguity
- Token contract mismatch between chains
- Validator set manipulation
- **Failed tx event spoofing** (Solana-specific: events from reverted txns)

### 4B. DeFi Protocol Logic
- Donation attack (first depositor inflation)
- Share splitting / merging abuse
- Liquidation health check bypass
- Swap exact input vs exact output edge cases
- Slippage protection bypass (sandwich)
- Rebasing token integration bugs
- **Balancer-type rounding**: Repeated tiny swaps with precision loss accumulate drain
- **Yearn-type solver overflow**: Iterative solver operating outside designed domain

### 4C. NFT Marketplace
- Floor price oracle manipulation
- Signature-based listing theft
- EIP-2612 permit frontrunning (buyer pays more)
- Royalty bypass
- Batch transfer edge cases

### 4D. Governance Attacks
- Flash loan voting
- Delegate manipulation
- Proposal cancel / queue / execute bypass
- Quorum manipulation via token transfer
- Timelock bypass

### 4E. Lending / Borrowing
- Bad debt accrual (incentive misalignment)
- Liquidation threshold miscalculation
- Close factor manipulation
- Price oracle lag exploit

### 4F. EIP-7702 Attack Surface (NEW)
- `tx.origin == msg.sender` checks are BROKEN post-EIP-7702
- Single delegation tx can drain all assets atomically
- Check: any contract using EOA-only check for security logic

---

## Phase 5 — Validation Protocol (Zero False Positive Rule)

**Every finding MUST pass ALL gates before reporting:**

### Gate 1 — Data Flow Trace
```
User Action → [Function A] → [Internal Call B] → [State Change C]
```
Can the attacker bypass any guard? Are all guards present?

### Gate 2 — PoC Construction
Solidity PoC (Foundry test preferred):
```solidity
// Minimal reproducible exploit
function testExploit() public {
    // 1. Setup: deploy, fund, initialize
    // 2. Attack: call vulnerable function
    // 3. Assert: state is as attacker intends
}
```

Format:
- Setup environment
- Execute attack transaction(s)
- Show before/after state
- Demonstrate profit or damage

### Gate 3 — Real-World Viability Check
- [ ] Is the attack within practical gas limits?
- [ ] Does it require unrealistic market conditions?
- [ ] Can the target contract actually be deployed this way?
- [ ] Is a flash loan required? (acceptable if ≤1)
- [ ] Are all required conditions achievable on mainnet?

### Gate 4 — Impact Classification
```
CRITICAL  = Direct loss of user/protocol funds (>$100k)
HIGH      = Direct loss of funds (<$100k), or permanent DoS
MEDIUM    = Griefing, temporary DoS, MEV extraction <$10k
LOW       = Informational, centralization risk (with timelock)
```

### Gate 5 — Known Issue Check
- [ ] Is this already documented in the project's audit reports?
- [ ] Is this already in the bug bounty program's known/out-of-scope list?
- [ ] Does this require admin/owner collusion? (lower severity)

**Cannot build a working PoC? → Mark as "Potential — needs dynamic testing" and move on.**

---

## Phase 6 — Report Format

```markdown
## [CRITICAL/HIGH/MEDIUM/LOW] — [Vulnerability Type]

**Contract:** src/ContractName.sol  
**Function:** vulnerableFunction()  
**Lines:** 42-56  
**Severity:** Critical  

### Description
Clear explanation of the vulnerability and why it matters.

### Vulnerable Code
\```solidity
function vulnerableFunction(address user, uint256 amount) external {
    // Minimal snippet showing the bug
}
\```

### Root Cause
Missing validation? Wrong math? Wrong access control?

### PoC
\```solidity
// Foundry test
function testExploit() public {
    // Setup
    attacker = makeAddr("attacker");
    deal(address(token), attacker, 1 ether);
    
    // Attack
    vm.startPrank(attacker);
    contract.vulnerableFunction(attacker, type(uint256).max);
    vm.stopPrank();
    
    // Assert
    assertGt(token.balanceOf(attacker), initialBalance);
}
\```

### Impact
Attacker can drain all funds from the protocol.

### Fix
\```solidity
// Add require(amount <= maxWithdraw(user), "exceeds limit");
\```

### Recommendation
Add access control / bounds check / CEI pattern.
```

---

## Language-Specific Sink Maps

### Solidity (EVM)
```
External calls:      target.call{value: x}(""), target.delegatecall(...)
Assembly:            mstore, mload, sload, sstore, call, delegatecall, staticcall
Unsafe arithmetic:   unchecked { ... } (for <0.8 code review)
Selfdestruct:        selfdestruct(payable(addr)) // KILLS CONTRACT
Injection:           abi.encodeWithSignature(userInput) // selector injection
Reentrancy:          externalCall before state write // CEI violation
Flash loan vectors:  balanceOf(), totalSupply() for accounting
EIP-7702:            tx.origin == msg.sender checks are broken (delegated code)
Rounding:            mulDown/divDown in swap math (Balancer v2 pattern)
Solver:              iterative product accumulator / D calculation overflow
Proxy:               ERC1967 implementation slot, UUPS selfdestruct
```

### Rust (Solana / Anchor)
```
Anchor type flaw:    Program<'a, System> vs Program<'a, T> — T=() and T=System both
                     allow any executable account (CVE-2026-45137)
CPI calls:           invoke(), invoke_signed() with user-derived PDAs
Account validation:  AccountInfo owned by wrong program, missing signer check
                     **Critical**: Program<'a, System> accepts any program ID pre-1.0.2
Seeds:               find_program_address with user-controlled seeds
Close account:       closing account without rent-reclaim check
Event handling:      Instruction data emitted even on failed tx — off-chain indexers
                     MUST check tx.meta.err before processing events
Self-CPI events:     Must have PDA signer — verify programEventAuthority
Arithmetic:          Anchor uses safe math but Rust's std overflow checks can be
                     bypassed with wrapping_* / unchecked in tight loops
Token extensions:    Token-2022 with transfer fees, interest, confidential transfers
```

### Solana Off-Chain (NEW — critical gap)
```
Missing tx status:   transaction.meta.err === null check is MISSING in event parsers
                     => attacker can trigger event + force revert = spoofed event
Inner instructions:  meta.InnerInstructions processed without verifying tx success
Instruction data:    bs58.decode(ix.data) from failed txns — same bytes as successful
Program verification: programId match alone is NOT enough — need PDA event authority
```

### Vyper
```
Unsafe:              raw_call, raw_log, __init__ reentrancy
Assembly:            _calldatacopy, _calldatasize, _calldataload
Interface:           interface type confusion
Solver overflow:     iterative math in StableSwap pools (Yearn yETH)
                     repeated unsafe_div can push product accumulator to 0
```

---

## Token Efficiency Rules

1. **Read interface + state variables + external functions first** — mental model before details
2. **Trace from tx.origin to state change** — follow the money
3. **One category at a time** — full validate before moving on
4. **No speculation** — unsure = trace deeper or mark unconfirmed
5. **Skip** — NatSpec comments, test helpers, deployment scripts (unless relevant)
6. **Prioritize** — CRITICAL > HIGH, stop and report CRITICAL immediately
7. **Use Foundry's `forge inspect`** for storage layout when relevant

---

## Scoring Matrix for Bug Bounty Programs

| Category | Typical Bounty | Top Programs |
|----------|---------------|--------------|
| Critical (direct fund loss) | $50k - $3M+ | Ethena $3M max, USDT0 $6M max |
| High (fund loss, limited) | $10k - $100k | Kamino $100k, GMTrade $20k |
| Medium (griefing, MEV) | $1k - $10k | Most programs flat rate |
| Low (informational) | $500 - $2.5k | Ethena $2.5k |
| Gas optimization | $0 - $500 | Most exclude |

**Critical reward formula (Immunefi):** 10% of funds at risk, capped at max bounty.

---

## What NOT to Report (from real 2026 program policies)

**Universal exclusions across Immunefi/HackerOne:**
- **Centralization risks accepted by design**: admin keys, pausable roles, upgradeable proxies, mint/burn permissions, multisig-controlled operations
- **MEV, frontrunning, sandwich attacks** — inherent to public blockchains, not considered vulnerabilities
- **Audit report findings** already documented as residual risk
- **Third-party library bugs** unless the protocol's integration introduces the flaw
- **Theoretical reentrancy** without a working PoC exploiting actual state changes
- **Gas optimization** suggestions with no security impact
- **Missing events, floating pragma, naming conventions, unused code**
- **User-configurable slippage losses**
- **Oracle deviations within documented tolerance thresholds**

**Drift Protocol $285M lesson**: Governance + social engineering chains ARE in scope — compromised admin keys used via durable nonce pre-signing + fake token price manipulation was the actual attack vector. If you find a governance bypass that doesn't require key compromise, that's critical.

**BonkDAO $21.3M lesson**: Malicious governance proposals are very much in scope. If you can pass a proposal without compromising the multi-sig, that's a critical finding.

---

---

## Starknet — Full Attack Surface (3 HP Programs + Immunefi, $250k Max Each)

### Program Map

| Program | Max | Focus | Launched | Submissions | Paid |
|---------|-----|-------|----------|-------------|------|
| **Blockchain/DLT** | $250k | Bridge contracts, L1 Solidity | Jul 1, 2026 | 62 | $1k |
| **Web & SC** | $250k | Web app + smart contracts | Jul 1, 2026 | 19 | $0 |
| **Staking** | $100k | STRK/BTC staking protocol | Jul 1, 2026 | 39 | $0 |
| **Immunefi** | $350k | Blockchain/DLT | Oct 2022 | N/A | N/A |

**Total newly launched** (Jul 1, 2026) — only 120 submissions across all 3 programs. Very fresh, low competition.

**Critical:** $15k–$250k | **KYC:** Required | **PoC:** Required

---

### Smart Contract Architecture (StarkGate L1 Bridge)

**Repository:** `starkgate-contracts` branch `cairo-1` → `src/solidity/`

```
StarkgateConstants.sol       → Selectors, address constants (ETH = 0x455448)
Fees.sol                     → Hardcoded gas estimates (20k deposit, 100k deploy), MIN_FEE by chainid
WithdrawalLimit.sol          → 5% daily withdrawal cap per token, balanceOf-based calculation
StarknetTokenStorage.sol     → TokenSettings mapping (status, msgHash, expiry, maxBalance, limit)
StarkgateManager.sol         → Role-based: enroll/deactivate/block tokens, manage registry
StarkgateRegistry.sol        → Token → Bridge mapping, withdrawal bridges list, selfRemove
IStarkgateBridge.sol         → Interface: enrollToken() + deactivate()
StarknetTokenBridge.sol      → Core bridge logic: deposit(), withdraw(), cancel/reclaim
StarknetEthBridge.sol        → ETH bridge (msg.value handling, maxBalance check)
LegacyBridge.sol             → Backward compat with old ABI, try/catch msg format fallback
```

---

### Hunting Priority — StarkGate Bridge Contracts

**Priority 1 — LegacyBridge.consumeMessage() try/catch fallback** (`LegacyBridge.sol:89-114`)
```solidity
try messagingContract().consumeMessageFromL2(l2TokenBridge(), payload) {} 
catch Error(string memory) {
    // Old format: 4 elements, no token address
    payload = new uint256[](4);
    payload[0] = TRANSFER_FROM_STARKNET;  // 0
    payload[1] = u_recipient;
    payload[2] = amount_low;
    payload[3] = amount_high;
    messagingContract().consumeMessageFromL2(l2TokenBridge(), payload);
    require(bridgedToken() == token, "NOT_LEGACY_BRIDGED_TOKEN");
}
```
**Attack angle:** The catch block accepts BOTH old and new format messages for the legacy bridge.
- If `consumeMessageFromL2` succeeds with the OLD 4-element format on a message meant for NEW 5-element format, the token check at the end only validates it's the legacy token. But the amount/recipient could be misinterpreted.
- **Hunt:** Craft a message that passes BOTH old and new format consumption — could you withdraw tokens you shouldn't have access to?

**Priority 2 — WithdrawalLimit balanceOf manipulation** (`WithdrawalLimit.sol:44-51`)
```solidity
function calculateIntradayAllowance(address token) internal view returns (uint256) {
    uint256 currentBalance;
    if (token == ETH) {
        currentBalance = address(this).balance;
    } else {
        currentBalance = IERC20(token).balanceOf(address(this));
    }
    uint256 withdrawLimitPct = getWithdrawLimitPct();
    return (currentBalance * withdrawLimitPct) / 100;
}
```
**Attack angle:** `balanceOf(address(this))` can be manipulated via donations, flashloans, or self-transfers.
- If attacker donates tokens to inflate balance → intraday allowance increases by 5% of donation
- **Hunt:** Can you inflate the balance just before a large withdrawal to bypass the 5% limit?

**Priority 3 — checkDeploymentStatus() piggybacked on deposit** (`StarknetTokenBridge.sol:175-179`)
```solidity
// Piggy-back the deposit tx to check and update the status of token bridge deployment.
checkDeploymentStatus(token);
```
**Attack angle:** Token deployment status check is silently piggybacked on every deposit of that token.
- If pending token deployment expires (5 days), `checkDeploymentStatus` deletes the token settings AND self-removes from registry
- But it's only triggered by a deposit from someone — what if no one deposits? The token would stay in "Pending" forever
- **Hunt:** Can you force a token into pending state and manipulate the expiration?

**Priority 4 — enrollToken double-spend / frontrunning** (`StarknetTokenBridge.sol:148-160`)
```solidity
function enrollToken(address token) external payable virtual onlyManager {
    require(tokenSettings()[token].tokenStatus == TokenStatus.Unknown, "TOKEN_ALREADY_ENROLLED");
    bytes32 deploymentMsgHash = sendDeployMessage(token);
    require(messagingContract().l1ToL2Messages(deploymentMsgHash) > 0, "DEPLOYMENT_MESSAGE_NOT_EXIST");
    tokenSettings()[token].tokenStatus = TokenStatus.Pending;
    ...
}
```
**Attack angle:** The deployment message existence check happens BEFORE status update.
- Re-entrancy? (unlikely since `sendDeployMessage` is external call to messaging contract)
- Fee manipulation — `msg.value` is used for both enrollment fee and the message
- **Hunt:** Can you enroll the same token twice by manipulating the L1→L2 message queue?

**Priority 5 — depositCancelRequest / depositReclaim race** (`StarknetTokenBridge.sol:271-305`)
- Cancellation has a delay period (via StarknetMessaging)
- But `depositReclaim` transfers funds to `msg.sender` (not original depositor)
- `depositCancelRequest` does NOT check `msg.sender` is the original depositor — anyone can cancel anyone's deposit!
- Wait... cancel just starts the cancellation, but `depositReclaim` would transfer to `msg.sender`? Let me check...

```solidity
function depositReclaim(...) external {
    messagingContract().cancelL1ToL2Message(...);
    transferOutFunds(token, amount, msg.sender);  // msg.sender, not original depositor!
    emit DepositReclaimed(msg.sender, token, amount, l2Recipient, nonce);
}
```
**CRITICAL ANGLE:** `depositReclaim` sends funds to `msg.sender`, not the original depositor. Anyone who knows the deposit parameters (token, amount, l2Recipient, nonce — all emitted in events) can call this after the delay and steal the deposit!

But wait — `cancelL1ToL2Message` in StarknetMessaging — does it validate the sender? Let me check...

Actually looking at the `startL1ToL2MessageCancellation` and `cancelL1ToL2Message` — these are from the Starknet messaging contract. The `cancelL1ToL2Message` function in the Starknet core contract likely requires that `startL1ToL2MessageCancellation` was called first by the same address. So the race is:
1. Attacker sees a `Deposit` event
2. Attacker frontruns `startL1ToL2MessageCancellation` (not restricted!)
3. After delay, attacker calls `depositReclaim` → funds go to attacker

Wait, `depositCancelRequest` doesn't have `onlyDepositor` modifier! Let me recheck...

```solidity
function depositCancelRequest(
    address token, uint256 amount, uint256 l2Recipient, uint256 nonce
) external {
    messagingContract().startL1ToL2MessageCancellation(...);
    emit DepositCancelRequest(msg.sender, token, amount, l2Recipient, nonce);
}
```
No `onlyDepositor` check! And the `nonce` is emitted in the `Deposit` event. So:
1. Anyone can see `Deposit` event with nonce
2. Anyone can call `depositCancelRequest` to start cancellation
3. After delay, anyone can call `depositReclaim` → gets the funds!

This is a **potential CRITICAL** finding — anyone can steal any pending deposit. BUT — is `cancelL1ToL2Message` in the messaging contract restricted? Let me look...

Actually, in Starknet's `IStarknetMessaging.sol`, the `cancelL1ToL2Message` typically requires that `startL1ToL2MessageCancellation` was called by the same address. So:
- Step 1: Attacker calls `depositCancelRequest` for someone else's deposit → starts cancellation
- Step 2: After cancellation delay, attacker calls `depositReclaim` → but will `cancelL1ToL2Message` revert because the cancellation was started by a DIFFERENT address?

Actually wait — the inner call is to `messagingContract().startL1ToL2MessageCancellation(...)` and `messagingContract().cancelL1ToL2Message(...)`. The Starknet messaging contract tracks who started the cancellation. So `depositCancelRequest` starts cancellation as `attacker`, then `depositReclaim` tries to cancel as `attacker` — this should work!

But actually, looking more carefully, there's also `LegacyBridge.legacyDepositCancelRequest` which DOES have `onlyDepositor(nonce)`:

```solidity
function legacyDepositCancelRequest(...) external onlyDepositor(nonce) {
```

But the new `depositCancelRequest` doesn't! This looks like an oversight — the legacy version was properly protected but the new version wasn't.

This is worth deep investigation. Let me note this.

**Priority 6 — Legacy bridge new/old format confusion**
- LegacyBridge deposits via old ABI `deposit(uint256 amount, uint256 l2Recipient)` but emits events from both old AND new format
- The old ABI deposit doesn't take a `token` parameter — it uses `bridgedToken()` which is a single stored address
- **Hunt:** Can old and new format messages collide on the L2 side? Different selectors but same L2 bridge address.

**Priority 7 — MaxTotalBalance can be set too low** 
- `setMaxTotalBalance` can be called by `onlyAppGovernor` to any value (except 0)
- Setting it below current balance freezes all deposits
- This is a griefing/governance risk but might be considered "centralization" by the program
- However — if `withdrawalLimitApplied` is also enabled, users can't even withdraw fully due to 5% daily cap
- Combine: freeze deposits + 5% daily withdrawal = effective freeze for 20 days for full withdrawal

---

### Known Prior Audits (Don't Re-Find These)
- **Zellic** — Oct 2023, Oct 2024 (Paradex fork of StarkGate, but relevant)
- **Trail of Bits** — Sep 2022 (Starknet Core)
- **Nethermind** — NM0050-STARKGATE-DRAFT-REPORT.pdf, NM0064-DRAFT_STARKGATE.pdf
- **ZK Risk Analysis (Dec 2025)** — Governance centralization: 7 roles without on-chain multisig

---

### Hunting Strategy Summary

```
1. depositCancelRequest/depositReclaim → anyone can steal pending deposits? (CRITICAL if confirmed)
2. LegacyBridge.consumeMessage() try/catch → old/new format confusion (HIGH)
3. WithdrawalLimit balanceOf donation inflation → bypass 5% cap (MEDIUM)
4. checkDeploymentStatus piggyback race → expired token handling (MEDIUM)
5. enrollToken double-enrollment → L1-L2 msg queue manipulation (MEDIUM)
6. MaxTotalBalance + withdrawal limit combo → DoS freeze (LOW/MEDIUM)
```

---

## OKX-Specific OKX/CEX Exclusion Gotchas (from HP OKX program rules)

These are NOT bountyable even if they look bad:
- **Self-XSS / Self-clickjacking** — requires victim interaction with their own session
- **Information disclosure of own account** — finding your own email/phone/etc.
- **Missing SPF/DMARC/DKIM** — standard email config gap
- **Missing security headers** (HSTS, X-Frame-Options, etc.) — known, low priority
- **Password policy without 2FA bypass** — unless you can bypass 2FA
- **DoS via ZIP bombs, image bombs, or API abuse** — rate limits expected
- **Social engineering of customer support** — unless you can demonstrate code execution
- **Physical attacks** — not in scope for web/app programs

**HackenProof "Hidden Gem" strategy**: OKX is on the "Hidden Gems" list — programs that HP promotes as higher-quality, less competitive targets. Fewer hackers competing means higher chance of finding something fresh.

**Key HP policy rule**: "If the submission is not in scope but has high-critical severity, it will be reviewed and the team may decide payment." — Always submit out-of-scope criticals anyway.

---

*Built for precision web3 bug hunting — one confirmed critical > ten informational.*
