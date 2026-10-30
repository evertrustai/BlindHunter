#!/bin/bash
# =============================================================
# cname_checker.sh - Batch CNAME Enumeration & Cloud Provider ID
# Part of: subdomain-takeover skill
# Usage: ./cname_checker.sh <subdomains_file_or_domain>
# Output: JSON results to stdout
# =============================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check dependencies
check_deps() {
    for cmd in dig curl jq; do
        if ! command -v "$cmd" &>/dev/null; then
            echo "[ERROR] Missing dependency: $cmd" >&2
            exit 1
        fi
    done
}

# Known cloud provider CNAME patterns
classify_cname() {
    local cname="$1"
    cname_lower=$(echo "$cname" | tr '[:upper:]' '[:lower:]')
    
    case "$cname_lower" in
        *.s3.amazonaws.com|*.s3-website-*.amazonaws.com|*.s3.*.amazonaws.com)
            echo "AWS_S3";;
        *.cloudfront.net)
            echo "AWS_CLOUDFRONT";;
        *.elasticbeanstalk.com)
            echo "AWS_ELASTIC_BEANSTALK";;
        *.elb.amazonaws.com|*.elb.*.amazonaws.com)
            echo "AWS_ELB";;
        *.awsglobalaccelerator.com)
            echo "AWS_GLOBAL_ACCELERATOR";;
        *.azurewebsites.net)
            echo "AZURE_APP_SERVICE";;
        *.cloudapp.azure.com)
            echo "AZURE_CLOUD_APP";;
        *.azure-api.net)
            echo "AZURE_API_MGMT";;
        *.azurefd.net)
            echo "AZURE_FRONT_DOOR";;
        *.blob.core.windows.net)
            echo "AZURE_BLOB";;
        *.trafficmanager.net)
            echo "AZURE_TRAFFIC_MGR";;
        *.azureedge.net)
            echo "AZURE_CDN";;
        *.github.io)
            echo "GITHUB_PAGES";;
        *.githubusercontent.com)
            echo "GITHUB_CONTENT";;
        *.herokuapp.com|*.herokussl.com|*.herokudns.com)
            echo "HEROKU";;
        *.shopify.com|*.myshopify.com)
            echo "SHOPIFY";;
        *.pantheonsite.io|*.pantheon.io)
            echo "PANTHEON";;
        *.netlify.app|*.netlify.com|*.bitballoon.com)
            echo "NETLIFY";;
        *.vercel.app|*.now.sh)
            echo "VERCEL";;
        *.surge.sh)
            echo "SURGE";;
        *.ghost.io)
            echo "GHOST";;
        *.wordpress.com)
            echo "WORDPRESS";;
        *.tumblr.com)
            echo "TUMBLR";;
        *.fastly.net|*.fastlylb.net|*.global.prod.fastly.net)
            echo "FASTLY";;
        *.zendesk.com)
            echo "ZENDESK";;
        *.freshdesk.com)
            echo "FRESHDESK";;
        *.statuspage.io)
            echo "STATUSPAGE";;
        *.helpjuice.com)
            echo "HELPJUICE";;
        *.helpscoutdocs.com)
            echo "HELPSCOUT";;
        *.feedpress.me)
            echo "FEEDPRESS";;
        *.bitbucket.io)
            echo "BITBUCKET";;
        *.fly.dev)
            echo "FLY_IO";;
        *.onrender.com)
            echo "RENDER";;
        *.pages.dev)
            echo "CLOUDFLARE_PAGES";;
        *.firebaseapp.com|*.web.app)
            echo "FIREBASE";;
        *.cargo.site|*.cargocollective.com)
            echo "CARGO";;
        *.webflow.io)
            echo "WEBFLOW";;
        *.strikinglydns.com)
            echo "STRIKINGLY";;
        *.readme.io)
            echo "README";;
        *.launchrock.com)
            echo "LAUNCHROCK";;
        *.agilecrm.com)
            echo "AGILECRM";;
        *.storage.googleapis.com)
            echo "GCP_STORAGE";;
        *.appspot.com)
            echo "GCP_APP_ENGINE";;
        *)
            echo "UNKNOWN";;
    esac
}

