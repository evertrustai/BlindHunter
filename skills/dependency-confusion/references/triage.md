# Triage — risk model, severity, false-positive killers

## The single condition
A dependency is **confusable** when ALL hold:
1. The build resolves it **by name** from a public registry (not pinned to file/git/path/tarball/workspace).
2. The exact name (or, for scoped packages, the **scope**) is **not claimed** on that public registry.
3. No config forces a private registry for that name in a way an attacker can't beat.

If any fails → not confusion.

## npm severity matrix

| Situation | Verdict | Why |
|-----------|---------|-----|
| Unscoped, 404 on npmjs, default registry = npmjs | **HIGH** | `npm install` pulls from npmjs; name is free → publish higher version, win |
| Unscoped, 404, lockfile shows it was served by a **private host** | **HIGH** | Proven internal dep; name free; classic confusion (proxy/version precedence) |
| `@scope/pkg` 404 **and scope unclaimed** on npm | **HIGH** | Attacker creates the org `@scope`, then publishes the package |
| `@scope/pkg` 404 but **scope reserved** by some org | **LOW** | Cannot publish under a reserved scope. (HIGH only if YOU prove the scope is yours and mis-mapped.) |
| Unscoped, 404, `.npmrc registry=` is a **private** default | **MEDIUM** | Depends on whether the private registry proxies npmjs and how it ranks versions; install flags (`--registry`) can flip it |
| Name **exists** on npmjs | SAFE | Just a normal public dependency |
| `file:`/`link:`/`portal:`/`workspace:`/`git+`/owner/repo/tarball URL | SAFE | Explicit non-registry source |
| In-repo `name` / monorepo workspace package | SAFE | Resolved locally |

### npm nuances that change the verdict
- **Security-holder placeholder.** A 200 isn't always "owned by the real org": npm
  publishes a placeholder under a security account for some unpublished/removed
  names. The package is taken (can't hijack) but it's a smell — note it.
- **Recently unpublished.** npm blocks re-publishing an unpublished name for 24h and
  may hold popular ones permanently. A 404 today can still be unclaimable — verify.
- **Aliases.** `"x": "npm:realname@^1"` resolves `realname`, not `x`. The engine follows it.
- **`--registry` / CI overrides.** A private default in `.npmrc` is bypassable if any
  build step passes `--registry https://registry.npmjs.org` or a virtual/proxy repo
  merges public + private and prefers the higher semver.
- **Transitive internal names.** Internal deps-of-deps in the lockfile install too;
  the engine surfaces lockfile-proven internal names even if absent from `package.json`.

## cargo / crates.io severity matrix

| Situation | Verdict | Why |
|-----------|---------|-----|
| Bare crate (`foo = "1"`), 404 on crates.io | **HIGH** | Cargo defaults to crates.io; unclaimed name → publish & hijack |
| `Cargo.lock` source = `registry+...crates.io-index` | SAFE | Came from crates.io (claimed) |
| `path = "..."` / `git = "..."` / no `source` in Cargo.lock | SAFE | Local / git-pinned, not registry-resolved |
| `registry = "alt"` (alternative registry) | **LOW / REVIEW** | Pinned to a private index. BUT Cargo doesn't disambiguate a crate present in **both** the alt registry and crates.io (rust-lang/cargo#9162) — confirm the name can't be shadowed |
| `workspace = true` | REVIEW | Inherits `[workspace.dependencies]`; resolve that entry, then re-classify |

### cargo nuances
- crates.io names are **permanent** — once published they can't be deleted/retaken,
  so a 404 is a clean "available". Yanked ≠ available.
- `-` vs `_`: crates.io treats them as distinct names but warns on confusing pairs.
  Check the exact string used in `Cargo.toml`.
- Default registry is crates.io unless `.cargo/config.toml [registries]` + a per-dep
  `registry =` redirect it. A bare name with an org that *thinks* it's internal is the bug.

## False-positive killers (run before reporting)
1. Re-check the name on the live registry yourself (the engine caches; networks blip).
2. Confirm it's not a workspace/local package under another path in the repo.
3. Confirm the scope (npm) isn't reserved — `npm-scope-in-use` via the search API.
4. Confirm no `.npmrc`/`.yarnrc.yml`/`.cargo/config.toml` pins it to a private index
   in a way the install actually honors.
5. Confirm impact: does this manifest actually get installed (prod build / CI), or is
   it a fixture/example/test-only file with no real install path?
