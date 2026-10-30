---
name: injection-surface-mapper
category: recon
domain: cross-cutting
description: "Recon-first workflow to locate where SQLi / command injection / RCE actually live in a target and decide where to test. Maps each injection family to its real-world sinks, ranks entry points by reachability and auth, and produces a prioritized test plan before any payload is sent. Use when starting a new web target, when a large surface feels too big to cover, or when asked where to hunt for injection bugs."
priority: high
---

# Injection Surface Mapper — recon before payloads

## Why this exists

Most injection hunting fails not from weak technique but from **testing the
wrong surface**. Teams spray `'` at 400 GET parameters, miss the one JSON field
that reaches `unserialize()`, and report nothing.

Injected input is not a flat list of parameters. It is a **graph**: a small set
of *sinks* (dangerous functions) fed by a large set of *sources*. Find the sinks
first, then trace backwards to reachable sources. That inverts the usual order
and is why it works.

**Hard rule: do not send a single payload until the surface map exists.**
An unmapped target produces noise, rate-limit bans, and zero findings.

---

## Phase 0 — Authorization (non-negotiable)

Before any probing, confirm and record:

- [ ] Written authorization or an in-scope program entry (HackerOne/Bugcrowd/Intigriti scope page, pentest SOW, or CTF)
- [ ] Exact in-scope hosts/domains/IPs — including whether `*.example.com` is included
- [ ] Explicit exclusions (third-party/CDN/analytics, other tenants, DoS, social engineering, physical)
- [ ] Rate limits and testing windows
- [ ] Whether automated scanning is permitted (many programs forbid it)
- [ ] Data-handling rules (what you may retrieve vs. what must be proved by hash/count only)

If any of this is unclear, **ask before testing.** A missing scope answer is a
stop condition, not something to work around.

---

## Phase 1 — Cheap passive recon (no requests to the target app)

Order matters — cheapest and highest-yield first.

```bash
# 1. Subdomains + DNS
subfinder -d example.com -all -silent
dnsx -l subs.txt -a -aaaa -cname -resp-only

# 2. Live hosts, ports, titles, tech
httpx -l subs.txt -sc -title -td -tech-detect -asn -cname -status-code -o live.txt

# 3. URL history (find forgotten params, old API versions)
waybackurls example.com | sort -u > urls.txt
cat subs.txt | waybackurls | sort -u > urls_all.txt

# 4. Google dorks
# site:example.com inurl:api | inurl:admin | inurl:upload | ext:sql | ext:bak | ext:env

# 5. JS/maps (see js-hunter skill for the full pipeline)
gospider -s https://example.com/robots.txt -d 2 --js -t 50
```

**Read the files that leak the map:** `robots.txt`, `sitemap.xml`,
`.well-known/security.txt`, `openapi.json`/`swagger.json`, `api-docs`,
`/actuator`, `/.git/config`, `/.env`, `config.php.bak`, `debug/`, `_profiler/`.

A leaked `openapi.json` is worth more than a week of fuzzing — it hands you the
complete parameter inventory with types and required flags.

---

## Phase 2 — Build the sink inventory (the actual recon deliverable)

For each discovered technology, enumerate the **known-dangerous sinks** it
contains. You are not looking for vulnerabilities yet — you are building a list
of places where injection *would* be critical.

### By technology

