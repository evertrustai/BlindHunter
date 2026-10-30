# Report template — dependency confusion

**Title:** Dependency confusion — internal package `<name>` (`<ecosystem>`) is
unclaimed on `<public-registry>` and resolvable by `<target>`'s build

## Summary
`<target>` builds with the `<ecosystem>` package **`<name>`**, referenced in
`<manifest path / leaked artifact>`. This name is **not registered** on the
public registry (`<registry.npmjs.org|crates.io>` returns 404) and is **not
pinned** to a private/local source. An attacker can publish `<name>` publicly
with a higher version; the next `<npm install|cargo build>` resolves the
attacker's package and executes its install/build script — arbitrary code
execution in the developer/CI environment.

## Severity
`<Critical/High>` — supply-chain RCE. CVSS 3.1:
`AV:N/AC:H/PR:N/UI:N/S:C/C:H/I:H/A:H` (adjust AC/UI to the real install trigger).

## Evidence
- Source of the name: `<package.json field / Cargo.toml table / sourcemap sources[] / HAR>`
- Public-registry claimability:
  - `curl -s -o /dev/null -w '%{http_code}' https://registry.npmjs.org/<name>` → `404`
  - (scoped) scope `@<scope>` search `total = 0` ⇒ scope is claimable
  - (cargo) `https://crates.io/api/v1/crates/<name>` → `404`
- `depconf.py` output:
  ```
  [HIGH ] <eco> <name>
          <why line>
          <manifest>  (<field>, source=registry)
  ```
- (if available) lockfile proof the name resolves from a private host:
  `<package-lock.json resolved URL>`

## Proof of Concept (ownership-safe)
1. Confirmed `<name>` is unowned (`npm owner ls` / crates.io 404).
2. Published a benign, high-version package under `<name>` *(only because
   <program authorized claiming this name / tested against my own install>)* with
   a passive `preinstall` that performs a single DNS/HTTP callback to a
   collaborator I control — no data exfiltration, no persistence.
3. Observed `<install command>` resolve **my** version `99.0.0` and the callback
   fire from `<host>` at `<timestamp>`.
4. Yanked/unpublished after confirmation. *(Logs attached.)*

## Impact
Code execution at install/build time → theft of CI/CD secrets and tokens,
poisoned build artifacts shipped to users, and lateral movement into internal
infrastructure. Confusion of a widely-used internal name affects every build
that installs it.

## Remediation
- Register/reserve `<name>` (and your org **scope**) on the public registry.
- Pin internal packages to a private registry per scope (`@org:registry=` in
  `.npmrc`) or, for Cargo, always set `registry =` / `path` / `git`.
- Use scoped names internally; commit lockfiles; restrict install scripts in CI.

## References
- Birsan, "Dependency Confusion" (2021).
- npm Docs — Threats and mitigations.
- rust-lang/cargo#9162 — registry disambiguation.
