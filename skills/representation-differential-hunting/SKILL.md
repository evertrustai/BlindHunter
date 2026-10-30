---
name: representation-differential-hunting
category: methodology
domain: cross-cutting
description: "Hunt for injection and authorization flaws where a validator inspects one representation of attacker input while the consumer acts on a different one. Unifies WAF bypass, parser differentials, HPP, type-confusion validation gaps, and non-injective indexing. Use when a payload is blocked but the sink looks reachable, when two code paths disagree on a value, or when a fix appears to exist but bypasses are still reported. Also the fastest route to novel P1/P2 logic bugs in source-audit work."
priority: high
---

# Representation-Differential Hunting

## The one-line model

> **Injection succeeds when the thing that VALIDATES input looks at representation A,
> and the thing that CONSUMES input acts on representation B.**

Everything in this skill is an instance of that. It is the single highest-yield
mental model for finding P1/P2 logic bugs, because it is *structural* — you can
derive candidate bugs from code without needing a live target, and it generalizes
across SQLi, XSS, CMDi, RCE, deserialization, file upload, path traversal, authz
bypass, and even non-injection bugs like cache/index collisions.

Read `p1-unauth-recon-agent` for recon pipeline, `web-36-waf-bypass` for payload
lists. This skill is the *reason* a payload list fails and what to do instead.

---

## Why a "blocked" payload usually means a differential, not a wall

When a WAF blocks your literal payload, the correct inference is **not**
"strong protection." It is: *"the WAF and the application disagree about what
this string is."* Nearly every commercially reported "WAF bypass" is this bug
class, not a cryptanalytic break of the WAF.

Ask these four questions every time you get a 403:

1. **What representation did the WAF normalize to?** (raw / URL-decoded / NFKC / uppercase)
2. **What representation does the framework hand the sink?** (first param, last param, array, concatenated)
3. **Do they agree on encoding depth?** (single vs double decode)
4. **Do they agree on which value wins** when the parameter appears twice?

If any answer is "no," you have a differential and you do not need to defeat the WAF.
You need to make the WAF and the framework disagree.

---

## The differential families

### 1. Character-encoding narrowing (Java "Ghost Bits" / Cast Attack)

Java `char` is 16-bit; `byte` is 8-bit. A `char`→`byte` cast **silently drops
the high 8 bits**. A WAF inspecting the string sees a harmless Unicode character;
the backend reconstructing the byte gets the attacker's original ASCII byte.

**The lost high 8 bits are the "ghost bits."**

Trigger condition: Java backend + WAF/IDS + any payload family.

| Target sink | Family | Mechanism |
|---|---|---|
| Tomcat `RFC2231Utility` `filename*` | A | multipart `Content-Disposition: filename*=UTF-8''…` decoder casts non-`%` chars to byte, dropping high bits → **upload webshell via filename** |
| Apache Commons BCEL `ClassLoader` | A | wrap each bytecode byte in a char whose low 8 bits match → `$$BCEL$$` never appears in the WAF view |
| Jackson `charToHex` | C | non-ASCII char whose low 8 bits land on a populated index returns that hex digit → **SQLi smuggling** |
| Fastjson `\u` / `\x` escapes | B+C | escape handling narrows → deserialize bypass |
| Spring / Jetty / Undertow / Vert.x URL decode | A+B | single-byte expansion of multi-byte chars |
| Jetty `TypeUtil.fromHexDigit` (`%2>` fold) | B | `%2>` + illegal char collapses to `%2E` = `.` → `../` traversal **without ever emitting `..` or `%2e`** |
| Apache HttpClient ≤4.5.9 (HTTPCLIENT-1974/1978) | A | cast write emits raw `\r\n` → request smuggling / header CRLF |
| Angus Mail / Jakarta Mail | A | SMTP injection; Jira-style password-reset hijack (CVE-2025-57733) |
| Lettuce (Redis) | A | smuggle `\r\n` into RESP → `CONFIG SET dir` + `SAVE` → SSRF-to-RCE |
| Jodd `FileNameUtil` | A | path traversal via `阮` / `丯` |
| Vert.x `MultipartParser` | A | body parser narrowing |
| `XMLWriter` | A | tag-name injection → XXE/XSS pivot |

