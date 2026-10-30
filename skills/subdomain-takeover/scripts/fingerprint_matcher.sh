#!/bin/bash
# =============================================================
# fingerprint_matcher.sh - HTTP Response Fingerprint Matching
# Part of: subdomain-takeover skill
# Usage: ./fingerprint_matcher.sh <subdomain>
# Output: JSON with matched fingerprints
# =============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# All known fingerprints with their service and vulnerability status
# Format: "FINGERPRINT_STRING|SERVICE|VULNERABLE"
FINGERPRINTS=(
    "NoSuchBucket|AWS_S3|YES"
    "The specified bucket does not exist|AWS_S3|YES"
    "Bad Request|AWS_CLOUDFRONT|EDGE_CASE"
    "ERROR The request could not be satisfied|AWS_CLOUDFRONT|EDGE_CASE"
    "There isn't a GitHub Pages site here|GITHUB_PAGES|YES"
    "No such app|HEROKU|YES"
    "no-such-app|HEROKU|YES"
    "herokucdn.com/error-pages|HEROKU|YES"
    "Sorry, this shop is currently unavailable|SHOPIFY|EDGE_CASE"
    "There's nothing here.|TUMBLR|YES"
    "Whatever you were looking for doesn't currently exist|TUMBLR|YES"
    "The thing you were looking for is no longer here|GHOST|YES"
    "404 error unknown site|PANTHEON|YES"
    "project not found|SURGE|YES"
    "Repository not found|BITBUCKET|YES"
    "Fastly error: unknown domain|FASTLY|YES"
    "We could not find what you're looking for|HELPJUICE|YES"
    "No settings were found for this company|HELPSCOUT|YES"
    "The feed has not been found|FEEDPRESS|YES"
    "There is no helpdesk here|FRESHDESK|NO"
    "May be this is still fresh|FRESHDESK|NO"
    "404 Web Site not found|AZURE_APP_SERVICE|YES"
    "BlobNotFound|AZURE_BLOB|EDGE_CASE"
    "ContainerNotFound|AZURE_BLOB|EDGE_CASE"
    "ResourceNotFound|AZURE_BLOB|EDGE_CASE"
    "The deployment could not be found|VERCEL|NO"
    "DEPLOYMENT_NOT_FOUND|VERCEL|NO"
    "Not Found - Request ID|NETLIFY|NO"
    "Site Not Found|FIREBASE|NO"
    "Do you want to register|WORDPRESS|YES"
    "If you're moving your domain|CARGO|YES"
    "Domain is not configured|SMARTLING|YES"
    "The page you are looking for doesn't exist or has been moved|WEBFLOW|EDGE_CASE"
    "Project doesnt exist|README|YES"
    "It looks like you may have taken a wrong turn|LAUNCHROCK|YES"
    "Sorry, this page is no longer available|AGILECRM|YES"
    "page not found|STRIKINGLY|YES"
)