# Check a single subdomain
check_subdomain() {
    local subdomain="$1"
    local cname=""
    local provider=""
    local http_status=""
    local priority=""
    
    # Get CNAME record
    cname=$(dig CNAME "$subdomain" +short 2>/dev/null | head -1 | sed 's/\.$//')
    
    if [ -z "$cname" ]; then
        # No CNAME found
        echo "{\"subdomain\":\"$subdomain\",\"has_cname\":false,\"priority\":\"INFO\"}"
        return
    fi
    
    # Classify provider
    provider=$(classify_cname "$cname")
    
    # Quick HTTP check
    http_status=$(curl -sIL -o /dev/null -w "%{http_code}" \
        --connect-timeout 10 --max-time 15 \
        "https://$subdomain" 2>/dev/null || echo "000")
    
    # Determine priority
    case "$provider" in
        AWS_S3|AWS_CLOUDFRONT)
            if [ "$http_status" = "404" ] || [ "$http_status" = "403" ]; then
                priority="CRITICAL"
            else
                priority="MEDIUM"
            fi
            ;;
        GITHUB_PAGES|HEROKU|AZURE_APP_SERVICE)
            if [ "$http_status" = "404" ] || [ "$http_status" = "000" ]; then
                priority="HIGH"
            else
                priority="MEDIUM"
            fi
            ;;
        AWS_ELASTIC_BEANSTALK|AZURE_TRAFFIC_MGR)
            priority="HIGH"
            ;;
        NETLIFY|VERCEL|FIREBASE|CLOUDFLARE_PAGES)
            priority="LOW"  # These have domain verification
            ;;
        UNKNOWN)
            priority="INFO"
            ;;
        *)
            if [ "$http_status" = "404" ] || [ "$http_status" = "000" ]; then
                priority="MEDIUM"
            else
                priority="LOW"
            fi
            ;;
    esac
    
    # Get A record for additional context
    local a_record
    a_record=$(dig A "$subdomain" +short 2>/dev/null | head -1)
    
    echo "{\"subdomain\":\"$subdomain\",\"has_cname\":true,\"cname\":\"$cname\",\"provider\":\"$provider\",\"http_status\":\"$http_status\",\"a_record\":\"$a_record\",\"priority\":\"$priority\"}"
}

# Main
main() {
    check_deps
    
    local input="$1"
    local results=()
    local total=0
    local with_cname=0
    local cloud_resources=0
    
    echo -e "${CYAN}[*] subdomain-takeover: CNAME Checker${NC}" >&2
    echo -e "${CYAN}[*] Starting CNAME enumeration...${NC}" >&2
    
    # Determine if input is a file or single domain
    if [ -f "$input" ]; then
        while IFS= read -r subdomain || [ -n "$subdomain" ]; do
            subdomain=$(echo "$subdomain" | tr -d '[:space:]' | sed 's|https\?://||' | sed 's|/.*||')
            [ -z "$subdomain" ] && continue
            [ "${subdomain:0:1}" = "#" ] && continue
            
            total=$((total + 1))
            echo -e "${BLUE}[+] Checking: $subdomain${NC}" >&2
            
            result=$(check_subdomain "$subdomain")
            results+=("$result")
            
            # Count statistics
            if echo "$result" | jq -e '.has_cname == true' &>/dev/null; then
                with_cname=$((with_cname + 1))
                local prov
                prov=$(echo "$result" | jq -r '.provider')
                if [ "$prov" != "UNKNOWN" ]; then
                    cloud_resources=$((cloud_resources + 1))
                fi
            fi
        done < "$input"
    else
        # Single domain
        total=1
        echo -e "${BLUE}[+] Checking: $input${NC}" >&2
        result=$(check_subdomain "$input")
        results+=("$result")
        if echo "$result" | jq -e '.has_cname == true' &>/dev/null; then
            with_cname=1
            local prov
            prov=$(echo "$result" | jq -r '.provider')
            if [ "$prov" != "UNKNOWN" ]; then
                cloud_resources=1
            fi
        fi
    fi
    
    # Output JSON results
    echo "{"
    echo "  \"scan_type\": \"cname_enumeration\","
    echo "  \"total_checked\": $total,"
    echo "  \"cname_records_found\": $with_cname,"
    echo "  \"cloud_resources_identified\": $cloud_resources,"
    echo "  \"results\": ["
    
    local first=true
    for r in "${results[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            echo ","
        fi
        echo "    $r"
    done
    
    echo ""
    echo "  ]"
    echo "}"
    
    echo -e "\n${GREEN}[✓] Scan complete. Checked $total subdomains. Found $with_cname CNAMEs, $cloud_resources cloud resources.${NC}" >&2
}

if [ $# -lt 1 ]; then
    echo "Usage: $0 <subdomains_file_or_single_domain>" >&2
    echo "Example: $0 subdomains.txt" >&2
    echo "Example: $0 assets.example.com" >&2
    exit 1
fi

main "$1"
