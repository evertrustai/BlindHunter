#!/usr/bin/env python3
"""
depconf.py — Dependency Confusion detector & hunter for npm and cargo/crates.

Two jobs:

  1) AUDIT a codebase you have (package.json/.npmrc/lockfiles, Cargo.toml/Cargo.lock):
     classify every declared dependency by its *source*, then check the PUBLIC
     registry to see whether the name is claimable. A name pulled "by name" that
     does NOT exist publicly and is not pinned to a private/local source is the
     classic dependency-confusion condition — an attacker registers it with a
     higher version and the build executes attacker code.

  2) RECON from the outside (--recon): scrape candidate package names out of
     public JS bundles, .map sourcemaps (the `sources` array), HTML, HAR exports,
     and plain text, then report which ones are UNCLAIMED on the public registry.
     (~5% of bug-bounty assets leak claimable internal names this way.)

Stdlib only. Python 3.7+. No pip installs.

Examples:
    depconf.py ./repo                      # audit a checkout (npm + cargo)
    depconf.py ./repo --json
    depconf.py --recon bundle.js app.js.map index.html traffic.har
    depconf.py --recon ./dumped_site --ecosystem npm
    depconf.py --name @acme/widgets --ecosystem npm     # one-off claimability check
    depconf.py ./repo --offline            # classify only, no network

Exit: 2 if any HIGH finding, 1 on usage/parse error, else 0.
"""
import argparse
import concurrent.futures
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

NPM_REGISTRY = "https://registry.npmjs.org"
NPM_SEARCH = "https://registry.npmjs.org/-/v1/search"
CRATES_API = "https://crates.io/api/v1/crates"
UA = "depconf/2.0 (dependency-confusion auditor; authorized testing)"

SKIP_DIRS = {"node_modules", "target", ".git", "vendor", "dist", "build",
             ".next", ".cargo", "bower_components", ".venv", "__pycache__"}

NODE_BUILTINS = {
    "assert", "buffer", "child_process", "cluster", "console", "constants",
    "crypto", "dgram", "dns", "domain", "events", "fs", "http", "http2",
    "https", "inspector", "module", "net", "os", "path", "perf_hooks",
    "process", "punycode", "querystring", "readline", "repl", "stream",
    "string_decoder", "sys", "timers", "tls", "trace_events", "tty", "url",
    "util", "v8", "vm", "wasi", "worker_threads", "zlib",
}

# ---------------------------------------------------------------------------
# HTTP with tiny cache
# ---------------------------------------------------------------------------
_cache = {}


def _status(url, timeout=10):
    if url in _cache:
        return _cache[url]
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            code = r.status
            r.read(1)
    except urllib.error.HTTPError as e:
        code = e.code
    except Exception:
        code = None
    _cache[url] = code
    return code


def _get_json(url, timeout=10):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Registry existence checks
# ---------------------------------------------------------------------------
def npm_pkg_exists(name):
    """True=claimed, False=available(404), None=network error."""
    enc = name.replace("/", "%2f") if name.startswith("@") else urllib.parse.quote(name, safe="")
    code = _status(f"{NPM_REGISTRY}/{enc}")
    return None if code is None else code == 200


def npm_scope_in_use(scope):
    """Is @scope owned by anyone publicly? Search endpoint: any package under the
    scope => scope is reserved (attacker can't publish). Empty => claimable scope."""
    url = f"{NPM_SEARCH}?{urllib.parse.urlencode({'text': 'scope:' + scope, 'size': 1})}"
    data = _get_json(url)
    if data is None:
        return None
    try:
        return data.get("total", 0) > 0
    except AttributeError:
        return None


def crate_exists(name):
    code = _status(f"{CRATES_API}/{urllib.parse.quote(name, safe='')}")
    return None if code is None else code == 200


# ---------------------------------------------------------------------------
# File discovery
# ---------------------------------------------------------------------------
AUDIT_FILES = ["package.json", ".npmrc", ".yarnrc.yml", "package-lock.json",
               "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml",
               "pnpm-workspace.yaml", "Cargo.toml", "Cargo.lock"]