check_subdomain() {
    local subdomain="$1"
    local matched_service=""
    local matched_fingerprint=""
    local matched_status=""
    local match_found=false
    
    echo -e "${CYAN}[*] Fingerprint Matcher${NC}" >&2
    echo -e "${BLUE}[+] Target: $subdomain${NC}" >&2
    
    # Get CNAME
    local cname
    cname=$(dig CNAME "$subdomain" +short 2>/dev/null | head -1 | sed 's/\.$//')
    echo -e "    CNAME: ${cname:-'none'}" >&2
    
    # Get HTTP response body
    echo -e "${BLUE}[+] Fetching HTTP response...${NC}" >&2
    local response_body
    response_body=$(curl -sL --connect-timeout 10 --max-time 20 "https://$subdomain" 2>/dev/null || \
                    curl -sL --connect-timeout 10 --max-time 20 "http://$subdomain" 2>/dev/null || \
                    echo "CONNECTION_FAILED")
    
    # Get HTTP headers
    local response_headers
    response_headers=$(curl -sI --connect-timeout 10 --max-time 15 "https://$subdomain" 2>/dev/null || echo "")
    
    # Get HTTP status
    local http_status
    http_status=$(curl -sIL -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "https://$subdomain" 2>/dev/null || echo "000")
    
    # Match against all fingerprints
    echo -e "${BLUE}[+] Matching against ${#FINGERPRINTS[@]} fingerprints...${NC}" >&2
    
    local matches=()
    for fp_entry in "${FINGERPRINTS[@]}"; do
        IFS='|' read -r fingerprint service vuln_status <<< "$fp_entry"
        
        if echo "$response_body" | grep -qi "$fingerprint" 2>/dev/null; then
            match_found=true
            matched_service="$service"
            matched_fingerprint="$fingerprint"
            matched_status="$vuln_status"
            
            local color="$GREEN"
            [ "$vuln_status" = "YES" ] && color="$RED"
            [ "$vuln_status" = "EDGE_CASE" ] && color="$YELLOW"
            
            echo -e "${color}[!] MATCH: $service - '$fingerprint' (Vulnerable: $vuln_status)${NC}" >&2
            matches+=("{\"service\":\"$service\",\"fingerprint\":\"$fingerprint\",\"vulnerable\":\"$vuln_status\"}")
        fi
    done
    
    # Check headers for provider identification
    local detected_provider="UNKNOWN"
    if echo "$response_headers" | grep -qi "x-github-request-id"; then
        detected_provider="GITHUB"
    elif echo "$response_headers" | grep -qi "x-amz-"; then
        detected_provider="AWS"
    elif echo "$response_headers" | grep -qi "x-azure-"; then
        detected_provider="AZURE"
    elif echo "$response_headers" | grep -qi "x-vercel-id"; then
        detected_provider="VERCEL"
    elif echo "$response_headers" | grep -qi "x-served-by.*cache-"; then
        detected_provider="FASTLY"
    elif echo "$response_headers" | grep -qi "via.*cloudfront"; then
        detected_provider="CLOUDFRONT"
    elif echo "$response_headers" | grep -qi "server.*heroku"; then
        detected_provider="HEROKU"
    fi
    
    # Build matches JSON array
    local matches_json="["
    local first=true
    for m in "${matches[@]:-}"; do
        [ -z "$m" ] && continue
        if [ "$first" = true ]; then
            first=false
        else
            matches_json+=","
        fi
        matches_json+="$m"
    done
    matches_json+="]"
    
    # Determine overall classification
    local classification="NOT_VULNERABLE"
    local confidence="LOW"
    
    if [ "$match_found" = true ]; then
        if [ "$matched_status" = "YES" ]; then
            classification="VULNERABLE"
            confidence="HIGH"
        elif [ "$matched_status" = "EDGE_CASE" ]; then
            classification="POTENTIAL"
            confidence="MEDIUM"
        else
            classification="NOT_VULNERABLE"
            confidence="HIGH"
        fi
    fi
    
    local body_snippet
    body_snippet=$(echo "$response_body" | head -3 | tr '"' "'" | tr '\n' ' ' | cut -c1-150)
    
    cat <<EOF
{
  "subdomain": "$subdomain",
  "cname": "${cname:-null}",
  "http_status": "$http_status",
  "detected_provider": "$detected_provider",
  "fingerprint_matches": $matches_json,
  "classification": "$classification",
  "confidence": "$confidence",
  "response_snippet": "$body_snippet"
}
EOF

    if [ "$match_found" = false ]; then
        echo -e "${GREEN}[✓] No vulnerable fingerprints matched${NC}" >&2
    fi
}

# Main
if [ $# -lt 1 ]; then
    echo "Usage: $0 <subdomain>" >&2
    echo "Example: $0 blog.example.com" >&2
    exit 1
fi

check_subdomain "$1"
