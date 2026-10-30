#!/bin/bash
# =============================================================
# verify_takeover.sh - Final Triple Verification Pipeline
# Part of: subdomain-takeover skill
# Usage: ./verify_takeover.sh <subdomain> [service_type]
# Output: JSON verification results with PASS/FAIL for each check
# =============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

verify_subdomain() {
    local subdomain="$1"
    local service_type="${2:-auto}"
    
    local check1_pass=false
    local check2_pass=false
    local check3_pass=false
    local check1_evidence=""
    local check2_evidence=""
    local check3_evidence=""
    
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════╗${NC}" >&2
    echo -e "${BOLD}${CYAN}║  TRIPLE VERIFICATION: $subdomain${NC}" >&2
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════╝${NC}" >&2
    
    # ═══════════════════════════════════════
    # CHECK 1: DNS Verification
    # ═══════════════════════════════════════
    echo -e "\n${BOLD}${BLUE}═══ CHECK 1: DNS Verification ═══${NC}" >&2
    
    # Check with Google DNS
    local cname_google
    cname_google=$(dig CNAME "$subdomain" +short @8.8.8.8 2>/dev/null | head -1 | sed 's/\.$//')
    echo -e "  Google DNS (8.8.8.8): ${cname_google:-NONE}" >&2
    
    # Check with Cloudflare DNS
    local cname_cf
    cname_cf=$(dig CNAME "$subdomain" +short @1.1.1.1 2>/dev/null | head -1 | sed 's/\.$//')
    echo -e "  Cloudflare DNS (1.1.1.1): ${cname_cf:-NONE}" >&2
    
    # Check with host command
    local host_result
    host_result=$(host -t CNAME "$subdomain" 2>/dev/null | grep "alias" | awk '{print $NF}' | sed 's/\.$//' || echo "")
    echo -e "  host command: ${host_result:-NONE}" >&2
    
    # Verify consistency
    if [ -n "$cname_google" ] && [ -n "$cname_cf" ]; then
        if [ "$cname_google" = "$cname_cf" ]; then
            check1_pass=true
            check1_evidence="CNAME consistent across resolvers: $cname_google"
            echo -e "  ${GREEN}✓ DNS CHECK PASSED: Consistent CNAME records${NC}" >&2
        else
            check1_evidence="CNAME mismatch: Google=$cname_google, CF=$cname_cf"
            echo -e "  ${YELLOW}⚠ DNS CHECK WARNING: CNAME mismatch between resolvers${NC}" >&2
        fi
    elif [ -n "$cname_google" ] || [ -n "$cname_cf" ]; then
        local available_cname="${cname_google:-$cname_cf}"
        check1_pass=true
        check1_evidence="CNAME found: $available_cname (partial resolver response)"
        echo -e "  ${YELLOW}⚠ DNS CHECK PARTIAL: Only one resolver responded${NC}" >&2
    else
        check1_evidence="No CNAME record found"
        echo -e "  ${RED}✗ DNS CHECK FAILED: No CNAME record${NC}" >&2
    fi
    
    local cname="${cname_google:-$cname_cf}"
    
    # ═══════════════════════════════════════
    # CHECK 2: Subzy / Secondary Tool Verification
    # ═══════════════════════════════════════
    echo -e "\n${BOLD}${BLUE}═══ CHECK 2: Tool Verification ═══${NC}" >&2
    
    if command -v subzy &>/dev/null; then
        echo -e "  Using subzy for verification..." >&2
        local temp_file
        temp_file=$(mktemp /tmp/st_verify_XXXX.txt)
        echo "$subdomain" > "$temp_file"
        
        local subzy_output
        subzy_output=$(subzy run --targets "$temp_file" --timeout 20 2>/dev/null || echo "SUBZY_ERROR")
        rm -f "$temp_file"
        
        if echo "$subzy_output" | grep -qi "VULNERABLE\|vulnerable"; then
            check2_pass=true
            check2_evidence="Subzy confirmed: VULNERABLE"
            echo -e "  ${GREEN}✓ SUBZY CHECK PASSED: Vulnerability confirmed${NC}" >&2
        elif echo "$subzy_output" | grep -qi "NOT VULNERABLE\|not_vulnerable"; then
            check2_evidence="Subzy says: NOT VULNERABLE"
            echo -e "  ${RED}✗ SUBZY CHECK: Not vulnerable per subzy${NC}" >&2
        else
            check2_evidence="Subzy inconclusive: $subzy_output"
            echo -e "  ${YELLOW}⚠ SUBZY CHECK: Inconclusive${NC}" >&2
        fi
    else
        echo -e "  ${YELLOW}subzy not installed. Falling back to manual re-check...${NC}" >&2
        
        # Fallback: Re-fetch with different User-Agent
        local alt_response
        alt_response=$(curl -sL \
            -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
            --connect-timeout 15 --max-time 25 \
            "https://$subdomain" 2>/dev/null || echo "FETCH_FAILED")
        
        # Check for known vulnerable fingerprints
        local vuln_patterns="NoSuchBucket|There isn't a GitHub Pages site here|No such app|no-such-app|Sorry, this shop is currently unavailable|There's nothing here|404 error unknown site|project not found|Repository not found|Fastly error: unknown domain|BlobNotFound|404 Web Site not found"
        
        if echo "$alt_response" | grep -qiE "$vuln_patterns" 2>/dev/null; then
            check2_pass=true
            local matched_pattern
            matched_pattern=$(echo "$alt_response" | grep -oiE "$vuln_patterns" 2>/dev/null | head -1)
            check2_evidence="Manual re-check confirmed: '$matched_pattern' found with alt User-Agent"
            echo -e "  ${GREEN}✓ MANUAL RE-CHECK PASSED: Fingerprint confirmed${NC}" >&2
        else
            check2_evidence="Manual re-check: No vulnerable fingerprint found"
            echo -e "  ${RED}✗ MANUAL RE-CHECK: No match${NC}" >&2
        fi
    fi
    
    # ═══════════════════════════════════════
    # CHECK 3: Manual HTTP Deep Verification
    # ═══════════════════════════════════════
    echo -e "\n${BOLD}${BLUE}═══ CHECK 3: Deep HTTP Verification ═══${NC}" >&2
    
    # Full verbose curl
    local full_response
    full_response=$(curl -sL -D - --connect-timeout 15 --max-time 30 "https://$subdomain" 2>/dev/null || echo "FETCH_FAILED")
    
    local http_status
    http_status=$(echo "$full_response" | grep -oP "HTTP/\S+ \K\d+" | tail -1)
    echo -e "  HTTP Status: ${http_status:-unknown}" >&2
    
    # Check response body
    local body
    body=$(echo "$full_response" | sed '1,/^\r*$/d')
    
    # Check for genuine error pages vs custom 404s
    local is_genuine_error=false
    
    # S3 specific
    if echo "$body" | grep -qi "NoSuchBucket\|<Code>NoSuchBucket</Code>"; then
        is_genuine_error=true
        echo -e "  ${GREEN}✓ Confirmed S3 NoSuchBucket error${NC}" >&2
    fi
    
    # GitHub Pages specific
    if echo "$body" | grep -qi "There isn't a GitHub Pages site here"; then
        is_genuine_error=true
        echo -e "  ${GREEN}✓ Confirmed GitHub Pages error${NC}" >&2
    fi
    
    # Heroku specific
    if echo "$body" | grep -qi "no-such-app\|No such app"; then
        is_genuine_error=true
        echo -e "  ${GREEN}✓ Confirmed Heroku 'No such app' error${NC}" >&2
    fi
    
    # Azure specific
    if echo "$body" | grep -qi "404 Web Site not found.*azurewebsites"; then
        is_genuine_error=true
        echo -e "  ${GREEN}✓ Confirmed Azure App Service error${NC}" >&2
    fi
    
    # Fastly specific
    if echo "$body" | grep -qi "Fastly error: unknown domain"; then
        is_genuine_error=true
        echo -e "  ${GREEN}✓ Confirmed Fastly unknown domain error${NC}" >&2
    fi
    
    # Generic checks for other services
    local generic_patterns="Sorry, this shop is currently unavailable|There's nothing here|404 error unknown site|project not found|Repository not found|The thing you were looking for is no longer here|We could not find what you're looking for|No settings were found for this company|The feed has not been found"
    if echo "$body" | grep -qiE "$generic_patterns" 2>/dev/null; then
        is_genuine_error=true
        local found_pattern
        found_pattern=$(echo "$body" | grep -oiE "$generic_patterns" 2>/dev/null | head -1)
        echo -e "  ${GREEN}✓ Confirmed service error: '$found_pattern'${NC}" >&2
    fi
    
    # WAF / CDN check (false positive detection)
    local has_waf=false
    if echo "$full_response" | grep -qi "cloudflare\|cf-ray\|akamai\|incapsula"; then
        has_waf=true
        echo -e "  ${YELLOW}⚠ WAF/CDN detected — error may be from WAF, not target service${NC}" >&2
    fi
    
    if [ "$is_genuine_error" = true ] && [ "$has_waf" = false ]; then
        check3_pass=true
        check3_evidence="HTTP deep check confirmed genuine service error page"
        echo -e "  ${GREEN}✓ HTTP DEEP CHECK PASSED${NC}" >&2
    elif [ "$is_genuine_error" = true ] && [ "$has_waf" = true ]; then
        check3_evidence="Service error detected but WAF present — may be false positive"
        echo -e "  ${YELLOW}⚠ HTTP DEEP CHECK: Error found but WAF interference possible${NC}" >&2
    else
        check3_evidence="No genuine service error detected"
        echo -e "  ${RED}✗ HTTP DEEP CHECK: No service error found${NC}" >&2
    fi
    
    # ═══════════════════════════════════════
    # FINAL VERDICT
    # ═══════════════════════════════════════
    echo -e "\n${BOLD}${CYAN}═══ FINAL VERDICT ═══${NC}" >&2
    
    local checks_passed=0
    $check1_pass && checks_passed=$((checks_passed + 1))
    $check2_pass && checks_passed=$((checks_passed + 1))
    $check3_pass && checks_passed=$((checks_passed + 1))
    
    local verdict=""
    local severity=""
    
    if [ $checks_passed -eq 3 ]; then
        verdict="CONFIRMED_VULNERABLE"
        severity="HIGH"
        echo -e "  ${RED}${BOLD}🔴 CONFIRMED VULNERABLE (3/3 checks passed)${NC}" >&2
    elif [ $checks_passed -eq 2 ]; then
        verdict="LIKELY_VULNERABLE"
        severity="MEDIUM"
        echo -e "  ${YELLOW}${BOLD}🟡 LIKELY VULNERABLE (2/3 checks passed)${NC}" >&2
    elif [ $checks_passed -eq 1 ]; then
        verdict="UNLIKELY"
        severity="LOW"
        echo -e "  ${BLUE}🔵 UNLIKELY (1/3 checks passed)${NC}" >&2
    else
        verdict="NOT_VULNERABLE"
        severity="INFO"
        echo -e "  ${GREEN}🟢 NOT VULNERABLE (0/3 checks passed)${NC}" >&2
    fi
    
    # Output final JSON
    cat <<EOF
{
  "subdomain": "$subdomain",
  "cname": "${cname:-null}",
  "service_type": "$service_type",
  "verdict": "$verdict",
  "severity": "$severity",
  "checks_passed": "$checks_passed/3",
  "verification": {
    "check1_dns": {
      "passed": $check1_pass,
      "evidence": "$check1_evidence"
    },
    "check2_tool": {
      "passed": $check2_pass,
      "evidence": "$check2_evidence"
    },
    "check3_http": {
      "passed": $check3_pass,
      "evidence": "$check3_evidence"
    }
  },
  "remediation": "Remove the dangling CNAME record for $subdomain pointing to ${cname:-unknown}"
}
EOF
}

# Main
if [ $# -lt 1 ]; then
    echo "Usage: $0 <subdomain> [service_type]" >&2
    echo "Example: $0 assets.example.com AWS_S3" >&2
    echo "Example: $0 blog.example.com GITHUB_PAGES" >&2
    exit 1
fi

verify_subdomain "$1" "${2:-auto}"