def discover(root):
    out = {f: [] for f in AUDIT_FILES}
    if os.path.isfile(root):
        b = os.path.basename(root)
        if b in out:
            out[b].append(root)
        return out
    for dp, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for f in filenames:
            if f in out:
                out[f].append(os.path.join(dp, f))
    return out


# ===========================================================================
# npm
# ===========================================================================
NPM_DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies",
                  "optionalDependencies"]


def npm_classify_spec(spec):
    s = (spec or "").strip()
    if s.startswith("npm:"):
        rest = s[4:]
        real = rest.rsplit("@", 1)[0] if "@" in rest[1:] else rest
        return "alias", real
    for pfx in ("file:", "link:", "portal:"):
        if s.startswith(pfx):
            return "local", s
    if s.startswith("workspace:"):
        return "workspace", s
    if s.startswith(("git+", "git:", "github:", "gitlab:", "bitbucket:")) or \
            re.match(r"^[\w.-]+/[\w.-]+(#.*)?$", s):
        return "git", s
    if s.startswith(("http://", "https://")) and s.endswith((".tgz", ".tar.gz")):
        return "tarball", s
    return "registry", s


def parse_npmrc(path):
    default_private, scope_map = False, {}
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.split("#", 1)[0].split(";", 1)[0].strip()
                if "=" not in line:
                    continue
                key, val = [x.strip() for x in line.split("=", 1)]
                m = re.match(r"^(@[\w.-]+):registry$", key)
                if m:
                    scope_map[m.group(1)] = val
                elif key == "registry" and "npmjs.org" not in val and "yarnpkg.com" not in val:
                    default_private = True
    except Exception:
        pass
    return default_private, scope_map


def parse_yarnrc_yml(path):
    """Very light YAML scrape for Yarn Berry npmScopes / npmRegistryServer."""
    default_private, scope_map = False, {}
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except Exception:
        return default_private, scope_map
    m = re.search(r"^npmRegistryServer:\s*[\"']?(\S+?)[\"']?\s*$", text, re.M)
    if m and "npmjs.org" not in m.group(1):
        default_private = True
    # npmScopes:\n  acme:\n    npmRegistryServer: "https://..."
    for sm in re.finditer(r"^\s{2}([\w.-]+):\s*$\n((?:\s{4}.*\n?)+)", text, re.M):
        scope, block = sm.group(1), sm.group(2)
        rm = re.search(r"npmRegistryServer:\s*[\"']?(\S+?)[\"']?\s*$", block, re.M)
        if rm:
            scope_map["@" + scope] = rm.group(1)
    return default_private, scope_map


def parse_npm_lockfile(path):
    """Return (local_names:set, internal_resolved:dict{name: host}, default_private:bool).
    internal_resolved = names whose tarball was served by a NON-npmjs host => proven
    private deps and therefore prime confusion targets."""
    local, internal, default_private = set(), {}, False
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception:
        return local, internal, default_private
    if data.get("name"):
        local.add(data["name"])

    def note(name, resolved, link=False):
        if not name:
            return
        if link or resolved in (None, "",):
            local.add(name)
            return
        host = urllib.parse.urlparse(resolved).netloc
        if host and "npmjs.org" not in host and "yarnpkg.com" not in host:
            internal[name] = host

    # lockfile v2/v3: "packages": { "node_modules/<name>": {...}, "": {root} }
    for key, meta in (data.get("packages") or {}).items():
        if not isinstance(meta, dict):
            continue
        if key == "":
            if meta.get("name"):
                local.add(meta["name"])
            continue
        idx = key.rfind("node_modules/")
        name = key[idx + len("node_modules/"):] if idx >= 0 else key
        note(meta.get("name", name), meta.get("resolved"), meta.get("link"))
    # legacy v1: "dependencies": { "<name>": {resolved,...} }
    for name, meta in (data.get("dependencies") or {}).items():
        if isinstance(meta, dict):
            note(name, meta.get("resolved"))
    # NOTE: a package resolved from a private host does NOT mean the *default*
    # registry is private (it may be a per-scope mapping). Only an explicit
    # `registry=<non-npmjs>` in .npmrc/.yarnrc sets default_private. We keep the
    # per-name `internal` evidence, which only ever RAISES a finding's confidence.
    return local, internal, default_private


