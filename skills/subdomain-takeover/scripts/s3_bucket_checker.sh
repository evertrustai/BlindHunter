#!/bin/bash
# =============================================================
# s3_bucket_checker.sh - AWS S3 Bucket Takeover Verification
# Part of: subdomain-takeover skill
# Usage: ./s3_bucket_checker.sh <subdomain_or_bucket_name>
# Output: JSON verification results
# =============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

check_deps() {
    for cmd in dig curl; do
        if ! command -v "$cmd" &>/dev/null; then
            echo "[ERROR] Missing dependency: $cmd" >&2
            exit 1
        fi
    done
}

# Extract bucket name from various S3 URL formats
extract_bucket_name() {
    local input="$1"
    
    # Pattern: <bucket>.s3.amazonaws.com
    if echo "$input" | grep -qP '\.s3\.amazonaws\.com'; then
        echo "$input" | sed 's/\.s3\.amazonaws\.com.*//'
        return
    fi
    
    # Pattern: <bucket>.s3-website-<region>.amazonaws.com
    if echo "$input" | grep -qP '\.s3-website-.*\.amazonaws\.com'; then
        echo "$input" | sed 's/\.s3-website-.*//'
        return
    fi
    
    # Pattern: <bucket>.s3.<region>.amazonaws.com
    if echo "$input" | grep -qP '\.s3\..*\.amazonaws\.com'; then
        echo "$input" | sed 's/\.s3\..*//'
        return
    fi
    
    # If no pattern matches, treat input as bucket name
    echo "$input"
}

# Extract region from S3 CNAME
extract_region() {
    local cname="$1"
    
    # Pattern: *.s3-website-<region>.amazonaws.com
    if echo "$cname" | grep -qP 's3-website-'; then
        echo "$cname" | grep -oP 's3-website-\K[^.]+' 
        return
    fi
    
    # Pattern: *.s3.<region>.amazonaws.com
    if echo "$cname" | grep -qP '\.s3\.[a-z]+-[a-z]+-[0-9]+\.amazonaws\.com'; then
        echo "$cname" | grep -oP '\.s3\.\K[^.]+(?=\.amazonaws\.com)'
        return
    fi
    
    # Try to get region from HTTP headers
    local region_header
    region_header=$(curl -sI "https://${cname}" 2>/dev/null | grep -i 'x-amz-bucket-region' | awk '{print $2}' | tr -d '\r\n')
    if [ -n "$region_header" ]; then
        echo "$region_header"
        return
    fi
    
    echo "unknown"
}

