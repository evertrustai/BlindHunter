---
name: sqli-modern-techniques
category: injection
domain: web
description: "Current SQLi tradecraft that is not in generic payload lists: PostgreSQL dollar-quote desync, injection through unquoted identifier slots, multi-bit blind extraction via row identity, the OWASP CRS 4.x rule-by-rule bypass map, live tamper-script table, ORM escape hatches, second-order injection, and SQLi-to-RCE escalation chains. Use when classic payloads are blocked, when a regex filter strips quotes, when extraction is too slow, or when you need to turn SQLi into RCE."
priority: high
---

# Modern SQLi — beyond the payload list

Prerequisites: `injection-surface-mapper` (find the sink first),
`representation-differential-hunting` (for WAF/HPP differentials).
Payload lists live in `web-01-sqli`, `api-10-sqli`, `sql-ninja`. This skill
covers what those do not.

**Authorized testing only.** Confirm scope before probing.

**Citation rule:** every CVE ID below was checked against cve.org / NVD / OSV /
GHSA. Before you reuse an ID in a report, re-verify it at those sources — CVE
data is assigned months after publication and scores get revised. Never cite an
ID you have not confirmed, and never take a CVSS score from a blog.

---

## 1. The filter-evasion insight that matters most

A stock OWASP CRS 4.25.0 (ModSecurity, blocking, PL1) was tested against a
dollar-quote chain and blocked **every** stage — no quotes, no semicolons, no
comments, no `UNION` in the payloads. Rules that fired: `942100` (libinjection),
`942151` (SQL function name), `942360` (concatenated injection), `942140`
(common DB names / `information_schema`).

**Conclusion: dollar-quote desync is an application-filter bypass, not a
WAF bypass.** That distinction decides your whole approach:

- **Custom regex filter / dynamic SQL, no WAF** → the filter evasion *is* the
  attack. This is still extremely common in legacy systems, internal tools,
  homegrown enterprise apps.
- **Stock/modern WAF present** → you need a *separate* evasion layer
  (see §4, §5). Do not waste time crafting clever filter bypasses.

Knowing which you have is the whole game. Fingerprint first.

---

## 2. Dollar-quote desync (PostgreSQL / PL-pgSQL)

Three PostgreSQL behaviours chained into zero-knowledge blind extraction
against a regex filter that strips `'`, `;`, `\`, `-`.

**Move 1 — dollar quoting beats the character class.** `$_$…$_$` is PostgreSQL
string syntax and contains **no** `'`, `;`, `\`, or `-`. It passes straight
through a filter that strips all four.

**Move 2 — attack the identifier slot, not the value.** The vulnerable function
wrapped the *right*-hand side of `=` in `quote_literal()`. Quoting was perfect
and bought nothing, because the **column name on the left was pasted in raw**.
Quoting the value is not enough if the identifier comes from the user.

```sql
(SELECT substr(secret,1,1) FROM secret_vault.api_keys
 WHERE service LIKE $_$stripe$_$) = w
```

renders as:

```sql
SELECT ... FROM products
 WHERE (SELECT substr(secret,1,1) FROM secret_vault.api_keys
        WHERE service LIKE $_$stripe$_$) = 'w'
```

**Move 3 — boolean oracle on row presence.** Control the `WHERE` clause and the
function answers one bit: products returned (true) or empty (false).

**Move 4 — reach forbidden characters as integers.** `ascii(substr(secret,4,1))`
so the hyphen becomes `45`. No banned character ever appears on the wire.

### Three rules that make it work

1. **Use `LIKE` inside subqueries, never `=`.** The function splits input on the
   first `=` (`split_part(…, '=', 1)`). An `=` inside your subquery breaks the parse.
2. **Use lowercase `and`.** The function splits the filter on **uppercase** ` AND `.
   Lowercase `and` slides through, so you can stack conditions.
3. **Scalar subquery must return exactly one row.** Use `LIMIT 1 OFFSET n` when
   walking multi-row sets, or PostgreSQL throws and you get nothing.

### Extraction ladder (zero knowledge)

```
1. information_schema.schemata   → public, secret_vault
2. information_schema.tables     → users, api_keys
3. information_schema.columns    → username, password_hash, totp_secret, role
4. enumerate rows                → admin, root, jdoe
5. extract values                → hashes, TOTP seeds, API keys
```

Each step is the same oracle loop: `substr()` + `LIMIT 1 OFFSET n`, one bit per
request. Budget ~15k requests — noisy by design, so expect a SIEM alert.