def collect_npm(files, offline):
    findings = []
    local_names, internal_resolved = set(), {}
    default_private, scope_map = False, {}

    for p in files[".npmrc"]:
        dp, sm = parse_npmrc(p)
        default_private |= dp
        scope_map.update(sm)
    for p in files[".yarnrc.yml"]:
        dp, sm = parse_yarnrc_yml(p)
        default_private |= dp
        scope_map.update(sm)
    for p in files["package-lock.json"] + files["npm-shrinkwrap.json"]:
        ln, ir, dp = parse_npm_lockfile(p)
        local_names |= ln
        internal_resolved.update(ir)
        default_private |= dp

    parsed = []
    for p in files["package.json"]:
        try:
            with open(p, encoding="utf-8") as fh:
                data = json.load(fh)
        except Exception as e:
            findings.append(mk("npm", p, "<file>", "ERROR", "parse", str(e), "info"))
            continue
        if isinstance(data, dict) and data.get("name"):
            local_names.add(data["name"])
        parsed.append((p, data))

    seen = {}
    for p, data in parsed:
        if not isinstance(data, dict):
            continue
        for field in NPM_DEP_FIELDS:
            deps = data.get(field) or {}
            if not isinstance(deps, dict):
                continue
            for name, spec in deps.items():
                kind, detail = npm_classify_spec(str(spec))
                eff = detail if kind == "alias" else name
                seen.setdefault((eff, kind), []).append((p, field, spec))
    # add lockfile-proven internal deps that aren't already covered
    for name in internal_resolved:
        if name not in local_names and not any(k[0] == name for k in seen):
            seen.setdefault((name, "registry"), []).append(
                ("(lockfile)", "resolved-from-private", "lockfile"))

    work = list(seen.keys())

    def assess(item):
        name, kind = item
        scope = name.split("/")[0][1:] if name.startswith("@") and "/" in name else None
        r = {"name": name, "kind": kind, "scope": scope, "exists": None, "scope_in_use": None}
        if name in local_names:
            r["verdict"] = ("safe", "info", "in-repo workspace/local package"); return r
        if kind in ("local", "git", "tarball"):
            r["verdict"] = ("safe", "info", f"pinned to explicit {kind} source"); return r
        if kind == "workspace":
            r["verdict"] = ("safe", "info", "workspace: protocol (monorepo-local)"); return r
        if offline:
            r["verdict"] = ("unknown", "review", "registry check skipped (--offline)"); return r
        exists = npm_pkg_exists(name)
        r["exists"] = exists
        if exists is None:
            r["verdict"] = ("unknown", "review", "npm registry unreachable"); return r
        if exists:
            r["verdict"] = ("safe", "info", "name is claimed on public npm"); return r
        proven = name in internal_resolved
        if scope:
            in_use = npm_scope_in_use(scope)
            r["scope_in_use"] = in_use
            scope_priv = bool(scope_map.get("@" + scope)) and "npmjs.org" not in scope_map.get("@" + scope, "")
            if in_use is True:
                sev, why = "low", (f"missing on npm but scope @{scope} is reserved by an org — "
                                   f"attacker cannot publish under it (verify YOU own @{scope})")
            elif in_use is False:
                sev, why = "high", (f"@{scope} scope is UNCLAIMED on npm — attacker can create the "
                                    f"org and publish {name}")
            else:
                sev, why = "medium", "scoped package missing on npm; scope ownership unconfirmed"
            if scope_priv:
                why += f" | .npmrc/.yarnrc maps @{scope} to a private registry (install-config dependent)"
            r["verdict"] = ("confusable", sev, why); return r
        if proven:
            # lockfile shows this exact name was served by a private host AND it is
            # unclaimed publicly => definitely an internal dep with a free public name.
            sev, why = "high", ("unscoped name UNCLAIMED on npm; lockfile proves it is served by a "
                                "private registry — confirmed internal dep, register to hijack")
        elif default_private:
            sev, why = "medium", ("unclaimed on npm; .npmrc/.yarnrc default registry is private "
                                  "(risk depends on proxy/--registry behavior)")
        else:
            sev, why = "high", ("unscoped name UNCLAIMED on public npm — classic dependency "
                                "confusion; register it to hijack the build")
        r["verdict"] = ("confusable", sev, why); return r

    results = run_checks(work, assess, "npm")
    for item in work:
        r = results[item]
        v, sev, why = r["verdict"]
        p, field, spec = seen[item][0]
        findings.append(mk("npm", p, r["name"], v.upper(), field, why, sev, extra={
            "kind": r["kind"], "spec": str(spec), "exists_public": r["exists"],
            "scope_in_use": r["scope_in_use"], "occurrences": len(seen[item]),
            "proven_internal": r["name"] in internal_resolved}))
    return findings