**Family B — bit-arithmetic folding:** an *illegal* char becomes *legal*.
`%2>` folding (Jetty) and fullwidth URL-encoded path traversal.

**Family C — table lookup:** a lookup table returns a hex digit for a
non-ASCII index (Jackson `charToHex`).

Concrete re-enabled "patched" CVEs: GeoServer CVE-2024-36401, Spring4Shell
CVE-2022-22965, Openfire CVE-2023-32315, Spring CVE-2025-41242, Jakarta Mail
CVE-2025-57733, JDK HttpServer CVE-2026-21933.

**Probe discipline:** replace **ONE** character with its Ghost variant first.
Observe status code, body length, header echo, error text, and timing. Only
escalate to full substitution if you see a diff.

Tight header contexts: prefer Latin-Extended (`Ŀ`, `ȧ`, `ȼ`) — one-byte UTF-8
expansion. Loose contexts: prefer CJK (`阮`, `陪`, `严`) to bias a WAF's
"this is just text" classifier.

### 2. Duplicate-parameter resolution (HTTP Parameter Pollution)

The WAF evaluates **both** values in isolation. The framework executes **one**.
Which one depends entirely on the framework — and almost no WAF is configured
for your specific stack.

| Framework | Strategy | Read function |
|---|---|---|
| PHP (Apache) | **last wins** | `$_GET['param']` |
| ASP.NET (IIS) | **comma-concatenation** | `Request["param"]` |
| Express.js (`qs`) | **array** | `req.query.param[0]` |
| Django | **last wins** | `QueryDict.get()` |
| Flask | **first wins** | `request.args.get()` |
| Java Servlet / Spring | **first wins** | `getParameter()` |
| Ruby on Rails | **last wins** | `params[:param]` |

- PHP → put the malicious value **last**
- Spring/Java → put it **first**
- ASP.NET → comma-concat yields `safe, ` and can escape signatures that check the complete value
- JSON bodies do **not** carry this differential (RFC 8259 duplicate keys → most parsers take last silently). HPP applies to **query strings** and `application/x-www-form-urlencoded` only.
- **Semicolons** are a second delimiter class some servers split on and others treat as data — a gap most WAF normalization rules miss.

Measured: the Ethiack study found the *most sophisticated* HPP payload hit a
**70.6%** WAF bypass rate; the simplest hit 17.6%. **No WAF vendor blocked all
three scenarios.** The bypass rate is not about payload sophistication — it is
the WAF inspecting a value the framework does not use.

Best real-world impact: H1 #2341038 — full ATO via `email=victim@…&email=attacker@…`
in password reset, because the code called the parsing function twice and the two
calls resolved the duplicate differently (first value minted the token, second
routed the email).

Automate with `mago.team` — tests duplicate params across an API, reports which
framework/WAF pairs create the differential.

### 3. Validation-representation mismatch (the CI4 pattern)

A validator checks one representation; storage/action uses another.

**CVE-2026-63223 (CodeIgniter 4, CVSS 9.8):** `is_image` / `mime_in` called
`getExtension()` — derived from **magic bytes** — and never called
`getClientExtension()` (the **client filename**). Prepend `GIF89a` to a PHP
webshell, name it `shell.php`: `is_image` sees `image/gif` → **pass**; file is
saved with `getClientName()` → `shell.php` in a PHP-executable directory → **RCE**.
Fix added `hasInvalidImageClientExtension()`.

**Generalized hunt — build a two-column table for every validation path:**

| Validator inspects | Consumer uses | Bug if different |
|---|---|---|
| magic-byte extension | client filename | CI4 webshell |
| Content-Type header | file content | trivial spoof |
| sanitized value | raw value | second-order |
| validated `txin.amount` | DB index keyed on amount | ETN-style |
| **declared** file name | **resolved** path (dir + symlink) | GHES CVE-2026-15343 |
| **declared** dimensions | **actual** allocation | libheif GHSA-2jg2-4ch7-h545 |
| validated artifact | artifact actually processed | GHES CVE-2026-19118 (TOCTOU) |

The last three are the highest-value rows, because the "correct" fix is
non-obvious and the code looks defensible when you read it. Three real 2026
cases, all HIGH or above:

**Declared name vs resolved path — CVE-2026-15343 (GHES 3.21.3, HIGH).**
Dependency-file path validation "checked only the declared file name and not the
effective path derived from the file's directory and **symlink target**." A
symlink therefore let an attacker write outside the intended directory —
including GitHub Actions workflow files, which then executed with repository
secrets under `pull_request_target` or auto-merge. **Fix pattern:** validate
`realpath()` after resolution, and reject symlinks outright. Never authorize on
a path you have not resolved.

**Declared geometry vs actual allocation — GHSA-2jg2-4ch7-h545 (libheif
≤1.23.1, 11 vulnerabilities).** Code assumed a `HeifPixelImage`'s `m_width` /
`m_height` described every channel plane, and that each `heif_channel` had at
most one plane. **Neither invariant was enforced anywhere.** Derived items
(`iden`, auxiliary `auxl` chains) let an attacker construct images violating
both, and ~12 consumers indexed planes using geometry those planes did not have
→ CWE-125 / CWE-369 / CWE-787. The transferable lesson is in
`rce-cmdi-sink-chains` §3: find the unenforced invariant, then count consumers.

**Validated artifact vs processed artifact — CVE-2026-19118 (GHES 3.21.5, HIGH).**
A race condition "replaced a validated upload with attacker-controlled content
before processing." The validator and the consumer operated on different objects
over time. This is the temporal dimension of the same idea: a differential
between *when you checked* and *when you used*. See `api-25-distributed-race`.

**Source-audit heuristic:** for every `validate*` / `isValid*` / `check*` call,
write down (a) which accessor it reads and (b) which accessor the consumer
downstream reads. If the strings differ (`getExtension` vs `getClientExtension`,
`raw` vs `sanitized`, `first` vs `last`, `name` vs `realpath`), you have found
it. Then ask two more questions that catch the subtler rows: *is the value
declared or resolved?* and *is the check and the use on the same object, at the
same time?*

### 3b. Sanitize → transform → forget to re-sanitize (mutation XSS)

The purest representation differential: the value is safe when checked and
unsafe when used, **with no attacker cleverness required at all** — the
transformation itself reintroduces the danger.

**CVE-2026-77912 (GHES 3.21.6, HIGH).** The Markdown rendering pipeline
"rewrote quote characters in already-sanitized HTML **without re-sanitizing the
result**." Crafted Markdown let an attacker inject arbitrary HTML attributes
into an already-clean page, executing script in another user's browser — reading
data visible to the victim, acting as the victim, exfiltrating, and propagating
using the victim's own write access.

Why this class is worth internalizing:

- **No filter bypass.** Every input was handled exactly as designed. The
  sanitizer was correct; the pipeline after it was not.
- **The fix is architectural.** Re-sanitize after any transform that can alter
  quoting, or use a DOM-aware sanitizer on the final output as the last step
  rather than on the input.
- **Audit every post-sanitization transform:** Markdown/HTML normalization,
  quote-entity rewriting, syntax highlighting, table-to-HTML conversion, diff
  rendering, email-archiving, PDF generation, template interpolation.

**Hunt it by grepping for the order, not the bug:** find every call site of the
sanitizer, then check what touches the value *after* it. `sanitize()` followed by
`gsub`, `replace`, `normalize`, `highlight`, or `escape_once` is the smell.
`escape_once` deserves special suspicion — by name, it is the second escape.


### 4. Escape/normalize incompleteness

**CVE-2026-9277 (`shell-quote`, CVSS critical):** `quote()` escaped `.op` with
`/(.)/g` in JavaScript. **`/(.)/g` does not match line terminators** (`\n`,
`\r`, U+2028, U+2029). A line terminator passed through **unescaped** into the
output; POSIX shells treat a literal `\n` as a command separator, so everything
after it executed as a second command.

**This is a whole bug class, not one CVE.** Audit every escaper/serializer for
"what input does my regex not match?":

- JS `/(.)/g` misses `\n \r U+2028 U+2029`
- `[\w\s]`-style classes miss Unicode whitespace (`U+00A0`, `U+2028`, `U+3000`)
- `.trim()` in some languages misses non-breaking space
- blocklists enumerating metacharacters miss line terminators
- HTML entity decoding order vs shell parsing order