**Amplifier — `SECURITY DEFINER` without a locked `search_path`.** The function
runs with its **owner's** rights, so the injection reaches across schemas into
data the caller could never query. This is what turns a limited blind oracle
into a cross-tenant/cross-schema read. Check for it: it is a finding on its own
regardless of injection.

---

## 3. Injection through non-value slots (the general lesson)

The dollar-quote chain works because the developer quoted the wrong thing.
**Systematically test every slot**, not just the value:

| Slot | Vulnerable pattern | Notes |
|---|---|---|
| **Identifier** | column/table name concatenated raw | the dollar-quote entry point |
| `ORDER BY` direction | `orderBy` string → `QueryBuilder::orderBy()` | **CVE-2026-18737** (Shlink 3.3.1–5.1.5, CWE-89, no fixed version): any authenticated API-key holder injects SQL fragments via the tag-stats `orderBy` **direction** value, flowing unsanitized into a Doctrine `QueryBuilder` ORDER BY clause. Time-, boolean-, and error-based extraction of long URLs, visitor records, IPs, geolocation, user agents, and hashed API keys **from any tenant** |
| `LIMIT` / `OFFSET` | raw concatenation | cast/overflow tricks |
| `IN (…)` list | built by string join | element-wise injection |
| Sort / filter param | passed to `ORDER BY` | usually unparameterized because "it's a keyword, not data" |
| GraphQL argument | resolver builds query manually | see `hunt-graphql` |
| MyBatis | `${}` instead of `#{}` | `${}` is raw substitution — grep for it |
| JSON path / key | dynamic key lookup | prototype-pollution adjacent |

`ORDER BY` deserves special attention: developers parameterize *values* and
routinely forget that the sort column and direction are **identifiers**, which
cannot be parameterized — so they get concatenated. That is CVE-2026-18737's
entire root cause.

---

## 4. OWASP CRS 4.x — rule-by-rule bypass map

CRS is not one rule; it is hundreds, and they fire on *different* things.
Knowing which rule fires tells you which evasion to use.

| Rule | Matches | Bypass |
|---|---|---|
| `942100` | **libinjection** — tokenizes and fingerprints the argument | `{x !0}*` prefix (ODBC escape; MySQL evaluates to 1, libinjection folds the bareword away and restarts). Inner expr must start with a unary op: `{x 1}` is detected, `{x !0}` is not |
| `942190` | `UNION` … `SELECT` | `UNION ALL TABLE t` (MySQL 8.0.19+ explicit table statement) or `UNION ALL VALUES (a,b)` / `VALUES ROW(a,b)` |
| `942270` | `union.*?select.*?from` | same as above — `TABLE` and `VALUES` are query blocks *without* `SELECT`/`FROM` |
| `942360` | concatenated injection; one alternative is anchored `^[^A-Z_a-z]+` + keyword | start the value with a **letter**, not `-1`, so the anchored alternative cannot match |
| `942151` | SQL function names | rewrite `MID`→`RIGHT(LEFT(...))`, `IFNULL`→`IF`, `SLEEP`→`0x5` |
| `942170` | `select` + ws + `if`/`sleep`/`benchmark` + `(` | insert one extra `(` to break the adjacency — `(IF(...))` |

`' OR 1=1-- -` matches **no rule at all** in the SQLi family at PL1; it is
`942100` libinjection that catches it, with fingerprint `s&f(f`.

**The general lesson: envelope and payload are separate problems.**
A tamper that defeats the *envelope* (libinjection fingerprint) does nothing
about *function names*. You often need two scripts — one for each.

Note the inversion: a tamper that changes what the query computes fails
**downstream in the extracted data**, not at the filter. So any rewrite must be
provably semantics-preserving. See the exclusions in §5.

---

## 5. Live tamper-script table (2026)

What still pulls weight, and what is dead.