# ===========================================================================
# cargo  (minimal TOML reader — no tomllib on 3.9 — plus Cargo.lock awareness)
# ===========================================================================
def _strip_toml(v):
    v = v.strip()
    return v[1:].split(v[0], 1)[0] if v and v[0] in "\"'" else v


def _inline_table(s):
    out = {}
    body = s.strip().lstrip("{").rstrip("}")
    for part in re.split(r",(?=(?:[^\"']*[\"'][^\"']*[\"'])*[^\"']*$)", body):
        if "=" not in part:
            continue
        k, v = part.split("=", 1)
        k, v = k.strip(), v.strip()
        out[k] = (v == "true") if v in ("true", "false") else _strip_toml(v)
    return out


def parse_cargo_toml(path):
    try:
        with open(path, encoding="utf-8") as fh:
            lines = fh.readlines()
    except Exception as e:
        return None, f"read error: {e}"
    res = {"package_name": None, "members": [], "deps": {}}
    section, sub_dep = None, None
    SEC = re.compile(r"^\[\s*(?:(?:target\.[^\]]+?\.)|workspace\.)?"
                     r"(dependencies|dev-dependencies|build-dependencies)\s*\]\s*$")
    SUB = re.compile(r"^\[\s*(?:(?:target\.[^\]]+?\.)|workspace\.)?"
                     r"(dependencies|dev-dependencies|build-dependencies)\.([\w.-]+)\s*\]\s*$")
    for raw in lines:
        st = raw.split("#", 1)[0].strip()
        if not st:
            continue
        if st.startswith("["):
            sub_dep = None
            m = SUB.match(st)
            if m:
                section, sub_dep = m.group(1), m.group(2)
                res["deps"].setdefault(section, {}).setdefault(sub_dep, {})
                continue
            m = SEC.match(st)
            if m:
                section = m.group(1); res["deps"].setdefault(section, {}); continue
            section = "package" if st.startswith("[package]") else \
                      "workspace" if st.startswith("[workspace]") else "_other"
            continue
        if "=" not in st:
            continue
        key, val = st.split("=", 1)
        key, val = key.strip(), val.strip()
        if section == "package" and key == "name":
            res["package_name"] = _strip_toml(val)
        elif section == "workspace" and key == "members":
            res["members"] = re.findall(r"[\"']([^\"']+)[\"']", val)
        elif section in ("dependencies", "dev-dependencies", "build-dependencies"):
            tbl = res["deps"].setdefault(section, {})
            if sub_dep is not None:
                spec = tbl.setdefault(sub_dep, {})
                spec[key] = (True if val == "true" else False if val == "false" else _strip_toml(val))
            else:
                tbl[key] = _inline_table(val) if val.startswith("{") else {"version": _strip_toml(val)}
    return res, None