**Test:** inject `%0a`, `%0d`, `%0d%0a`, `U+2028`, `U+2029` as separators into
every parameter you have. Cheap, and it finds newline-injection CMDi reliably.

### 5. Decode-order / double-decode

WAF decodes once, framework decodes twice (or in a different order). Classic
`%252e%252e%252f` → WAF sees `%2e%2e%2f` (harmless) → framework decodes to `../`.

Enumerate: which component decodes? how many times? NFKC before or after
percent-decode? Is `+` a space at this layer?

### 6. Content-Type / parser confusion

The WAF parses as form-encoded; the framework parses as JSON (or multipart, or
XML). Switching `Content-Type` re-routes the same body through a different parser
with different metacharacter rules and different duplicate-key handling.

### 6b. URL parse differentials + the timing oracle (SSRF that leaks secrets)

A URL allowlist validates a *string*; the fetcher resolves a *different* string
after parsing. The gap between those two readings is the bug.

**CVE-2026-77987 (GHES 3.21.6, CRITICAL).** A notebook-viewer URL specifying an
**explicit port** reached internal services co-located on the appliance. The
immediate surprise is not the SSRF — it is the second half of the disclosure:

> response bodies were not returned, but **response timing could act as an
> oracle that allowed instance secrets to be extracted.** Those secrets could
> then be used to obtain RCE on the appliance.

Two lessons, both reusable:

1. **An allowlist on `host` is not an allowlist on `host:port`.** "Same host,
   different port" walks straight past hostname checks, then reaches whatever
   else is listening. Validate the resolved **origin**, or normalize and
   re-parse the URL yourself before comparing.
2. **A blind SSRF is not automatically a dead end — check for a side channel
   before giving up.** Status code, response length, redirect count, TLS
   handshake behaviour, and **latency** are all observable without the body.
   A reachable internal service that takes 2s to answer and a closed port that
   refuses instantly are trivially distinguishable, and that difference is a
   full oracle.

Timing oracles also appear in the other direction: a WAF or rate limiter that
rejects slow requests leaks whether the *target* was reached.

**Chain note:** the timing oracle recovered instance secrets, and the secrets
produced RCE. SSRF → secret → RCE is a standard three-hop chain — always map
the hops before declaring an SSRF "low impact, information only."

Two more from the same release, both worth knowing as shapes:

- **CVE-2026-18730** (GHES 3.21.5/3.21.6, HIGH): an unauthenticated Manage API
  endpoint parsed an **attacker-supplied cluster configuration** and issued
  outbound requests to an attacker-controlled host — a position able to
  intercept the request captured a **replayable management bearer token**.
  Config-driven egress is still SSRF, and tokens on the wire are the payload.
- **CVE-2026-76851** (GHES 3.21.5, HIGH): a configured **pre-receive hook** was
  used to redirect trusted internal requests to a privileged internal service →
  RCE. Hooks, webhooks, and CI callbacks inherit the trust of the process that
  makes them; treat every one as a network primitive with a privileged caller.

### 7. Non-injective indexing (no encoding differential at all)

Two distinct inputs map to the same key, so a check performed under key A is
read back under key B.

**Worked example — ETN legacy chain (`crypto::addKeys`):**
`get_balance` keys every output on the 32-byte Edwards-curve sum
`addKeys(view_pub, spend_pub)`. Because Edwards addition is commutative and
non-injective, an attacker can pick `D` and set
`view' = view + D`, `spend' = spend − D` — the sum is **identical**, so
a valid, on-curve, forensically indistinguishable address indexes to another
account's balance. PoCs: `poc_addkeys_collision.py` + `native/poc_native.c`
(built against real `crypto-ops.c`).

**The generalized hunt — look for:**
- commutative / lossy hash-to-index (`a+b` instead of `H(a‖b)`)
- truncation before comparison (key = `SHA256(x)[:16]`)
- missing domain separation between two uses of one key
- sign/canonicalization collapse (two encodings → one stored form)
- any `add`, `sum`, `xor` used as an identity where a collision function belongs
- **identifier lookup that ignores ownership or visibility scope** — a key that
  resolves to the right object but never asks whether the caller may read it

That last one is the same non-injective-key mistake with an authz twist, and it
produced two GHES findings in 2026:

- **CVE-2026-75101 (MEDIUM):** reading the raw diff of pull requests in private
  repositories the attacker could not access, by **creating a repository and pull
  request whose name and number matched the target**. The lookup key
  (`owner/repo` + `number`) is not unique across visibility boundaries, so
  creating your own colliding key shadowed the private one.
- **CVE-2026-15783 (MEDIUM):** a delegated-bypass endpoint "resolved a rule
  suite from an attacker-supplied identifier without checking that the user
  could read its repository", and the sequential identifiers were enumerable —
  so reading private repository metadata (owners, names, branch names, commit
  SHAs, commit messages, pushing actor) took a scan.

**Check for both halves separately:** is the key unique, *and* is scope enforced
at every lookup? A collision needs the first to be broken; cross-tenant access
needs the second. Enumerable sequential IDs turn a single-object IDOR into a bulk
one — see `api-08-advanced-bola`.

**Why this matters disproportionately:** these need no encoding trick, no WAF
interaction, and survive every input filter. They are pure logic bugs and they
are systematically missed by dynamic scanners.

---

## Bypass is a stack, not a wall

Modern defenses are layered. Identify which layer is actually blocking you and
attack only that one:

| Layer | Signal it is the blocker | Counter |
|---|---|---|
| CDN/WAF signature | 403 + WAF page/fingerprint | differential families 1,2,4,5,6 |
| Application input filter | 400/validation error, no WAF banner | find the un-quoted slot (see `sqli-modern-techniques`) |
| Rate limit / behavioral | 429, or block after N requests | slow down, rotate session; do not brute-force |
| TLS/JA3/JA4 fingerprint | identical 403 for *every* payload incl. benign | route through a browser-grade TLS stack (Burp as proxy, `curl-impersonate`) |
| CAPTCHA / challenge | HTML challenge | out of scope for automation; solve manually |
| Framework auth middleware | redirect before handler | framework-specific middleware bypass (see below) |

**TLS fingerprinting defeats tamper scripts.** `sqlmap` uses Python `requests`,
whose JA3 every commercial WAF recognizes. No `--tamper` flag fixes that. Fix the
transport (Burp proxy, `curl-impersonate`) *before* concluding the target is
unreachable through encoding.

**Framework middleware bypass — CVE-2025-29927 (Next.js, CVSS 9.1):** adding
`x-middleware-subrequest: <name>` skipped auth middleware entirely. Not signature
evasion — a framework design flaw. Look for the same class: internal headers,
debug flags, or path-normalization quirks that short-circuit security middleware.
Mitigation is edge-side header stripping, so it is often genuinely testable.

---

## Execution protocol

1. **Confirm authorization and scope in writing first.** Rate limits, DoS,
   third-party assets, and out-of-scope hosts are excluded on essentially every
   program. Confirm before sending a single probe.
2. **Establish a baseline** with a known-benign request per endpoint. You need a
   reference before you can read a differential.
3. **Enumerate representations, not payloads.** For one parameter, send: raw,
   single-encoded, double-encoded, NFKC, UTF-16, with line terminators, with a
   duplicate key, with a different `Content-Type`. Compare every response to
   baseline on: status, body length, header set, and timing.
4. **One variable at a time.** Change one character, one header, one delimiter.
   Two changes at once and you cannot attribute the diff.
5. **Source audit beats guessing** when you have code. Build the
   validator-accessor vs consumer-accessor table (family 3). It is deterministic.
6. **Report the differential, not the payload.** State: *"validator reads X,
   consumer reads Y, here is the input that differs."* That is a fixable defect.
   "I bypassed Cloudflare" is not.

## Kill criteria — stop and move on

- No WAF fingerprint and the app validates against an allowlist → not injectable, stop
- Every representation produces an identical response to baseline → no differential, stop
- The only reachable differential needs a primitive you do not have (e.g. a signing key) → document, do not pursue
- You cannot demonstrate a concrete impact chain → informational at best, move on
- Target is out of scope or authorization is unclear → **stop and ask**

## Reporting

State the two representations explicitly, show the baseline vs. differential
response, name the validator function and the consumer function, and give the
fix (normalize once, at a single layer, before validation — and validate the
same representation you act on). Include the framework/WAF resolution table row
that makes it reproducible, so the triager can verify without your tooling.