| Stack | High-yield sinks |
|---|---|
| **PHP** | `system`, `exec`, `shell_exec`, `passthru`, `popen`, `proc_open`, `eval`, `assert`, `create_function`, `unserialize`, `include`/`require` with variable path, `file_put_contents` with variable path, `preg_replace` `/e` |
| **Python/Django/Flask** | `os.system`, `subprocess.*` with `shell=True`, `eval`/`exec`, `pickle.loads`, `yaml.load` (no `SafeLoader`), `render_template_string` (SSTI), `__import__` |
| **Java** | `Runtime.exec`, `ProcessBuilder`, JNDI `InitialContext.lookup` (Log4Shell class), `ObjectInputStream.readObject`, Jackson `enableDefaultTyping`, SpEL `parseExpression`, `ScriptEngine.eval`, MyBatis `${}` (vs `#{}`) |
| **Node.js** | `child_process.exec`/`spawn` with `shell:true`, `eval`, `new Function`, `vm.runInContext`, `require` with variable path, `JSON.parse` → `vm`, prototype pollution sinks (`Object.assign`, lodash `merge`/`set`) |
| **.NET** | `Process.Start`, `SqlCommand` with concatenated text, `XmlDocument`/`XmlReader` with `DtdProcessing.Parse` (XXE), `BinaryFormatter.Deserialize` (never safe), Razor `@Html.Raw` |
| **Go** | `exec.Command`, `template.HTML` (not `template.HTMLTmpl`), `os.Create` with variable path |
| **Ruby** | `system`, `exec`, backticks, `eval`, `Marshal.load`, `YAML.load` (unsafe) |
| **SQL** | any string-concatenated or f-string/f-interpolated query; ORM escape hatches: `.raw()`, `text()`, `query()`, `$queryRawUnsafe`, `whereRaw`, `extra()` |
| **Templates** | Jinja2 `render_template_string`, Twig `|raw`, Freemarker `<#assign>`, Velocity `${}`, ERB `<%= %>`, Thymeleaf `__${}__` |
| **Erlang/Elixir** | `:os.cmd`, `Code.eval_string` |

### By feature (often higher yield than the stack list)

- **File upload** → RCE via webshell, SSTI, polyglot, XXE (SVG/DOCX), path traversal
- **Import/export** → XXE, formula injection (CSV), deserialization, zip-slip
- **PDF/report generation** → SSRF, XXE, command injection, LFI
- **Image/media processing** → ImageMagick/ffmpeg command injection, SSRF via SVG
- **Webhook / URL fetch** → SSRF, internal metadata
- **GraphQL** → batching abuse, depth DoS, field-level authz, injection via arguments
- **Admin/CMS panel** → deserialization, file manager, template editor, SQLi
- **CI/CD / build config** → command injection via branch name, PR title, webhook payload
- **Email/notification templates** → SSTI, header injection
- **Search / autocomplete / facets** → SQLi, NoSQLi, ReDoS

### By transitive dependency (the layer most recon misses)

The application's own code is the *reviewed* layer. The native library it calls
is not. Build an inventory of what sits underneath:

- **Image/media** → `libheif`/`libde265` (HEIC/AVIF), `libvips`, `sharp`,
  ImageMagick, `libwebp`, `libtiff`, `libjxl`
- **Archives/docs** → `libxml2`, `libpoppler`, `openpyxl`, `libreoffice`,
  `pdfium`, `libzip`
- **Crypto/compression** → `zlib`, `liblzma`, `openssl`, `libssh2`
- **Runtime** — the language runtime itself and its C extensions

For each: check the **installed** version in the image (not the manifest), and
whether the fix has a CVE. An upstream fix with no CVE is routinely never
backported by distributions — this exact gap produced unauthenticated RCE at
Next.js, Meta, Slack, GitHub Enterprise, and an OpenAI forum in 2026. See
`rce-cmdi-sink-chains` §3.

**Then check the fallback path.** For each input type, find what handles the
case the primary library does *not* support. In the OpenAI chain, the image
validator (FastImage) did not support HEIF, so HEIC files were routed to
ImageMagick — a completely different, native, memory-unsafe parser that nobody
had threat-modelled. Unsupported format → fallback → different sink.

Two questions that reliably find this class:
1. "What file type does this endpoint accept that the *validator* cannot parse?"
2. "If this parser throws on the input, what does the error handler call instead?"


---

## Phase 3 — Rank entry points (where to actually test)

Score each candidate sink by four factors. Highest total goes first.

| Factor | Low | High |
|---|---|---|
| **Reachability** | needs admin, internal network | unauthenticated, pre-auth |
| **Control** | value passes through a sanitizer/allowlist | value reaches sink unmodified |
| **Privilege** | sink runs as low-priv/unprivileged user | sink runs as root/SYSTEM/`www-data` with fs+net |
| **Observability** | blind only, heavily rate-limited | response or OOB channel, no rate limit |

**Pre-auth + high-privilege sink = start here.** Everything else is secondary.

### The "sort by blast radius" heuristic

Even without a confirmed bug, ask: *if this input were fully controlled, what
would happen?* Answering that decides where to spend your time. A pre-auth
`Runtime.exec` is worth 40 endpoints of low-value reflected XSS.

### Rank memory-corruption CVEs above app-layer nits