def parse_cargo_lock(path):
    """Cargo.lock [[package]] source strings:
       crates.io  -> registry+https://github.com/rust-lang/crates.io-index (or sparse+)
       alt-reg    -> registry+<url> / sparse+<url> (not crates.io-index)
       git        -> git+<url>#<ref>
       local/path -> no `source` line
    Returns (public_names:set, local_names:set, alt_names:set)."""
    public, local, alt = set(), set(), set()
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except Exception:
        return public, local, alt
    for block in text.split("[[package]]"):
        nm = re.search(r'^\s*name\s*=\s*"([^"]+)"', block, re.M)
        if not nm:
            continue
        name = nm.group(1)
        sm = re.search(r'^\s*source\s*=\s*"([^"]+)"', block, re.M)
        if not sm:
            local.add(name)
        elif "crates.io-index" in sm.group(1):
            public.add(name)
        elif sm.group(1).startswith(("git+",)):
            local.add(name)  # git-pinned, not confusable via crates.io
        else:
            alt.add(name)
    return public, local, alt


def cargo_source_kind(spec):
    if spec.get("path"):
        return "local", spec["path"]
    if spec.get("git"):
        return "git", spec["git"]
    if spec.get("workspace") is True:
        return "workspace", "workspace = true"
    reg = spec.get("registry")
    if reg and reg != "crates-io":
        return "alt-registry", reg
    return "registry", spec.get("version", "*")


def collect_cargo(files, offline):
    findings = []
    parsed, local_names = [], set()
    lock_public, lock_local, lock_alt = set(), set(), set()
    for p in files["Cargo.lock"]:
        pub, loc, alt = parse_cargo_lock(p)
        lock_public |= pub; lock_local |= loc; lock_alt |= alt
    local_names |= lock_local
    for p in files["Cargo.toml"]:
        data, err = parse_cargo_toml(p)
        if err:
            findings.append(mk("cargo", p, "<file>", "ERROR", "Cargo.toml", err, "info")); continue
        if data["package_name"]:
            local_names.add(data["package_name"])
        parsed.append((p, data))

    seen = {}
    for p, data in parsed:
        for section, deps in data["deps"].items():
            for name, spec in deps.items():
                if not isinstance(spec, dict):
                    spec = {"version": str(spec)}
                real = spec.get("package", name)
                kind, detail = cargo_source_kind(spec)
                seen.setdefault((real, kind), []).append((p, section, spec))

    work = list(seen.keys())

    def assess(item):
        name, kind = item
        r = {"name": name, "kind": kind, "exists": None}
        if name in local_names:
            r["verdict"] = ("safe", "info", "in-repo workspace member / path dep"); return r
        if kind in ("local", "git"):
            r["verdict"] = ("safe", "info", f"pinned to explicit {kind} source"); return r
        if kind == "workspace":
            r["verdict"] = ("unknown", "review",
                            "inherits from [workspace.dependencies] — confirm its source"); return r
        if kind == "alt-registry" or name in lock_alt:
            r["verdict"] = ("review", "low",
                            "pinned to a non-crates.io registry — Cargo does not disambiguate a "
                            "crate present in both registries (rust-lang/cargo#9162); confirm the "
                            "name can't be shadowed on crates.io"); return r
        if offline:
            r["verdict"] = ("unknown", "review", "registry check skipped (--offline)"); return r
        exists = crate_exists(name)
        r["exists"] = exists
        if exists is None:
            r["verdict"] = ("unknown", "review", "crates.io unreachable")
        elif exists:
            r["verdict"] = ("safe", "info", "name is claimed on crates.io")
        else:
            r["verdict"] = ("confusable", "high",
                            "name UNCLAIMED on crates.io and not pinned to a private source — "
                            "Cargo defaults to crates.io; register to hijack")
        return r

    results = run_checks(work, assess, "cargo")
    for item in work:
        r = results[item]
        v, sev, why = r["verdict"]
        p, section, spec = seen[item][0]
        findings.append(mk("cargo", p, r["name"], v.upper(), section, why, sev, extra={
            "kind": r["kind"], "spec": spec, "exists_public": r["exists"],
            "occurrences": len(seen[item])}))
    return findings