# Check S3 bucket status
check_s3_bucket() {
    local subdomain="$1"
    local cname=""
    local bucket_name=""
    local region=""
    local status="UNKNOWN"
    local evidence=""
    local is_vulnerable=false
    
    echo -e "${CYAN}[*] S3 Bucket Checker${NC}" >&2
    echo -e "${BLUE}[+] Checking: $subdomain${NC}" >&2
    
    # Step 1: Get CNAME
    echo -e "${BLUE}[+] Step 1: DNS CNAME lookup${NC}" >&2
    cname=$(dig CNAME "$subdomain" +short 2>/dev/null | head -1 | sed 's/\.$//')
    
    if [ -z "$cname" ]; then
        # Try A record — might be direct to S3
        local a_record
        a_record=$(dig A "$subdomain" +short 2>/dev/null | head -1)
        echo "{\"subdomain\":\"$subdomain\",\"status\":\"NO_CNAME\",\"a_record\":\"$a_record\",\"is_vulnerable\":false,\"notes\":\"No CNAME record found. Cannot determine S3 bucket.\"}"
        return
    fi
    
    echo -e "    CNAME: $cname" >&2
    
    # Check if CNAME points to S3
    if ! echo "$cname" | grep -qi 's3\|amazonaws'; then
        echo "{\"subdomain\":\"$subdomain\",\"cname\":\"$cname\",\"status\":\"NOT_S3\",\"is_vulnerable\":false,\"notes\":\"CNAME does not point to S3.\"}"
        return
    fi
    
    # Step 2: Extract bucket name and region
    echo -e "${BLUE}[+] Step 2: Extracting bucket name and region${NC}" >&2
    bucket_name=$(extract_bucket_name "$cname")
    region=$(extract_region "$cname")
    echo -e "    Bucket: $bucket_name" >&2
    echo -e "    Region: $region" >&2
    
    # Step 3: Check HTTP response from subdomain
    echo -e "${BLUE}[+] Step 3: HTTP response check (subdomain)${NC}" >&2
    local http_response
    http_response=$(curl -sL --connect-timeout 10 --max-time 20 "https://$subdomain" 2>/dev/null || curl -sL --connect-timeout 10 --max-time 20 "http://$subdomain" 2>/dev/null || echo "CONNECTION_FAILED")
    
    # Step 4: Check for NoSuchBucket
    echo -e "${BLUE}[+] Step 4: NoSuchBucket check${NC}" >&2
    if echo "$http_response" | grep -qi "NoSuchBucket"; then
        status="VULNERABLE"
        is_vulnerable=true
        evidence="NoSuchBucket"
        echo -e "${RED}[!] VULNERABLE: NoSuchBucket detected!${NC}" >&2
    elif echo "$http_response" | grep -qi "The specified bucket does not exist"; then
        status="VULNERABLE"
        is_vulnerable=true
        evidence="The specified bucket does not exist"
        echo -e "${RED}[!] VULNERABLE: Bucket does not exist!${NC}" >&2
    elif echo "$http_response" | grep -qi "AccessDenied"; then
        status="NOT_VULNERABLE"
        is_vulnerable=false
        evidence="AccessDenied - bucket exists"
        echo -e "${GREEN}[✓] NOT VULNERABLE: Bucket exists (AccessDenied)${NC}" >&2
    elif echo "$http_response" | grep -qi "AllAccessDisabled"; then
        status="NOT_VULNERABLE"
        is_vulnerable=false
        evidence="AllAccessDisabled - bucket exists"
        echo -e "${GREEN}[✓] NOT VULNERABLE: Bucket exists (AllAccessDisabled)${NC}" >&2
    elif echo "$http_response" | grep -qi "NoSuchKey"; then
        status="NOT_VULNERABLE"
        is_vulnerable=false
        evidence="NoSuchKey - bucket exists, key missing"
        echo -e "${GREEN}[✓] NOT VULNERABLE: Bucket exists (NoSuchKey)${NC}" >&2
    elif echo "$http_response" | grep -qi "PermanentRedirect"; then
        status="NEEDS_REGION_CHECK"
        is_vulnerable=false
        evidence="PermanentRedirect - wrong region, bucket may exist"
        echo -e "${YELLOW}[?] NEEDS VERIFICATION: PermanentRedirect (try different region)${NC}" >&2
    elif [ "$http_response" = "CONNECTION_FAILED" ]; then
        status="CONNECTION_FAILED"
        is_vulnerable=false
        evidence="Could not connect to subdomain"
        echo -e "${YELLOW}[?] CONNECTION FAILED${NC}" >&2
    else
        # Check direct S3 endpoint
        echo -e "${BLUE}[+] Step 5: Direct S3 endpoint check${NC}" >&2
        local direct_response
        direct_response=$(curl -sL --connect-timeout 10 --max-time 20 "https://${bucket_name}.s3.amazonaws.com" 2>/dev/null || echo "")
        
        if echo "$direct_response" | grep -qi "NoSuchBucket"; then
            status="VULNERABLE"
            is_vulnerable=true
            evidence="NoSuchBucket (direct S3 check)"
            echo -e "${RED}[!] VULNERABLE: NoSuchBucket on direct S3 check!${NC}" >&2
        else
            status="ACTIVE"
            is_vulnerable=false
            evidence="Bucket appears to be active"
            echo -e "${GREEN}[✓] Bucket appears active${NC}" >&2
        fi
    fi
    
    # Step 6: Get HTTP status code
    local http_status
    http_status=$(curl -sIL -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "https://$subdomain" 2>/dev/null || echo "000")
    
    # Output JSON
    local response_snippet
    response_snippet=$(echo "$http_response" | head -5 | tr '"' "'" | tr '\n' ' ' | cut -c1-200)
    
    cat <<EOF
{
  "subdomain": "$subdomain",
  "cname": "$cname",
  "bucket_name": "$bucket_name",
  "region": "$region",
  "status": "$status",
  "is_vulnerable": $is_vulnerable,
  "http_status": "$http_status",
  "evidence": "$evidence",
  "response_snippet": "$response_snippet",
  "verification_commands": {
    "dns": "dig CNAME $subdomain +short",
    "http": "curl -sL https://$subdomain 2>/dev/null | grep -i NoSuchBucket",
    "direct": "curl -sL https://${bucket_name}.s3.amazonaws.com 2>/dev/null"
  }
}
EOF
}

# Main
if [ $# -lt 1 ]; then
    echo "Usage: $0 <subdomain>" >&2
    echo "Example: $0 assets.example.com" >&2
    exit 1
fi

check_deps
check_s3_bucket "$1"