| Tamper | Rewrites | Defeats |
|---|---|---|
| `space2comment` | space → `/**/` | basic CRS, naive blacklists |
| `space2plus` | space → `+` | some URL-encoded contexts |
| `space2randomblank` | random tab/newline/space | lexers matching literal space only |
| `space2dash` | space → `-- \n` | same family |
| `between` | `>` → `NOT BETWEEN 0 AND #` | WAFs blocking `>` |
| `randomcase` | `SeLeCt` | case-sensitive blacklists (rare) |
| `charencode` | hex-encode | naive ASCII-only signatures |
| `charunicodeencode` / `charunicodeescape` | Unicode-escape keywords | Unicode-unaware lexers |
| `equaltolike` | `=` → `LIKE` | `=` blacklists |
| `versionedkeywords` | `/*!UNION*/` | old ModSec rules |
| `versionedmorekeywords` | versioned comments per keyword | more aggressive |
| `halfversionedmorekeywords` | versioned comment before each keyword | aggressive variant |
| `apostrophenullencode` | `'` → `%00%27` | WAFs missing null bytes |
| `odbcbrace` | prefix `{x !0}*` | libinjection 4.0.0 folding |
| `uniontable` | `UNION ALL SELECT * FROM t` → `TABLE t` | `942190`/`942270` |
| `unionvalues` / `unionvaluesrow` | → `VALUES (a,b)` / `VALUES ROW(a,b)` | same |
| `castprefix` | `-1 UNION…` → `cast(-1 as decimal) UNION…` | anchored `942360` alternative |
| `mid2leftright` | `MID(A,B,C)` → `RIGHT(LEFT(A,B+C-1),C)` | `942151` (MID/SUBSTR/SUBSTRING listed, LEFT/RIGHT not) |
| `quote2ltat` | `'` → `'<@` (MySQL only) | quote-based signatures; `''<@` is NULL, `NULL OR TRUE` is TRUE. **Refuses AND payloads** — `NULL AND …` is NULL and silently breaks |
| `sleep2hex` | `SLEEP(5)` → `SLEEP(0x5)` | **CRS 3 line only** (old branch accepts decimal-only; new accepts anything). CRS 3.3 is still widely deployed — Ubuntu 24.04 ships 3.3.5 |
| `mssqlnosemicolon` | drop `;` before T-SQL keywords | T-SQL genuinely needs no separator; `1;SELECT 1` and `1 SELECT 1` both score 5 under 4.25.0 |
| `blindbinary` | `IFNULL()`→`IF()` + extra `(`; length via `LENGTH(CONVERT(q USING ascii))` | `942170` adjacency; `CHAR_LENGTH` is listed |
| `greatest` | rewrites to `GREATEST()` | ⚠️ **now a liability** — `GREATEST` was added to the function-name list; under 4.25.0 this tamper turns a score-0 payload into score 5. A shipped bypass is not a permanent bypass |