One correction to the usual instinct. It is common to deprioritise "just a
library CVE, exploitation is hard, it's probably not reachable." In 2026 that
reasoning produced a run of unauthenticated RCEs at Next.js, Meta, Slack, GitHub
Enterprise, and OpenAI's own forum — all from one image-decoding dependency,
each adapted in one to two days, for a few thousand dollars in compute.

So when ranking, treat a reachable memory-corruption CVE in a ubiquitous
dependency as **top priority regardless of exploitation difficulty**, and
explicitly retire the "too hard to exploit" discount for that class. The same
logic applies to the defender: that is why dependency patching has to be fast.


---

## Phase 4 — Map the path from source to sink

For each ranked candidate, trace the data path and record every hop:

```
HTTP param "q"
 → framework binding        (does it decode? validate? type-coerce?)
 → controller/service layer (sanitizer applied here? which one?)
 → ORM / query builder      (parameterized, or string-concatenated?)
 → DB                       (SINK)
```

**Enumerate the hops you did not expect.** The bug is almost always in a hop
someone forgot: a debug-only branch, a CSV export path, a GraphQL resolver, a
cron job, a webhook retry, a legacy v1 API kept for compatibility.

> Highest-value target class: **shadow/legacy code paths.**
> A `v2`/`internal`/`debug`/`_old` endpoint that predates the sanitizer is the
> single most productive thing to look for. Enumerate versions explicitly:
> `/api/v1/`, `/api/v2/`, `/internal/`, `/admin/`, `/graphql`, `/_next/`.

### Check the second-order sinks

Data that is *stored* safely on write is often *read* unsafely later:

- username → password-reset query
- uploaded filename → later template render
- profile field → admin panel that echoes it
- import CSV → later export

Second-order injection defeats input validation entirely because the payload
enters through a "safe" path and detonates elsewhere. Scanners miss it; manual
code reading finds it fast. If you have source access, **grep for the read
path**, not the write path.

---

## Phase 5 — Choose the technique per sink

| Sink family | Start with | Escalate to |
|---|---|---|
| SQL string concat | boolean + error-based | time-based, OOB, stacked |
| Shell exec | metachar separator | blind time, OOB, argument injection |
| Template render | arithmetic probe `{{7*7}}` | engine-specific RCE |
| Deserializer | benign object probe | gadget chain per library |
| File upload | extension + magic-byte + filename | polyglot, re-encode, path traversal |
| XML parser | external entity | parameter entity (blind), XInclude |
| URL fetch | `http://127.0.0.1/` | cloud metadata, redirect chain, DNS rebind |

Load `sqli-modern-techniques` and `rce-cmdi-sink-chains` at this point, not
before — technique selection is meaningless until the sink is known.

**Test order per parameter:** one benign baseline → one probe → observe diff →
only then escalate. Never start with the maximal payload; you learn nothing and
you burn rate limit.

---

## Deliverable: the pre-test map

Before testing, write down:

1. **Scope** — hosts in/out, authorization reference
2. **Sink inventory** — by technology and by feature
3. **Ranked top 10 entry points** with scores
4. **Full source→sink paths** for the top 3
5. **Technique per entry point** from the Phase 5 table
6. **Testing windows and rate limits**
7. **Out-of-bounds list** — what you will *not* touch

This map is also the first section of your final report, and it makes the
recon auditable by a triager.

---

## Common recon failures

| Mistake | Consequence |
|---|---|
| Testing before mapping | noise, bans, no findings |
| Only fuzzing query strings | miss JSON/multipart/header/cookie/graphQL/path sinks |
| Ignoring headers | WAF bypass, SSRF, smuggling, log injection all live here |
| Ignoring the second path | miss legacy/v2/debug/internal endpoints with the real bugs |
| Assuming GET/POST only | PUT/PATCH/DELETE and custom verbs bypass many rules |
| No baseline | cannot recognize a differential response |
| Ignoring rate limits | IP ban, and a hostile signal to the target |
| Testing third-party assets | out of scope, potential legal exposure |

## Stop conditions

- Authorization unclear → **ask, do not probe**
- Rate limit or WAF ban hit → back off, reduce rate, re-evaluate scope
- Target actively blocks → do not escalate; document and switch surface
- No sink found after mapping → this target is not an injection target; pivot or
  reconsider the engagement rather than brute-forcing