# ===========================================================================
# RECON mode — extract candidate names from artifacts, report claimable ones
# ===========================================================================
SCOPED_RE = re.compile(r"@[a-z0-9][\w.-]*\/[a-z0-9][\w.-]*", re.I)
REQUIRE_RE = re.compile(r"""(?:require|import)\s*\(?\s*['"]([^'"]+)['"]""")
FROM_RE = re.compile(r"""\bfrom\s+['"]([^'"]+)['"]""")
NODE_MODULES_RE = re.compile(r"node_modules/((?:@[\w.-]+/)?[\w.-]+)")
CARGO_USE_RE = re.compile(r"^\s*(?:pub\s+)?use\s+([a-z][a-z0-9_]+)\b", re.M)


def _pkg_root(spec):
    """Reduce an import specifier to its package root. None if relative/builtin."""
    if not spec or spec[0] in "./" or spec.startswith("\\"):
        return None
    if spec.startswith("@"):
        parts = spec.split("/")
        return "/".join(parts[:2]) if len(parts) >= 2 else None
    root = spec.split("/")[0]
    if root in NODE_BUILTINS or root.startswith("node:"):
        return None
    return root


def extract_candidates(path, ecosystem):
    """Yield candidate (ecosystem, name) from one file (JS/map/HTML/HAR/text)."""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    except Exception:
        return
    names = set()
    if ecosystem in (None, "npm"):
        # sourcemap: parse `sources` array if JSON
        if path.endswith(".map"):
            try:
                for s in (json.loads(text).get("sources") or []):
                    for m in NODE_MODULES_RE.findall(s):
                        names.add(m)
                    # webpack://@scope/pkg/... style
                    w = re.match(r"webpack://(@[\w.-]+/[\w.-]+|[\w.-]+)/", s)
                    if w:
                        names.add(w.group(1))
            except Exception:
                pass
        for m in NODE_MODULES_RE.findall(text):
            names.add(m)
        for m in SCOPED_RE.findall(text):
            names.add(m)
        for rx in (REQUIRE_RE, FROM_RE):
            for spec in rx.findall(text):
                r = _pkg_root(spec)
                if r:
                    names.add(r)
        for n in names:
            r = _pkg_root(n) or n
            if r and (r.startswith("@") or re.match(r"^[\w.-]+$", r)):
                yield "npm", r
    if ecosystem == "cargo":  # only when explicitly asked (avoids std/keyword noise)
        for m in CARGO_USE_RE.findall(text):
            if m not in {"std", "core", "alloc", "self", "crate", "super"}:
                yield "cargo", m


def recon(paths, ecosystem, offline):
    cands = set()
    for p in paths:
        targets = [p] if os.path.isfile(p) else \
            [os.path.join(dp, f) for dp, dn, fn in os.walk(p)
             if not any(s in dp for s in SKIP_DIRS) for f in fn]
        for t in targets:
            for eco, name in extract_candidates(t, ecosystem):
                cands.add((eco, name))
    findings = []
    if offline:
        for eco, name in sorted(cands):
            findings.append(mk(eco, "(recon)", name, "UNKNOWN", "recon", "candidate (offline)", "review"))
        return findings
    npm_c = [n for e, n in cands if e == "npm"]
    crate_c = [n for e, n in cands if e == "cargo"]

    def npm_assess(name):
        ex = npm_pkg_exists(name)
        return name, ex
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for name, exists in ex.map(npm_assess, npm_c):
            if exists is False:
                scope = name.split("/")[0][1:] if name.startswith("@") and "/" in name else None
                if scope:
                    in_use = npm_scope_in_use(scope)
                    sev = "high" if in_use is False else "low" if in_use else "medium"
                    why = (f"leaked internal name; @{scope} scope " +
                           ("UNCLAIMED — register org + package" if in_use is False else
                            "reserved by an org (verify owner)" if in_use else
                            "ownership unconfirmed"))
                else:
                    sev, why = "high", "leaked internal name UNCLAIMED on public npm — claimable"
                findings.append(mk("npm", "(recon)", name, "CONFUSABLE", "recon", why, sev))
    for name in crate_c:
        if crate_exists(name) is False:
            findings.append(mk("cargo", "(recon)", name, "CONFUSABLE", "recon",
                               "leaked crate name UNCLAIMED on crates.io — claimable", "high"))
        time.sleep(1.1)
    if not findings:
        findings.append(mk("-", "(recon)", f"{len(cands)} candidates", "SAFE", "recon",
                           "no claimable internal names found", "info"))
    return findings