**Dead weight — do not waste requests:** `multiplespaces` (no current WAF cares),
`appendnullbyte` (modern stacks handle nulls), `halfversionedmorekeywords`
outside MySQL (other DBMS don't parse versioned comments), `randomcase` on
case-insensitive engines.

### The length-guard trap (why `blindbinary` needed `CONVERT`)

sqlmap uses a length guard to know when it has run off the end of a value. Two
candidates fail:

- `LENGTH()` counts **bytes** → on multi-byte values the guard is too large and
  the read walks past the end
- `LEFT(q,p) != LEFT(q,p-1)` breaks under **PAD SPACE** collation, where a
  trailing space compares equal to the empty string → a value ending in space
  terminates early. This is not a corner case: **MySQL's default was
  `utf8mb4_general_ci` (PAD SPACE) until 8.0** switched to
  `utf8mb4_0900_ai_ci` (NO PAD).

`LENGTH(CONVERT(q USING ascii))` fixes both — one byte per char, and neither
`LENGTH` nor `CONVERT` is on the list. The set-membership form
(`ORD(MID(…)) IN (…)`) must additionally map ordinal 0 → `''`, since
`ORD('')=0` and 0 is what a past-the-end position returns.

---

## 6. Multi-bit blind extraction (row identity as a bit vector)

Standard boolean blind is **1 bit per request**. If the page renders multiple
rows, row *identity* can carry more: **K rendered rows = K bits**, not log₂K.

### AND vs OR channel

- **AND** — condition added to the app's own filter → can only *remove* rows
  from a list already shown. Whole table not addressable.
- **OR** — condition added as an *alternative* → rows match regardless of what
  the user searched. Whole table addressable → several characters per request.

**OR widens the result set, so sqlmap marks every OR-based boolean test as
risk 3** — if the injectable parameter lands in an `UPDATE`/`DELETE` rather than
a `SELECT`, an OR condition affects rows the statement was never meant to touch.
Opt in deliberately.

### How it works

Request *k* selects every row whose identifier has bit *k* set. Seven requests
place a window of 127 rows. Offset 0 is **excluded on purpose** — a row at
offset 0 sets no bit in any plane and cannot be distinguished from a marker
that went missing.

### Calibration (this is what makes it trustworthy)

sqlmap sends seven probes and requires the response to contain **exactly** the
rows it predicted and no others:

- one probe selecting every bit row at full width
- one contradiction that must select none
- five random combinations of bit planes

A **canary row** (`OR id=14`) is selected on every read including the one that
must otherwise come back empty. If the canary is missing, the response was not a
result page — gateway error, rate-limit notice, interstitial — and the read is
**discarded, not decoded into a plausible string**.

Then the value is proved before being returned: length first, then content in
64-char chunks, using ordinary single-condition questions over the same channel.

**Assumption that breaks silently:** the page must show more rows when more are
selected. Pages that cap results, truncate, cache, or de-duplicate violate this
**without any error** — sqlmap will still decode a value, just a *wrong* one.
The canary and contradiction rounds exist to catch exactly this.

### Measured

SekuMart (MariaDB 11.8.6, boolean blind in `q`): 9 rows → 8 bit rows + canary.
Synthetic SQLite harness: 96-row listing → 88 bit rows → **11 characters per
request**, 155 chars across 5 values in 46 requests. Width is set by the target:
2 chars/request needs 17 consecutive usable rows.

Calibration is paid **once per injection point**, so short values never earn it
back. Reading a 4-character database name took 30 requests without the switch,
40 with it.

---

## 7. ORM escape hatches

ORMs parameterize by default — and every one provides a raw escape hatch.
**Grep for these in source, not for injection:**

`.raw()` · `.query()` · `.text()` · `whereRaw` · `havingRaw` · `orderByRaw` ·
`selectRaw` · `extra()` · `$queryRawUnsafe` · `sequelize.query` with
`replacements` misused · Eloquent `whereRaw` · Django `.extra()` ·
SQLAlchemy `text()` with f-strings · MyBatis `${}`

**MyBatis is the standout:** `#{}` is parameterized, `${}` is raw string
substitution. A single `${}` in a mapper XML is a SQLi. Grep for `${` in
`.xml` mapper files — it is a one-line audit with very high yield.

---

## 8. Second-order injection

Payload enters through a *safe* path, detonates later in a different context.

```
1. register username:  admin'--
2. stored safely (INSERT escapes it)
3. later a DIFFERENT query reuses it unsanitized — password reset, admin lookup
4. fires
```

Scanners miss it because the injection point is not the injection sink.
**Source review finds it fast:** grep for where a stored column is read and
concatenated, not where it is written.

---

## 9. SQLi → RCE escalation chains

SQLi is usually read access. These turn it into RCE — check for them *after*
confirming the SQLi.

| Chain | Mechanism |
|---|---|
| **SQLi → serialize → webshell** | **CVE-2026-63233** (Koollab LMS, authed): SQLi in the assessment overall-answer endpoint controls data passed to `unserialize()`. PHP object injection → gadget chain → **file write of a webshell** to a web-accessible path → RCE. This is the canonical SQLi→RCE pattern |
| `INTO OUTFILE` / `COPY TO` | write a file where the webserver executes it. Needs `FILE` priv + a known webroot + non-`secure_file_priv` |
| `LOAD_FILE` + log poisoning | read source/config for credentials; poison logs then include them (needs LFI — chain it) |
| UDF / `sys_exec` | MySQL UDF, Postgres `COPY … PROGRAM` |
| Credential extraction | DB creds → app login → admin RCE. Often the shortest path |
| SSRF via DB | `LOAD_FILE`/`http` extensions to internal services |

**Detection-side artifacts worth alerting on (and worth noting in reports):**
`.php`/`.phtml` appearing under web-accessible dirs; access logs with `O:`/`a:`/`s:`
serialization markers; web server spawning `/bin/sh`, `bash`, `cmd.exe`.

---

## 10. Escalation ladder (order of operations)

1. **Confirm** with 3 hand-built payloads in Burp Repeater: boolean, error, time.
   Never trust a scanner's claim alone.
2. **Fingerprint DB engine** — `version()`, `@@version`, `banner`, timing.
   Wrong engine = wrong functions = wasted requests.
3. **Try the cheap channel first** — if UNION works, stop; it is 10× faster than blind.
4. **If WAF-blocked**, fingerprint the WAF, then pick the layer:
   signature → §4/§5 · application filter → §2 · transport → fix TLS fingerprint
5. **If blind**, estimate extraction volume. If >10k requests, use **OOB**
   (`LOAD_FILE`/DNS exfil) or the **multi-bit** channel (§6) to cut request count.
6. **Before escalating to RCE**, confirm you have authorization for that action
   specifically. Some programs exclude "obtaining RCE" while accepting SQLi proof.

## Kill criteria

- Parameterized everywhere you tested and no differential exists → move on
- `stack trace disabled + no timing delta + no OOB egress` → not exploitable
- WAF blocks the envelope **and** the transport fingerprint **and** you have no
  app-layer filter gap → stop, document, switch surface
- You are only guessing DB structure with no oracle → do not brute-force