# ---------------------------------------------------------------------------
# concurrency: npm parallel, crates.io serialized (~1 req/sec policy)
# ---------------------------------------------------------------------------
def run_checks(work, assess, ecosystem):
    results = {}
    if not work:
        return results
    if ecosystem == "cargo":
        for it in work:
            results[it] = assess(it)
            time.sleep(1.1)
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
            futs = {ex.submit(assess, it): it for it in work}
            for f in concurrent.futures.as_completed(futs):
                results[futs[f]] = f.result()
    return results


# ---------------------------------------------------------------------------
# reporting
# ---------------------------------------------------------------------------
SEV_ORDER = {"high": 0, "medium": 1, "low": 2, "review": 3, "info": 4}


def mk(eco, path, name, verdict, field, why, sev, extra=None):
    return {"ecosystem": eco, "manifest": path, "name": name, "verdict": verdict,
            "field": field, "why": why, "severity": sev, "extra": extra or {}}


def render_text(findings):
    findings = sorted(findings, key=lambda f: (SEV_ORDER.get(f["severity"], 9), f["name"]))
    label = {"high": "HIGH ", "medium": "MED  ", "low": "LOW  ", "review": "RVIEW", "info": "info "}
    counts, lines = {}, []
    for f in findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1
        if f["severity"] == "info":
            continue
        rel = f["manifest"] if f["manifest"].startswith("(") else os.path.relpath(f["manifest"])
        lines.append(f"[{label.get(f['severity'], f['severity'])}] {f['ecosystem']:5} {f['name']}")
        lines.append(f"        {f['why']}")
        lines.append(f"        {rel}  ({f['field']}, source={f['extra'].get('kind','?')})")
    out = []
    if lines:
        out += ["DEPENDENCY CONFUSION FINDINGS", "=" * 64, *lines, ""]
    out.append(f"Summary: {counts.get('high',0)} HIGH  {counts.get('medium',0)} MEDIUM  "
               f"{counts.get('low',0)} LOW  {counts.get('review',0)} REVIEW  "
               f"{counts.get('info',0)} safe/info")
    if counts.get("high"):
        out.append("\n!! HIGH = registerable public name on the build path. Verify ownership, "
                   "then PoC per references/manual-techniques.md (never squat a name you don't own).")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description="Dependency confusion detector & hunter (npm + cargo)")
    ap.add_argument("path", nargs="*", help="dir/manifest to audit, or artifacts with --recon")
    ap.add_argument("--recon", action="store_true", help="scrape names from JS/map/HTML/HAR/text")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--offline", action="store_true", help="skip registry checks")
    ap.add_argument("--ecosystem", choices=["npm", "cargo"], help="limit ecosystem")
    ap.add_argument("--name", help="one-off claimability check (needs --ecosystem)")
    args = ap.parse_args()

    if args.name:
        if not args.ecosystem:
            print("--name requires --ecosystem npm|cargo", file=sys.stderr); return 1
        ex = npm_pkg_exists(args.name) if args.ecosystem == "npm" else crate_exists(args.name)
        print(json.dumps({"name": args.name, "ecosystem": args.ecosystem,
                          "claimed_public": ex, "confusable": ex is False}))
        return 0

    if not args.path:
        ap.print_usage(); return 1

    if args.recon:
        findings = recon(args.path, args.ecosystem, args.offline)
    else:
        findings = []
        for root in args.path:
            files = discover(root)
            if args.ecosystem in (None, "npm"):
                findings += collect_npm(files, args.offline)
            if args.ecosystem in (None, "cargo"):
                findings += collect_cargo(files, args.offline)

    print(json.dumps(findings, indent=2) if args.json else render_text(findings))
    return 2 if any(f["severity"] == "high" for f in findings) else 0


if __name__ == "__main__":
    sys.exit(main())
