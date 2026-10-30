# Bug Bounty Checklist - The Complete Security Testing Playbook

> **Source:** [checklist.hackwithsingh.com](https://checklist.hackwithsingh.com)
> **Total Checks:** 9,691 | **Categories:** 225 | **Domains:** 6

---

## Table of Contents

1. [Web Security](#-web-security)
2. [API Security](#-api-security)
3. [Android Security](#-android-security)
4. [iOS Security](#-ios-security)
5. [Thick Client Security](#-thick-client-security)
6. [Web3 / Smart Contract](#-web3--smart-contract)
7. [Tools & Resources Reference](#-tools--resources-reference)
8. [Methodology & Best Practices](#-methodology--best-practices)

---

# Web Security

## 1. Subdomain Enumeration (50 checks)

- [ ] Use **subfinder** for passive subdomain enumeration
- [ ] Use **amass** for deep subdomain discovery with OSINT integration
- [ ] Use **assetfinder** to find subdomains from various data sources
- [ ] Use **Findomain** for fast subdomain enumeration
- [ ] Query **crt.sh** certificate transparency logs
- [ ] Use **SecurityTrails API** for DNS records
- [ ] Use **Shodan** for subdomain discovery
- [ ] Use **Censys** for certificate-based subdomain discovery
- [ ] Use **DNSdumpster** for DNS recon and visual mapping
- [ ] Use **Wayback Machine CDX API** for old subdomains
- [ ] Use **VirusTotal domain report** for passive DNS
- [ ] Use **Google dorking**: site:target.com -www
- [ ] Use **Bing dorking**: site:target.com
- [ ] Perform **DNS brute force** with dnsrecon
- [ ] Use **massdns** for fast DNS resolution
- [ ] Check for **wildcard DNS** responses
- [ ] Attempt **DNS zone transfer (AXFR)**
- [ ] Enumerate subdomains from **JavaScript files**
- [ ] Extract subdomains from **SPF records**
- [ ] Extract subdomains from **DMARC reports**
- [ ] Check for **subdomain takeover** vulnerability
- [ ] Verify **DNSSEC** configuration
- [ ] Check for **dangling CNAME** records
- [ ] Use **sublist3r** with all search engines
- [ ] Search **GitHub/GitLab** for subdomain references
- [ ] Use **Chaos dataset** from ProjectDiscovery
- [ ] Check subdomains in **Android/iOS APKs/IPAs**
- [ ] Use **Rapid7 Project Sonar** for DNS lookup
- [ ] Enumerate **cloud subdomains** (S3, Azure, GCP)
- [ ] Use **BufferOver.run** from Rapid7 Sonar
- [ ] Check in **Common Crawl** data index
- [ ] Use **CertSpotter API** for CT monitoring
- [ ] Search in **FOFA** search engine
- [ ] Check in **ZoomEye** search engine
- [ ] Check for **Punycode/IDN** homograph variants

## 2. Port Scanning & Service Enumeration (50 checks)

- [ ] Run **nmap TCP SYN scan** on all 65535 ports
- [ ] Use **masscan** for ultra-fast port scanning
- [ ] Use **rustscan** for fast port discovery
- [ ] Run **nmap UDP scan** on common ports
- [ ] Use **nmap service version detection** (-sV)
- [ ] Run **nmap default script scan** (-sC)
- [ ] Enumerate **database ports** (3306, 5432, 1433, 27017)
- [ ] Check for **Redis** on port 6379
- [ ] Check for **Elasticsearch** on port 9200
- [ ] Check for **Memcached** on port 11211
- [ ] Scan for **Docker API** on port 2375/2376
- [ ] Scan for **Kubernetes API** on port 6443/8443
- [ ] Check for **RDP** on port 3389
- [ ] Check for **SSH** on port 22
- [ ] Check for **FTP** on port 21 with anonymous login
- [ ] Check for **SMTP** on port 25 for open relay
- [ ] Check for **SNMP** with default community strings
- [ ] Scan for **Jenkins** on port 8080/8443
- [ ] Check for **GitLab** on port 80/443/8080
- [ ] Check for **Consul** on port 8500
- [ ] Check for **etcd** on port 2379
- [ ] Check for **Apache Kafka** on port 9092
- [ ] Check for **RabbitMQ** on port 5672/15672
- [ ] Check for **Nagios** on port 5666/80
- [ ] Check for **Zabbix** on port 10050/10051
- [ ] Check for **SonarQube** on port 9000

## 3. Technology Fingerprinting (40 checks)

- [ ] Use **Wappalyzer** browser extension for technology stack detection
- [ ] Use **whatweb** for command-line technology fingerprinting at scale
- [ ] Use **webanalyze** (Go-based Wappalyzer) for fast batch fingerprinting
- [ ] Check HTTP response headers for server version disclosure
- [ ] Check **X-Powered-By** header for backend technology identification
- [ ] Analyze **cookies** for framework indicators (PHPSESSID, JSESSIONID)
- [ ] Check for framework-specific **meta tags** and generator tags
- [ ] Identify CMS using **WPScan** (WordPress), **Joomscan** (Joomla)
- [ ] Detect JavaScript frameworks (React, Angular, Vue) via source code
- [ ] Check for **Cloudflare CDN** via cf-ray headers and DNS resolution
- [ ] Identify **hosting provider** from IP WHOIS and ASN lookup
- [ ] Check for **WAF** using wafw00f or Wappalyzer WAF detection
- [ ] Identify **GraphQL endpoint** via introspection query
- [ ] Check for **Swagger/OpenAPI** documentation at /swagger-ui/
- [ ] Check for **Spring Boot actuator** endpoints (/actuator/health)
- [ ] Identify **Laravel** via /telescope, /_debugbar, /horizon endpoints
- [ ] Identify **ASP.NET** via viewstate and event validation hidden fields
- [ ] Detect **Node.js** via X-Powered-By: Express header
- [ ] Detect **FastAPI** via /docs (Swagger UI) and /redoc endpoints

## 4. Content & URL Discovery (50 checks)

- [ ] Use **ffuf** for fast directory and file fuzzing with recursive mode
- [ ] Use **gobuster** for directory/file brute forcing with multiple threads
- [ ] Use **dirsearch** for recursive directory scanning with extensions
- [ ] Use **feroxbuster** for recursive content discovery with smart filtering
- [ ] Check for **robots.txt** and analyze all disallowed entries for hidden paths
- [ ] Check for **sitemap.xml** for hidden URLs and site structure information
- [ ] Check for **.well-known/** directory (security.txt, assetlinks.json)
- [ ] Look for **backup files** (.bak, .old, .orig, .save, .swp, .tmp)
- [ ] Check for **configuration files** (.env, .htaccess, .htpasswd, web.config)
- [ ] Look for **source code repositories** (.git, .svn, .hg, .bzr directories)
- [ ] Check for exposed **.git directory** (HEAD, config, index, objects)
- [ ] Search for **.DS_Store** files for macOS directory listing information
- [ ] Search for **log files** (error.log, access.log, debug.log)
- [ ] Check for **debug endpoints** (/debug, /trace, /status, /healthz, /info)
- [ ] Check for **API documentation** (/api-docs, /swagger, /redoc, /graphql)
- [ ] Look for **admin panels** (/admin, /administrator, /manager, /cpanel)
- [ ] Check for **phpMyAdmin** (/phpmyadmin, /pma, /dbadmin, /mysql)
- [ ] Check for **staging/dev environments** on subdomains (dev., staging.)
- [ ] Use **waybackurls** for historical URL discovery from Wayback Machine
- [ ] Use **gau** for fetching URLs from AlienVault, Wayback, Common Crawl
- [ ] Extract all URLs and endpoints from **JavaScript files** systematically
- [ ] Check for **.env file** exposure with database credentials and API keys
- [ ] Check for **Jenkins** script console access at /script endpoint
- [ ] Look for **exposed Grafana** dashboards at /grafana/ or :3000
- [ ] Check for **Prometheus** metrics endpoint at /metrics
- [ ] Look for **Kibana** dashboard on port 5601 with no auth
- [ ] Check for **Airflow** web UI on port 8080 with DAG access
- [ ] Look for **MinIO** console on port 9001 with bucket listing
- [ ] Check for **Apache Tomcat** manager at /manager/html
- [ ] Look for **JBoss** admin console at /admin-console/
- [ ] Check for **WebLogic** admin at /console/ with default creds
- [ ] Check for **Confluence** admin at /admin/ with default credentials
- [ ] Look for **Jira** admin at /secure/admin/ with default credentials
- [ ] Check for exposed **.well-known/openid-configuration**
- [ ] Look for **.well-known/oauth-authorization-server**
- [ ] Check for **.well-known/assetlinks.json** for Android app linking
- [ ] Look for **.well-known/apple-app-site-association** for iOS universal links
- [ ] Check for **.well-known/security.txt** for security contact information

## 5. Link & Parameter Discovery (40 checks)

- [ ] Use **katana** for comprehensive web crawling and URL discovery
- [ ] Use **hakrawler** for fast web crawling with depth control
- [ ] Use **Burp Suite spider** for comprehensive site mapping
- [ ] Extract all links from JavaScript files using **LinkFinder** tool
- [ ] Extract API endpoints from JS files using **JSParser** analysis
- [ ] Use **paramspider** for parameter discovery from historical data
- [ ] Find hidden parameters with **arjun** for HTTP parameter discovery
- [ ] Check for **path-based parameters** in URL paths
- [ ] Analyze JavaScript for **API routes and hidden parameters**
- [ ] Discover **WebSocket** endpoints and real-time connections
- [ ] Look for **Server-Sent Events (SSE)** endpoints for streaming data
- [ ] Discover internal API documentation in **JS source map files**
- [ ] Check for **sourcemap files** (.map) for original source code access
- [ ] Check for **REST API versioning** (/v1/, /v2/, /v3/)
- [ ] Look for **GraphQL schema** via introspection queries
- [ ] Discover **SOAP WSDL** endpoints (?wsdl, ?WSDL, ?xsd)
- [ ] Check for **XML-RPC** endpoints (/xmlrpc.php)
- [ ] Find **form action URLs** and hidden form field parameters
- [ ] Check for **iframe and embed** source URLs for cross-origin content
- [ ] Look for **OAuth/OpenID configuration** endpoints at /.well-known/
- [ ] Check for **SAML metadata** endpoints for federation config
- [ ] Find **callback/redirect URLs** in authentication flows
- [ ] Analyze **postMessage handlers** for cross-origin communication
- [ ] Discover **file upload endpoints** and their accepted parameters
- [ ] Check for **export/download endpoints** with configurable output
- [ ] Look for **search endpoints** with filter/sort parameters
- [ ] Check for **pagination parameters** (page, offset, limit, cursor)
- [ ] Discover **batch/bulk operation** endpoints

## 6. Password & Credential Attacks (40 checks)

- [ ] Test for **weak password policies** (minimum length, complexity)
- [ ] Test for **default credentials** on admin panels and services
- [ ] Check for **common passwords** (admin/admin, root/root, test/test)
- [ ] Test password reset flow for **token predictability** or entropy issues
- [ ] Check if password reset token is sent in **URL** (GET parameter leakage)
- [ ] Test password reset for **email enumeration** via different server responses
- [ ] Check if **old password is required** when changing password
- [ ] Check for **credential stuffing** vulnerability (absence of rate limiting)
- [ ] Test **brute force protection** on login endpoints with automation
- [ ] Check for **account lockout** mechanism and its threshold
- [ ] Test if account lockout can be used for **user enumeration**
- [ ] Check if passwords are stored in **plaintext or reversible encryption**
- [ ] Test password field for **SQL injection** vulnerabilities
- [ ] Test for **MFA bypass** via direct endpoint access
- [ ] Check if **2FA can be bypassed** by directly accessing post-auth pages
- [ ] Test **2FA brute force** on OTP verification codes
- [ ] Check if **2FA code is predictable** or follows sequential patterns
- [ ] Test **2FA code reuse** (same code works multiple times)
- [ ] Check if **backup/recovery codes** are generated with sufficient entropy
- [ ] Test if **2FA can be disabled** without current 2FA verification
- [ ] Check for **SMS interception** vulnerability in 2FA implementation
- [ ] Test for **2FA bypass** via response manipulation (changing status code)
- [ ] Check if **2FA is enforced** for all sensitive account actions
- [ ] Test for **rate limiting** on 2FA verification endpoint
- [ ] Test for **password reset token expiration** and single-use enforcement
- [ ] Check for **password reset with different user email** (account takeover)
- [ ] Test for **password complexity bypass** via encoding or special chars
- [ ] Test for **password maximum length** DoS (extremely long password)
- [ ] Test for **timing attack** on password comparison function
- [ ] Check for **CAPTCHA bypass** on login/password reset forms

## 7. Session Management (40 checks)

- [ ] Test session token **randomness** and predictability using entropy analysis
- [ ] Check session token **length** (should be at least 128 bits / 16 bytes)
- [ ] Test for **session fixation** vulnerability (session ID not rotating)
- [ ] Check if **session ID changes** after successful login
- [ ] Test if session is **properly invalidated** after logout
- [ ] Check **session timeout** configuration (idle and absolute session expiry)
- [ ] Test for **concurrent session** control (multiple simultaneous sessions)
- [ ] Check if session tokens are properly invalidated on **password change**
- [ ] Test for **session token in URL** query string (information disclosure)
- [ ] Check **Secure flag** on session cookies (HTTPS only transmission)
- [ ] Check **HttpOnly flag** on session cookies (no JavaScript access)
- [ ] Check **SameSite attribute** on session cookies (Lax or Strict)
- [ ] Test for **cookie injection** via CRLF injection in headers
- [ ] Check **session cookie domain scope** (should not be too broad)
- [ ] Check **session cookie path scope** (should be as narrow as possible)
- [ ] Test for **session hijacking** via XSS vulnerability exploitation
- [ ] Check if sessions are **bound to client IP** address
- [ ] Test if sessions are **bound to User-Agent** header
- [ ] Check for **session token disclosure** in server access logs
- [ ] Test JWT for **'none' algorithm** bypass vulnerability
- [ ] Test JWT for **algorithm confusion** attack (RS256 to HS256 switch)
- [ ] Check JWT **secret key strength** against brute force attacks
- [ ] Test JWT token **expiration (exp)** and **not-before (nbf)** claims
- [ ] Check JWT for **sensitive data exposure** in payload
- [ ] Test JWT for **jku/x5u header** parameter injection
- [ ] Test JWT for **kid parameter** injection (SQL injection, path traversal)
- [ ] Check JWT for **claim manipulation** and privilege escalation
- [ ] Check if **refresh tokens** are securely stored and properly rotated
- [ ] Test for **session token in WebSocket** upgrade handshake
- [ ] Test for **session cookie prefix** (__Host- and __Secure- usage)

## 8. OAuth & SSO Testing (30 checks)

- [ ] Test OAuth 2.0 authorization code flow for **CSRF** (missing state parameter)
- [ ] Check **state parameter** presence and proper validation in OAuth flow
- [ ] Test **redirect_uri validation** for bypass (path traversal, subdomain)
- [ ] Check for **open redirect** vulnerability via redirect_uri parameter
- [ ] Test **OAuth token leakage** in Referer header after redirect
- [ ] Check for **implicit grant** token exposure in URL fragment
- [ ] Test **OAuth scope escalation** (requesting higher scopes than authorized)
- [ ] Check for **authorization code reuse** across sessions
- [ ] Test **PKCE implementation** for native/mobile application security
- [ ] Check **client_secret exposure** in public clients (JavaScript, mobile)
- [ ] Test for **OAuth token exchange** and delegation attacks
- [ ] Check **SAML assertion** security for XML injection
- [ ] Test SAML for **XML signature wrapping** attacks
- [ ] Test SAML for **assertion replay attacks**
- [ ] Check SAML for **XSLT injection** in transformation
- [ ] Test **OpenID Connect id_token** signature validation
- [ ] Check for **OpenID Connect nonce** parameter validation
- [ ] Test for **OpenID Connect token substitution** between users
- [ ] Check for **SSO session persistence** across different applications
- [ ] Test for **SSO logout** across all federated applications
- [ ] Check for **IdP-initiated SSO** authentication request attacks
- [ ] Test for **SAML comment injection** in NameID element
- [ ] Check for **Kerberos delegation** and constrained delegation attacks
- [ ] Test for **NTLM relay** attacks in SSO authentication
- [ ] Check for **LDAP injection** in SSO login form
- [ ] Test OAuth 2.0 **client credentials grant** for impersonation
- [ ] Check for **OAuth refresh token** rotation and reuse prevention
- [ ] Test for **OAuth token binding** to client (mTLS or DPoP)
- [ ] Check for **OAuth PKCE downgrade** attack (code_verifier removal)
- [ ] Test for **OAuth redirect_uri mismatch** between endpoints

## 9. Login & Registration Bypass (30 checks)

- [ ] Test login for **username/email enumeration** via response timing differences
- [ ] Test login with **SQL injection** in username and password fields
- [ ] Test for **NoSQL injection** in authentication endpoints
- [ ] Check for **LDAP injection** in enterprise authentication
- [ ] Test for **authentication bypass** via parameter tampering (role=admin)
- [ ] Test for **authentication bypass** via HTTP method switching (GET vs POST)
- [ ] Check for **authentication bypass** via forceful browsing
- [ ] Test for **broken authentication** in password reset mechanism
- [ ] Test for **email verification bypass** (direct account activation)
- [ ] Test for **account takeover** via email change without verification
- [ ] Check for **account takeover** via phone number change without verification
- [ ] Test for **mass assignment** in registration endpoint (role, isAdmin)
- [ ] Check for **privilege escalation** during user registration
- [ ] Test for **X-Forwarded-For** bypass of IP-based rate limiting
- [ ] Test for **X-Original-URL** bypass of authentication middleware
- [ ] Check for **authentication bypass** via URL path manipulation
- [ ] Test for **HTTP parameter pollution** in authentication endpoints
- [ ] Check for **authentication via API key** in URL query string
- [ ] Test for **timing attack** on authentication comparison function
- [ ] Test for **CAPTCHA bypass** in registration and login forms
- [ ] Check for **account creation without email verification**
- [ ] Test for **disposable email** acceptance in registration
- [ ] Check for **weak password reset questions** (easily guessable)
- [ ] Check for **registration with admin-impersonating** email format
- [ ] Test for **Unicode case mapping confusion** in username comparison

## 10. IDOR (Insecure Direct Object Reference) (25 checks)

- [ ] Test for **IDOR in URL path** parameters (/users/123/profile)
- [ ] Test for **IDOR in query parameters** (?user_id=123&doc_id=456)
- [ ] Test for **IDOR in POST body** parameters (user_id in form data)
- [ ] Test for **IDOR in JSON request** body ({"user_id": 123})
- [ ] Test for **IDOR in HTTP headers** (X-User-Id, X-Account-Id)
- [ ] Test for IDOR with **UUID vs sequential integer** identifiers
- [ ] Test for IDOR with **encoded parameters** (base64, URL encoding, hex)
- [ ] Test for IDOR across **different user roles** (admin vs user vs guest)
- [ ] Test for IDOR in **file download/upload** endpoints
- [ ] Test for IDOR in API endpoints with **different HTTP methods**
- [ ] Test for IDOR by modifying **cookie values** (user_id cookie)
- [ ] Test for IDOR in **WebSocket messages** and real-time communication
- [ ] Test for IDOR in **batch/bulk operations** (multiple resource access)
- [ ] Test for IDOR with **parameter addition** (adding user_id to request)
- [ ] Test for IDOR with **wrapping IDs** (negative numbers, zero, MAX_INT)
- [ ] Test for IDOR with other user's **UUID/GUID** via info leak
- [ ] Test for IDOR in **search and filter** parameters
- [ ] Test for IDOR in **pagination parameters** (offset, cursor)
- [ ] Test for IDOR in **nested objects** (user.profile.id, order.item.id)
- [ ] Test for IDOR across **different applications** in same organization
- [ ] Test for IDOR in **receipt/invoice** access by sequential numbers
- [ ] Test for IDOR in **messaging/comment** endpoints
- [ ] Test for IDOR in **notification subscription** endpoints
- [ ] Test for IDOR in **API key-scoped** resources
- [ ] Test for IDOR with **different API versions** (v1 vs v2)

## 11. Privilege Escalation (25 checks)

- [ ] Test **vertical privilege escalation** (normal user to admin access)
- [ ] Test **horizontal privilege escalation** (user A accessing user B data)
- [ ] Test for **role manipulation** in request parameters (role=admin)
- [ ] Test for **role manipulation** in JWT claims (role, scope, groups)
- [ ] Test for **role manipulation** in session cookies
- [ ] Check if **admin endpoints are properly protected** with authorization
- [ ] Test for **privilege escalation via mass assignment** (isAdmin: true)
- [ ] Check if **user role can be changed** via profile update endpoint
- [ ] Test for **privilege escalation via API parameter** tampering
- [ ] Test for **privilege escalation via feature flag** manipulation
- [ ] Check for **insecure direct access** to admin functionality via URL
- [ ] Test for **privilege escalation via GraphQL** mutations
- [ ] Test for **privilege escalation via race condition** in role assignment
- [ ] Check for **broken access control** in multi-tenant applications
- [ ] Test for **privilege escalation via group/team membership** change
- [ ] Test for **bypass of role-based access** via URL encoding tricks
- [ ] Check for **improper authorization** at API gateway level
- [ ] Test for **privilege escalation via HTTP method override** header
- [ ] Test for **privilege escalation via content-type** switching
- [ ] Check for **inconsistent authorization** between UI and API layers
- [ ] Test for **privilege escalation via organization ID** manipulation
- [ ] Test for **privilege escalation via backup/restore** functionality
- [ ] Check for **privilege escalation via import/export** with role data

## 12. Path Traversal & File Access (25 checks)

- [ ] Test for directory traversal with **../** sequences in URL parameters
- [ ] Test for directory traversal with **..\** sequences for Windows servers
- [ ] Test for directory traversal with **URL encoding** (%2e%2e%2f)
- [ ] Test for directory traversal with **double URL encoding** (%252e%252e%252f)
- [ ] Test for directory traversal with **Unicode encoding** (..%c0%af)
- [ ] Test for directory traversal with **null byte injection** (%00.json)
- [ ] Test for **path traversal bypass** with ....// sequences
- [ ] Test for path traversal with **nested encoding** variations
- [ ] Test for path traversal via **file download** endpoints
- [ ] Test for path traversal via **file upload destination** manipulation
- [ ] Test for path traversal in **image/file processing** endpoints
- [ ] Check for **/proc/self/environ** access via path traversal
- [ ] Check for **/etc/passwd** access via path traversal
- [ ] Check for **/etc/shadow** access via path traversal
- [ ] Test for path traversal in **archive extraction** (zip slip vulnerability)
- [ ] Test for path traversal in **symlink following** operations
- [ ] Test for path traversal in **S3/cloud storage** key parameters
- [ ] Test for path traversal in **PDF generation** endpoints
- [ ] Test for path traversal in **template rendering** with file inclusion
- [ ] Check for path traversal in **log file viewing** functionality
- [ ] Test for path traversal in **configuration file** loading
- [ ] Check for path traversal in **backup file download** feature

## 13. SQL Injection (30 checks)

- [ ] Test for SQL injection in all input fields with **single quote** (')
- [ ] Test for SQL injection in URL parameters with **OR 1=1** payloads
- [ ] Test for SQL injection in **HTTP headers** (Cookie, User-Agent, Referer)
- [ ] Test for **UNION-based** SQL injection with column count detection
- [ ] Test for **error-based** SQL injection using database-specific functions
- [ ] Test for **blind SQL injection** with boolean conditions (AND 1=1 vs 1=2)
- [ ] Test for **blind SQL injection** with time delays (SLEEP, WAITFOR, pg_sleep)
- [ ] Test for **out-of-band** SQL injection with DNS/HTTP exfiltration
- [ ] Test for SQL injection in **ORDER BY** clause
- [ ] Test for SQL injection in **INSERT** statements (registration forms)
- [ ] Test for SQL injection in **UPDATE** statements (profile update)
- [ ] Test for **second-order SQL injection** (stored injection payloads)
- [ ] Test for WAF bypass with **SQL comments** (/*!50000SELECT*/, --+, #)
- [ ] Test for WAF bypass with **case variation** (SeLeCt, UnIoN)
- [ ] Test for WAF bypass with **URL encoding** of SQL keywords
- [ ] Test for SQL injection with **JSON parameters** in modern APIs
- [ ] Test for SQL injection in **GraphQL query** arguments
- [ ] Test for **MySQL-specific** SQL injection (information_schema, load_file)
- [ ] Test for **PostgreSQL-specific** SQL injection (pg_read_file, dblink)
- [ ] Test for **MSSQL-specific** SQL injection (xp_cmdshell, OPENROWSET)
- [ ] Test for **Oracle-specific** SQL injection (UTL_HTTP, DBMS_LOB)
- [ ] Test for **SQLite-specific** SQL injection

## 14. Cross-Site Scripting (XSS) (40 checks)

- [ ] Test for **reflected XSS** in all URL parameters with basic payloads
- [ ] Test for **stored XSS** in user-generated content fields (comments, posts)
- [ ] Test for **DOM-based XSS** in client-side JavaScript code
- [ ] Test for **Blind XSS** via XSS Hunter or similar callback service
- [ ] Test for XSS in **file upload filenames** displayed on the page
- [ ] Test for XSS in **SVG file uploads** with embedded JavaScript
- [ ] Test for XSS in **Markdown/HTML content** rendering (WYSIWYG bypass)
- [ ] Test for XSS via **server-side template injection** (SSTI to XSS)
- [ ] Test with **event handlers** (onerror, onload, onclick, onmouseover)
- [ ] Test with **JavaScript pseudo-protocol** (javascript:alert(1))
- [ ] Test with **data URI scheme** (data:text/html,alert(1))
- [ ] Test for XSS in **JSON responses** (JSON injection to HTML context)
- [ ] Test for XSS in **error messages** that reflect user input
- [ ] Test for XSS in **PDF generation** endpoints that render HTML
- [ ] Test for XSS in **email content** if application renders HTML emails
- [ ] Test bypass with **HTML entity encoding**
- [ ] Test bypass with **Unicode encoding** variations
- [ ] Test via **iframe injection** with srcdoc attribute
- [ ] Test via **base tag injection** to hijack relative URLs
- [ ] Test via **form action injection** to steal credentials
- [ ] Test via **meta refresh redirect** to malicious page
- [ ] Test in **AngularJS sandbox escape** ({{constructor.constructor}})
- [ ] Test in **Vue.js template injection** ({{constructor}})
- [ ] Test in **React dangerouslySetInnerHTML** prop usage
- [ ] Test for **Mutation XSS (mXSS)** in DOMPurify/library bypass
- [ ] Test for XSS with **SVG animate/set** elements
- [ ] Test for XSS with **HTML5 autofocus** attribute

## 15. Server-Side Request Forgery (SSRF) (30 checks)

- [ ] Test for SSRF in **URL parameters** that fetch remote resources
- [ ] Test for SSRF in **file import endpoints** (import from URL feature)
- [ ] Test for SSRF in **webhook URL** configuration
- [ ] Test for SSRF in **PDF generator** endpoints with external images
- [ ] Test for SSRF in **image processing** endpoints (fetch from URL)
- [ ] Test for SSRF in **SVG file import** with external references
- [ ] Test with **internal IP addresses** (127.0.0.1, 10.x.x.x, 192.168.x.x)
- [ ] Test with **cloud metadata endpoints** (169.254.169.254)
- [ ] Test with **DNS rebinding** technique for filter bypass
- [ ] Test with **redirect-based bypass** via 302 redirects
- [ ] Test with **URL encoding** bypass of IP restrictions
- [ ] Test with **IPv6 addresses** (::1, ::ffff:127.0.0.1)
- [ ] Test with **decimal IP** representation (2130706433 for 127.0.0.1)
- [ ] Test with **octal IP** representation (0177.0.0.1 for 127.0.0.1)
- [ ] Test with **@ symbol** in URL for authentication bypass
- [ ] Test for **blind SSRF** via out-of-band DNS/HTTP interaction
- [ ] Test to read **local files** via file:// protocol
- [ ] Test to access internal **Kubernetes services** (https://kubernetes)
- [ ] Test in **XML external entity** processing (XXE to SSRF)
- [ ] Test with **fragmented URLs** for parser confusion
- [ ] Test with **HTTP/HTTPS protocol switching** bypass

## 16. Server-Side Template Injection (SSTI) (25 checks)

- [ ] Test with **{{7*7}}** expression in input fields
- [ ] Test with **${7*7}** expression in input fields
- [ ] Test with **<%= 7*7 %>** expression in input fields
- [ ] Test with **#{7*7}** expression in input fields
- [ ] Test for **Jinja2** template injection (Python Flask/Django)
- [ ] Test for **Twig** template injection (PHP Symfony)
- [ ] Test for **Freemarker** template injection (Java Spring)
- [ ] Test for **Velocity** template injection (Java)
- [ ] Test for **Mako** template injection (Python)
- [ ] Test for **ERB (Ruby)** template injection
- [ ] Test for **Thymeleaf** template injection (Java Spring)
- [ ] Test for **Handlebars** template injection (JavaScript)
- [ ] Test for **Angular** template injection ({{constructor}})
- [ ] Test for **Vue.js** template injection ({{_context}})
- [ ] Test for SSTI **RCE** via Python object traversal (MRO chain)
- [ ] Test for SSTI with **sandbox escape** techniques per engine
- [ ] Test for SSTI in **email template** rendering functionality
- [ ] Test for SSTI in **PDF generation** template systems
- [ ] Test for SSTI in **report generation** with user-controlled input
- [ ] Test for SSTI in **error page rendering** with reflected input
- [ ] Test for **blind SSTI** with out-of-band DNS/HTTP interaction

## 17. OS Command Injection (25 checks)

- [ ] Test with **semicolons** (; id)
- [ ] Test with **pipe** (| id)
- [ ] Test with **backticks** (\`id\`)
- [ ] Test with **$() syntax** ($(id))
- [ ] Test with **newline characters** (%0aid)
- [ ] Test with **&& and ||** operators
- [ ] Test for **blind OS command injection** with time delays (sleep 5)
- [ ] Test for **blind OS command injection** with DNS interaction (nslookup)
- [ ] Test for **blind OS command injection** with HTTP callback (curl/wget)
- [ ] Test in **file upload filename** parameters
- [ ] Test in **image processing** (ImageMagick)
- [ ] Test in **PDF generation** tools
- [ ] Test in **ping/traceroute** features
- [ ] Test in **DNS lookup** features
- [ ] Test with **WAF bypass** techniques
- [ ] Test with **input encoding** bypass
- [ ] Test with **parameter expansion** ($IFS)
- [ ] Test in **backup/restore** features
- [ ] Test in **cron job parameter** inputs
- [ ] Test in **email header** parameters
- [ ] Test with **environment variable** manipulation
- [ ] Test with **path traversal in binary** name
- [ ] Test via **log injection** for log processing
- [ ] Test in **archive extraction** (zip)
- [ ] Test with **Unicode normalization** tricks

## 18. NoSQL Injection (20 checks)

- [ ] Test for **MongoDB injection** with $gt, $ne, $regex operators
- [ ] Test for **NoSQL injection** in JSON body parameters
- [ ] Test with **$where operator** for JavaScript execution
- [ ] Test with **$lookup operator** for data access
- [ ] Test in **array parameter** format (param[]=value)
- [ ] Test **operator injection** ($gt: '' for auth bypass)
- [ ] Test **authentication bypass** with $ne operator
- [ ] Test **boolean-based blind** injection via response differences
- [ ] Test **time-based blind** injection with $where sleep
- [ ] Test in **REST API JSON endpoints**
- [ ] Test for **CouchDB injection** via view functions
- [ ] Test for **Cassandra injection** with CQL query manipulation
- [ ] Test for **Redis injection** via EVAL command execution
- [ ] Test in **MongoDB ObjectID** parameter
- [ ] Test with **type confusion** attacks
- [ ] Test with **$expr operator** for aggregation
- [ ] Test in **MongoDB aggregate pipeline**
- [ ] Test with **$regex** for data extraction
- [ ] Test in **map-reduce functions**
- [ ] Test with **BSON type confusion**

## 19. LDAP Injection (10 checks)

- [ ] Test with *** wildcard** in login forms
- [ ] Test in **search functionality** with parentheses
- [ ] Test with *** wildcard** for information disclosure
- [ ] Test with **() parentheses** for query manipulation
- [ ] Test with **| and & operators** for logic bypass
- [ ] Test authentication bypass with )(cn=*))(|(cn=*
- [ ] Test for **attribute enumeration** via error-based injection
- [ ] Test for **blind LDAP injection** with boolean conditions
- [ ] Test with **backslash escape** character
- [ ] Test in **directory search** features

## 20. XML Injection & XXE (20 checks)

- [ ] Test for **XXE** in XML input
- [ ] Test via **file upload** (SVG with external entity, DOCX/XLSX)
- [ ] Test via **SOAP endpoints** with XML message body
- [ ] Test via **AJAX requests** with XML content type
- [ ] Test with **SYSTEM entity** for local file reading
- [ ] Test with **PUBLIC entity** for file reading
- [ ] Test with **parameter entities** for out-of-band data
- [ ] Test for **blind XXE** with out-of-band DNS/HTTP interaction
- [ ] Test for **blind XXE** via DNS exfiltration technique
- [ ] Test for **blind XXE** via HTTP exfiltration technique
- [ ] Test in **SAML assertions** for SSO exploitation
- [ ] Test in **SOAP WSDL parsing** and processing
- [ ] Test in **RSS/Atom feed** parsing functionality
- [ ] Test bypass with **UTF-16 encoding**
- [ ] Test bypass with **various encoding** variations
- [ ] Test for **XInclude injection** in XML processing
- [ ] Test for **XML injection** for data manipulation attacks
- [ ] Test for **XML bomb** (billion laughs) DoS attack
- [ ] Test for **XPath injection** in XML-based applications
- [ ] Test for **XSLT injection** for remote code execution

## 21. Business Logic Vulnerabilities (20 checks)

- [ ] Test for **price manipulation** in e-commerce checkout flow
- [ ] Test for **quantity manipulation** (negative quantities, zero)
- [ ] Test for **currency manipulation** in payment flows
- [ ] Test for **discount code reuse and stacking** vulnerabilities
- [ ] Test for **referral code manipulation** and abuse
- [ ] Test for **race condition** in coupon/discount application
- [ ] Test for **double spending** in virtual currency systems
- [ ] Test for **bypass of payment step** in checkout flow
- [ ] Test for **interest rate manipulation** in financial apps
- [ ] Test for **transfer amount manipulation** in banking apps
- [ ] Test for **account balance bypass** using negative amounts
- [ ] Test for **unlimited resource creation** (accounts, projects)
- [ ] Test for **bypass of upload limits** and storage quotas
- [ ] Test for **workflow bypass** by skipping required steps
- [ ] Test for **state machine manipulation** to reach invalid states
- [ ] Test for **post-payment action manipulation** (refund exploitation)
- [ ] Test for **trial period bypass** via date manipulation
- [ ] Test for **feature flag bypass** via request parameter manipulation
- [ ] Test for **subscription tier bypass** via role manipulation
- [ ] Test for **email/phone verification bypass** in critical flows

## 22. Race Conditions (15 checks)

- [ ] Test for race condition in **balance transfer** (concurrent requests)
- [ ] Test for race condition in **coupon/discount code** redemption
- [ ] Test for race condition in **voting/liking** mechanism
- [ ] Test for race condition in **file upload duplicate** creation
- [ ] Test for race condition in **account creation** with duplicate data
- [ ] Test for race condition in **password reset token** usage
- [ ] Test for race condition in **gift card** redemption
- [ ] Test for race condition in **inventory reservation** system
- [ ] Test with **concurrent HTTP requests** (Turbo Intruder)
- [ ] Test for race condition in **email verification** flow
- [ ] Test for race condition in **2FA verification code** usage
- [ ] Test for race condition in **session creation** and authentication
- [ ] Test for race condition in **API rate limiting** bypass
- [ ] Test for race condition in **database read-modify-write** operations
- [ ] Test for race condition in **distributed system** consistency

## 23. CSRF (Cross-Site Request Forgery) (20 checks)

- [ ] Test for CSRF in all **state-changing requests** (POST/PUT/DELETE)
- [ ] Check for **CSRF token presence** and proper validation in forms
- [ ] Test for **CSRF token bypass** by removing the token entirely
- [ ] Test for **CSRF token reuse** across different sessions
- [ ] Test for **CSRF token predictability** and entropy
- [ ] Check if **CSRF token is tied to user session** properly
- [ ] Test via **JSON content type** with CORS bypass
- [ ] Test via **XML content type** submission
- [ ] Test with **multipart/form-data** encoding
- [ ] Test in **AJAX requests** (X-Requested-With header)
- [ ] Test in **WebSocket connection** establishment
- [ ] Check for **SameSite cookie attribute** on session cookies
- [ ] Test for **login CSRF** (forcing victim to authenticate as attacker)
- [ ] Test for **CSRF in password change** functionality
- [ ] Test for **CSRF in email change** functionality
- [ ] Test bypass with **custom headers** (X-Forwarded-*)
- [ ] Test bypass with **HTTP method override** (_method parameter)
- [ ] Check for **Origin/Referer header** validation implementation
- [ ] Test for **CSRF in GraphQL** mutation operations
- [ ] Test for CSRF in API endpoints without **CORS restriction**

## 24. CORS Misconfiguration (15 checks)

- [ ] Test CORS with **arbitrary Origin** header for reflection
- [ ] Test CORS with **null Origin** for null origin bypass
- [ ] Test CORS with **subdomain Origin** for subdomain trust bypass
- [ ] Test CORS with **Origin matching target domain** for domain trust
- [ ] Check for **Access-Control-Allow-Credentials: true** with wildcard
- [ ] Test for CORS with **domain suffix matching** (.target.com)
- [ ] Test for CORS with **domain prefix matching** (target.com.evil.com)
- [ ] Check for insecure CORS patterns allowing **regex bypass**
- [ ] Test CORS with **different HTTP methods** and headers
- [ ] Test CORS with **custom headers** for preflight bypass
- [ ] Test for **CORS trust for arbitrary subdomains**
- [ ] Check for CORS with **third-party domain whitelisting**
- [ ] Test for **CORS header reflection** without proper validation
- [ ] Test for **CORS origin validation bypass** via encoding tricks
- [ ] Check for **CORS in WebSocket** upgrade requests

## 25. Clickjacking (10 checks)

- [ ] Test for clickjacking with **iframe embedding** of target page
- [ ] Check for **X-Frame-Options** header presence and value
- [ ] Check for **Content-Security-Policy frame-ancestors** directive
- [ ] Test for **X-Frame-Options bypass** with framing in same origin
- [ ] Test for **drag-and-drop clickjacking** for data exfiltration
- [ ] Test for **cursor-based clickjacking** with hidden cursor
- [ ] Test for **multi-step clickjacking** requiring multiple clicks
- [ ] Test for clickjacking on **sensitive action buttons**
- [ ] Test for clickjacking on **authentication flow pages**
- [ ] Test with **transparent iframes** over decoy content

## 26. File Upload Vulnerabilities (20 checks)

- [ ] Test for **unrestricted file upload** allowing any file type
- [ ] Test for **file extension blacklist bypass** with uncommon extensions
- [ ] Test for **file extension whitelist bypass** with double extensions
- [ ] Test for **double extension bypass** (file.php.jpg, file.jsp.png)
- [ ] Test for **null byte in filename** (file.php%00.jpg)
- [ ] Test for **content-type manipulation** to bypass extension checks
- [ ] Test for **magic bytes manipulation** to spoof file type detection
- [ ] Test for **SVG file upload** with embedded XSS payload
- [ ] Test for **HTML file upload** with JavaScript execution
- [ ] Test for **server-side file inclusion** via uploaded file path
- [ ] Test for **file upload path traversal** in destination directory
- [ ] Test for **file upload race condition** (access before validation)
- [ ] Test for **polyglot file upload** (valid image + malicious code)
- [ ] Test for **ZIP bomb upload** causing disk space exhaustion
- [ ] Test for file upload to **cloud storage** with public ACL access
- [ ] Test for **image file upload** with EXIF data containing XSS
- [ ] Test for file upload with **oversized files** for DoS
- [ ] Test for file upload with **malicious metadata** in documents
- [ ] Test for file upload in **archive extraction** (zip slip)
- [ ] Test for file upload with **SVG containing XXE** payload

## 27. TLS/SSL Configuration (20 checks)

- [ ] Test for **SSL/TLS version** (should be TLS 1.2+, reject 1.0/1.1)
- [ ] Check for **weak cipher suites** (RC4, DES, 3DES, export ciphers)
- [ ] Test for **POODLE** vulnerability (SSLv3 fallback)
- [ ] Test for **BEAST** vulnerability (TLS 1.0 CBC mode)
- [ ] Test for **CRIME/BREACH** vulnerability (TLS compression)
- [ ] Test for **Heartbleed** vulnerability (OpenSSL heartbeat)
- [ ] Check for **HSTS** header presence and max-age configuration
- [ ] Test for **certificate validity**, chain, and expiration
- [ ] Check for **wildcard certificate** scope and potential abuse
- [ ] Test for **mixed content** on HTTPS pages (HTTP resources)
- [ ] Test for **insecure cookies** transmitted over HTTP
- [ ] Check for proper **certificate revocation** (CRL/OCSP stapling)
- [ ] Test for **TLS certificate pinning** implementation
- [ ] Check for **forward secrecy** (ECDHE/DHE cipher suites)
- [ ] Test for **Sweet32** vulnerability (64-bit block ciphers)
- [ ] Check for **certificate transparency** (CT) log inclusion
- [ ] Test for **TLS downgrade** attacks via version negotiation
- [ ] Test for **renegotiation attacks** (prefix injection)
- [ ] Check for **secure renegotiation** support (RFC 5746)
- [ ] Test for **TLS compression** attacks (CRIME variant)

## 28. Cryptographic Implementation (15 checks)

- [ ] Test for **weak hashing algorithms** (MD5, SHA1) for passwords
- [ ] Test for **weak encryption algorithms** (DES, RC4, ECB mode)
- [ ] Check for **hardcoded encryption keys** in source code
- [ ] Test for **key management** security (storage, rotation, access)
- [ ] Test for **IV reuse** in CBC mode encryption
- [ ] Check for **padding oracle** vulnerability in decryption
- [ ] Test for **ECB mode** detection via identical ciphertext blocks
- [ ] Test for **cryptographic key derivation** weakness (low iterations)
- [ ] Check for **random number generator** weakness (predictable seeds)
- [ ] Test for **cryptographic timing attacks** on comparison functions
- [ ] Check for **certificate pinning bypass** techniques
- [ ] Test for **weak password hashing** (no salt, fast algorithms)
- [ ] Check for proper use of **bcrypt/scrypt/Argon2** for passwords
- [ ] Check for **JWT algorithm confusion** (RS256 to HS256)
- [ ] Test for **cryptographic key exposure** in source code

## 29. HTTP Request Smuggling (10 checks)

- [ ] Test for **CL.TE** request smuggling (Content-Length vs Transfer-Encoding)
- [ ] Test for **TE.CL** request smuggling between frontend and backend
- [ ] Test for **TE.TE** request smuggling with header obfuscation
- [ ] Test for **H2.CL** request smuggling (HTTP/2 downgrade)
- [ ] Test for **H2.TE** request smuggling (HTTP/2 to HTTP/1.1)
- [ ] Test via **header manipulation** techniques
- [ ] Test between **proxy and backend server**
- [ ] Test in **load balancer** scenarios
- [ ] Test to **bypass WAF** inspection
- [ ] Test to **poison web cache**

## 30. Web Cache Poisoning & Deception (10 checks)

- [ ] Test via **unkeyed headers**
- [ ] Test via **unkeyed cookies**
- [ ] Test via **unkeyed query parameters**
- [ ] Test with **path parameter tricks**
- [ ] Test via **normalization differences**
- [ ] Test via **HTTP method override** technique
- [ ] Test via **Vary header** manipulation
- [ ] Test with **fat GET requests**
- [ ] Test with **file extension trickery**
- [ ] Test via **response header injection**

## 31. Server Misconfiguration (20 checks)

- [ ] Check for **default credentials** on server services and admin panels
- [ ] Check for **unnecessary services** running on the server
- [ ] Check for **directory listing** enabled on web directories
- [ ] Check for **server version disclosure** in HTTP headers
- [ ] Check for **stack trace disclosure** in error pages
- [ ] Check for **debug mode** enabled in production environment
- [ ] Test for **HTTP methods beyond GET/POST** (PUT, DELETE, OPTIONS, TRACE)
- [ ] Check for **TRACE method** enabling Cross-Site Tracing attacks
- [ ] Test for **OPTIONS method** information disclosure
- [ ] Check for **open redirect** vulnerabilities in URL parameters
- [ ] Test for **host header injection** in virtual hosting
- [ ] Test for **X-Forwarded-Host header** injection for cache poisoning
- [ ] Check for **proxy misconfiguration** allowing request smuggling
- [ ] Check for **improper error handling** revealing internal info
- [ ] Test for **server-side JavaScript injection** (Node.js specific)
- [ ] Check for **information disclosure** via verbose error messages
- [ ] Test for **HTTP header injection** via CRLF sequences
- [ ] Check for **CRLF injection** in HTTP response headers
- [ ] Test for **HTTP response splitting** attacks

## 32. Cloud & Container Security (15 checks)

- [ ] Test for **AWS S3 bucket** misconfiguration allowing public access
- [ ] Test for **AWS metadata endpoint** access via SSRF (169.254.169.254)
- [ ] Test for **Azure metadata endpoint** access via SSRF
- [ ] Test for **GCP metadata endpoint** access via SSRF
- [ ] Check for **exposed Docker API** on port 2375/2376 without auth
- [ ] Check for **exposed Kubernetes API** on port 6443/8443
- [ ] Test for **container escape** vulnerabilities (CVE checks)
- [ ] Check for **cloud storage public access** (Azure Blob, GCP GCS)
- [ ] Test for **cloud IAM** misconfiguration and privilege escalation
- [ ] Check for **cloud function exposure** (AWS Lambda, GCF, Azure Functions)
- [ ] Test for **cloud database public access** without authentication
- [ ] Check for **cloud queue service** exposure (SQS, Pub/Sub)
- [ ] Test for **etcd unauthorized access** on port 2379
- [ ] Check for **Kubernetes dashboard** exposure without auth
- [ ] Test for **cloud CDN** misconfiguration allowing cache manipulation

## 33. Data Exposure (20 checks)

- [ ] Check for sensitive data in **page source code** and HTML comments
- [ ] Check for sensitive data in **JavaScript files** and source maps
- [ ] Check for **API keys and secrets** in client-side code
- [ ] Check for sensitive data in **HTML meta tags** and attributes
- [ ] Check for sensitive data in **error messages** and stack traces
- [ ] Check for sensitive data in **debug and status** endpoints
- [ ] Check for sensitive data in **robots.txt** and sitemap.xml
- [ ] Check for sensitive data in **.env files** and configuration
- [ ] Check for sensitive data in **backup files** and archives
- [ ] Check for sensitive data in **version control directories** (.git)
- [ ] Check for sensitive data in **log files** on the server
- [ ] Check for sensitive data in **HTTP response headers**
- [ ] Check for sensitive data in **cookies** without Secure/HttpOnly flags
- [ ] Check for sensitive data in **localStorage/sessionStorage**
- [ ] Check for sensitive data in **IndexedDB** storage
- [ ] Check for **email/PII exposure** in API responses
- [ ] Check for **excessive data** returned in API responses
- [ ] Check for sensitive data in **URL parameters** (GET method)
- [ ] Check for sensitive data in **browser autocomplete** fields
- [ ] Check for sensitive data in **referrer header** to external sites

## 34. Google Dorking & OSINT (49 checks)

- [ ] site:target.com filetype:pdf
- [ ] site:target.com filetype:xlsx
- [ ] site:target.com filetype:docx
- [ ] site:target.com filetype:txt
- [ ] site:target.com filetype:log
- [ ] site:target.com filetype:sql
- [ ] site:target.com filetype:env
- [ ] site:target.com filetype:yml
- [ ] site:target.com filetype:json
- [ ] site:target.com filetype:xml
- [ ] site:target.com filetype:bk
- [ ] site:target.com intitle:"index of"
- [ ] site:target.com intitle:"dashboard"
- [ ] site:target.com intitle:"admin"
- [ ] site:target.com intitle:"login"
- [ ] site:target.com inurl:admin
- [ ] site:target.com inurl:login
- [ ] site:target.com inurl:dashboard
- [ ] site:target.com inurl:config
- [ ] site:target.com inurl:api
- [ ] site:target.com inurl:upload
- [ ] site:target.com inurl:debug
- [ ] site:target.com inurl:test
- [ ] site:target.com inurl:staging
- [ ] site:target.com inurl:dev
- [ ] site:target.com inurl:.git
- [ ] site:target.com inurl:.env
- [ ] site:target.com inurl:wp-admin
- [ ] site:target.com inurl:phpmyadmin
- [ ] site:target.com inurl:swagger
- [ ] site:target.com inurl:graphql
- [ ] site:target.com intext:"password"
- [ ] site:target.com intext:"api key"
- [ ] site:target.com intext:"secret"
- [ ] site:target.com intext:"token"
- [ ] site:target.com cache:
- [ ] site:target.com "error" "sql"
- [ ] site:pastebin.com target.com
- [ ] site:github.com target.com password
- [ ] site:github.com target.com api_key
- [ ] site:github.com target.com secret
- [ ] site:github.com target.com token
- [ ] site:gist.github.com target.com
- [ ] site:stackoverflow.com target.com
- [ ] site:trello.com target.com
- [ ] site:slack.com target.com
- [ ] site:notion.so target.com

## 35. JavaScript Analysis (50 checks)

- [ ] Analyze for **hardcoded API endpoints**
- [ ] Analyze for **hardcoded API keys**
- [ ] Analyze for **hardcoded secrets and tokens**
- [ ] Analyze for **hidden feature flags**
- [ ] Analyze for **admin panel routes**
- [ ] Analyze for **debug mode toggles**
- [ ] Analyze for **internal IP addresses**
- [ ] Analyze for **database connection strings**
- [ ] Analyze for **encryption keys**
- [ ] Analyze for **OAuth client secrets**
- [ ] Analyze for **AWS credentials**
- [ ] Analyze for **Firebase configuration**
- [ ] Analyze for **Stripe/Payment API keys**
- [ ] Analyze for **Google Maps API keys**
- [ ] Analyze for **SendGrid/Mailgun API keys**
- [ ] Analyze for **Twilio API credentials**
- [ ] Analyze for **Slack webhook URLs**
- [ ] Analyze for **hidden WebSocket endpoints**
- [ ] Analyze for **unused/debug API routes**
- [ ] Analyze for **source map references**
- [ ] Analyze for **JWT token handling logic**
- [ ] Analyze for **localStorage** usage with sensitive data
- [ ] Analyze for **sessionStorage** usage with sensitive data
- [ ] Analyze for **IndexedDB** usage with sensitive data
- [ ] Analyze for insecure **postMessage handlers**
- [ ] Analyze for **eval()** usage with user input
- [ ] Analyze for **innerHTML** usage with unsanitized input
- [ ] Analyze for **document.write()** with user input
- [ ] Analyze for **dangerouslySetInnerHTML** (React)
- [ ] Analyze for **v-html** usage (Vue.js)
- [ ] Analyze for **AngularJS expression injection**
- [ ] Analyze for **prototype pollution** vectors
- [ ] Analyze for **DOM clobbering** possibilities
- [ ] Analyze for **open redirect** via window.location
- [ ] Analyze for **CORS misconfiguration** in fetch calls
- [ ] Analyze for **service worker registration** and scope
- [ ] Analyze for **web worker message handling** security
- [ ] Analyze for **notification API abuse** potential
- [ ] Analyze for **geolocation API data leakage**
- [ ] Analyze for **camera/microphone permission abuse**
- [ ] Analyze for **clipboard API data exfiltration**
- [ ] Analyze for **Content-Security-Policy bypass** vectors
- [ ] Analyze for **third-party script inclusion** risks

## 36. Email Security Testing (25 checks)

- [ ] Check **SPF record** existence and configuration (v=spf1)
- [ ] Check SPF for **overly permissive include** (~all vs -all)
- [ ] Check SPF for **DNS lookup limit exceeded** (max 10)
- [ ] Check **DKIM record** existence and key strength
- [ ] Check **DKIM key length** (should be 2048+ bits)
- [ ] Check **DMARC record** existence and policy (p=reject/quarantine/none)
- [ ] Check **DMARC rua tag** for aggregate report destination
- [ ] Check **DMARC ruf tag** for forensic report destination
- [ ] Check **DMARC policy enforcement** percentage (pct=100)
- [ ] Test for **email spoofing** via missing DMARC policy
- [ ] Test for email spoofing via **relaxed DMARC alignment** (r vs s)
- [ ] Check for **email header injection** in contact forms
- [ ] Test for **CRLF injection** in email header fields
- [ ] Test for **MIME injection** in email content
- [ ] Test for **email content XSS** in webmail clients
- [ ] Check for **open SMTP relay** on target mail servers
- [ ] Test for **SMTP user enumeration** via VRFY/EXPN commands
- [ ] Check for **email DSN (Delivery Status Notification)** leakage
- [ ] Test for **email bomb** via mass subscription
- [ ] Check for **CAA (Certification Authority Authorization)** DNS record

## 37. DNS Security Testing (20 checks)

- [ ] Check for **DNS zone transfer** vulnerability (AXFR)
- [ ] Check for **DNSSEC** implementation and validation
- [ ] Check for **DNS over HTTPS (DoH)** configuration
- [ ] Check for **DNS over TLS (DoT)** configuration
- [ ] Test for **DNS cache poisoning** vulnerability
- [ ] Check for **DNS rebinding** attack possibility
- [ ] Check for **CNAME flattening** security implications
- [ ] Check for **DNS TXT record** information disclosure
- [ ] Check for **DNS SRV record** enumeration
- [ ] Check for **DNS PTR record** reverse lookup information
- [ ] Test for **DNS amplification** attack vulnerability
- [ ] Check for **open DNS resolver** on target nameservers
- [ ] Check for **wildcard DNS record** security implications

## 38. WAF Bypass Techniques (25 checks)

- [ ] Test bypass with **URL encoding** of payloads
- [ ] Test bypass with **double URL encoding**
- [ ] Test bypass with **Unicode/HTML entity encoding**
- [ ] Test bypass with **base64 encoded payloads**
- [ ] Test bypass with **chunked transfer encoding**
- [ ] Test bypass with **content-type switching**
- [ ] Test bypass with **HTTP parameter pollution**
- [ ] Test bypass with **null byte injection** in payloads
- [ ] Test bypass with **SQL comment injection** (/*!*/)
- [ ] Test bypass with **case variation** in keywords
- [ ] Test bypass with **HTTP header manipulation**
- [ ] Test bypass with **request method variation**
- [ ] Test bypass with **path normalization tricks**
- [ ] Test bypass with **IP spoofing** via X-Forwarded-For
- [ ] Test bypass with **slow HTTP attacks** (slowloris)
- [ ] Test bypass with **fragmented payloads** across parameters
- [ ] Test bypass with **GraphQL query obfuscation**

## 39. Prototype Pollution (20 checks)

- [ ] Test via **__proto__**
- [ ] Test via **constructor.prototype**
- [ ] Test via **Object.assign**
- [ ] Test via **JSON body parsing**
- [ ] Test via **query string parsing**
- [ ] Test via **deep merge functions**
- [ ] Test in **lodash _.merge**
- [ ] Test in **lodash _.defaultsDeep**
- [ ] Test in **jQuery.extend** (deep)
- [ ] Test for **server-side prototype pollution** in Node.js
- [ ] Test for **prototype pollution to XSS** via src override
- [ ] Test for **prototype pollution to XSS** via innerHTML override
- [ ] Test for **prototype pollution for privilege escalation**
- [ ] Test for **prototype pollution for CSRF token bypass**
- [ ] Test for **prototype pollution for RCE** via child_process

## 40. Open Redirect (15 checks)

- [ ] Test in **URL redirect parameters** (?url=, ?redirect=)
- [ ] Test with **protocol-relative URLs** (//evil.com)
- [ ] Test with **URL encoding bypass**
- [ ] Test with **URL fragment tricks** (#)
- [ ] Test with **@ symbol in URL**
- [ ] Test with **data: URI scheme**
- [ ] Test with **javascript: URI scheme**
- [ ] Test via **Host header manipulation**
- [ ] Test via **X-Forwarded-Host header**
- [ ] Test in **OAuth redirect_uri** parameter
- [ ] Test in **SAML RelayState** parameter
- [ ] Test in **Next/Continue parameter** after login

## 41. JWT Security Deep Testing (20 checks)

- [ ] Test for **none/None/NONE algorithm** bypass
- [ ] Test for **algorithm confusion** RS256 to HS256
- [ ] Test for **JWK injection** via jwk header
- [ ] Test for **JKU header** pointing to attacker-controlled JWK
- [ ] Test for **X5U header** pointing to attacker certificate
- [ ] Test for **kid parameter** path traversal
- [ ] Test for **kid parameter** SQL injection
- [ ] Test for **kid parameter** command injection
- [ ] Test for **empty signature** bypass
- [ ] Test for **signature truncation** attack
- [ ] Test for **claim manipulation** without verification
- [ ] Test **exp claim** bypass with negative values
- [ ] Test **nbf claim** manipulation
- [ ] Test **audience (aud) claim** bypass
- [ ] Test **issuer (iss) claim** spoofing
- [ ] Test **subject (sub) claim** swapping
- [ ] Test **JTI claim** collision and replay

# API Security

## 1. API Authentication & Authorization (25 checks)

- [ ] Test for **broken authentication** in all API endpoints
- [ ] Check for **API key exposure** in client-side JavaScript code
- [ ] Test for **API key in URL parameters** instead of headers
- [ ] Test for **bearer token security** and proper validation
- [ ] Test for **OAuth 2.0 token security** in API authentication
- [ ] Test for **API rate limiting** and throttling implementation
- [ ] Check for **proper HTTP methods** on all API endpoints
- [ ] Test for **API versioning security** (/v1/ vs /v2/ access control)
- [ ] Test for **mass assignment** in API endpoint parameters
- [ ] Check for **proper input validation** in API requests
- [ ] Test for **excessive data exposure** in API responses
- [ ] Test for **API parameter tampering** and manipulation
- [ ] Check for **API endpoint enumeration** via directory brute force
- [ ] Test for **API documentation exposure** (Swagger, OpenAPI spec)
- [ ] Test for **GraphQL API introspection** query access
- [ ] Test for **REST API verb tampering** (method override)
- [ ] Check for **API CORS configuration** and origin validation
- [ ] Test for **API pagination security** and data leakage
- [ ] Test for **API key rotation** and revocation mechanism
- [ ] Check for **API token expiration** and refresh flow
- [ ] Test for **API scope limitation** and permission boundaries
- [ ] Check for **API gateway authentication** bypass
- [ ] Test for **API key in referrer header** leakage

## 2. API Injection & Manipulation (15 checks)

- [ ] Test for **SQL injection** in API query and body parameters
- [ ] Test for **NoSQL injection** in API JSON request body
- [ ] Test for **command injection** via API parameters
- [ ] Test for **SSRF** via API URL parameters and webhook URLs
- [ ] Test for **IDOR** in API resource identifiers and references
- [ ] Test for **parameter pollution** in API requests
- [ ] Test for **API batch endpoint abuse** for bulk operations
- [ ] Test for **API rate limit bypass** via header manipulation
- [ ] Test for **API rate limit bypass** via IP rotation
- [ ] Test for **API request smuggling** between gateway and backend
- [ ] Test for **API response manipulation** and data injection
- [ ] Test for **API content-type switching** attacks
- [ ] Test for **API compression bomb** attacks (zip bombs)
- [ ] Test for **API timeout exploitation** for resource exhaustion
- [ ] Test for **API error message** information disclosure

## 3. SOAP & XML API (10 checks)

- [ ] Test for **SOAP action manipulation** and injection
- [ ] Test for **SOAP XML injection** in message body
- [ ] Test for **XXE** in SOAP XML requests and responses
- [ ] Test for **SOAP WSDL disclosure** and service enumeration
- [ ] Test for **SOAP message security** (WS-Security implementation)
- [ ] Test for **SOAP replay attacks** on stateful operations
- [ ] Check for **SOAP fault information** disclosure details
- [ ] Test for **SOAP attachment handling** security

## 4. gRPC API (10 checks)

- [ ] Test for **gRPC reflection service** exposure and enumeration
- [ ] Test for **gRPC unauthenticated access** to services
- [ ] Test for **gRPC message serialization** attacks (protobuf)
- [ ] Test for **gRPC connection hijacking** between client and server
- [ ] Check for **gRPC metadata security** and sensitive header exposure
- [ ] Test for **gRPC stream abuse** for denial of service
- [ ] Test for **gRPC TLS configuration** and encryption enforcement
- [ ] Check for **gRPC service enumeration** via reflection API

## 5. API Rate Limiting & Throttling (20 checks)

- [ ] Test for **missing rate limiting** on authentication endpoints
- [ ] Test for **missing rate limiting** on password reset
- [ ] Test for **missing rate limiting** on registration
- [ ] Test for **missing rate limiting** on 2FA verification
- [ ] Test for **rate limit bypass** via X-Forwarded-For header
- [ ] Test for **rate limit bypass** via IP rotation
- [ ] Test for **rate limit bypass** via different API versions
- [ ] Test for **rate limit bypass** via HTTP method variation
- [ ] Test for **rate limit bypass** via API key rotation
- [ ] Test for **rate limit bypass** via distributed requests
- [ ] Test for **rate limit bypass** via IPv6 addresses
- [ ] Test for **rate limit bypass** via different User-Agent
- [ ] Test for **rate limit bypass** via case variation in paths
- [ ] Test for **rate limit bypass** via URL encoding tricks

## 6. API Data Exposure & BOLA (20 checks)

- [ ] Test for **Broken Object Level Authorization (BOLA)** in API
- [ ] Test for **excessive data exposure** in API response objects
- [ ] Test for **mass assignment** via API JSON body parameters
- [ ] Test for API response containing **unnecessary PII data**
- [ ] Test for API response with **internal IDs and references**
- [ ] Test for API response with **other users data leakage**
- [ ] Test for **API field filtering bypass** (fields parameter)
- [ ] Test for **API expand/embed parameter** for data access
- [ ] Test for **API sort parameter** for data enumeration
- [ ] Test for **API filter parameter** for data extraction
- [ ] Test for **API search parameter** for information disclosure
- [ ] Test for **API pagination bypass** for complete data extraction
- [ ] Test for **API cursor pagination** manipulation
- [ ] Test for **API offset/limit pagination** for data access

## 7. Webhook Security (10 checks)

- [ ] Test for **SSRF** via webhook URL configuration
- [ ] Test for **webhook signature verification** bypass
- [ ] Test for **webhook replay attack** prevention
- [ ] Test for **webhook URL validation** and restrictions
- [ ] Test for **webhook secret exposure** in API response
- [ ] Test for **webhook delivery to internal network**
- [ ] Test for **webhook timing attack** on signature verification
- [ ] Test for **webhook URL redirect** following behavior

## 8. API Key & Token Security (15 checks)

- [ ] Test for **API key in URL query string** exposure
- [ ] Test for **API key in HTTP Referer header** leakage
- [ ] Test for **API key in server logs** and access logs
- [ ] Test for **API key without expiration** or rotation mechanism
- [ ] Test for **API key with excessive permissions**
- [ ] Test for **API key sharing** between multiple applications
- [ ] Test for **API key regeneration** and revocation process
- [ ] Test for **API key storage security** (encryption at rest)
- [ ] Test for **bearer token without expiration**
- [ ] Test for **refresh token rotation** and security
- [ ] Test for **token binding** implementation (DPoP, mTLS)
- [ ] Test for **token scope limitation** and enforcement
- [ ] Test for **token revocation** on logout and password change

## 9. API Content-Type & Encoding (10 checks)

- [ ] Test for **content-type switching** attack (JSON to XML)
- [ ] Test for **content-type switching** attack (JSON to form-data)
- [ ] Test for **API response content negotiation** manipulation
- [ ] Test for **API compression bomb** (gzip decompression bomb)
- [ ] Test for **API XML content-type** XXE injection
- [ ] Test for **API YAML content-type** deserialization
- [ ] Test for **API Protocol Buffers (protobuf)** security
- [ ] Test for **API multipart content-type** boundary injection

# Android Security

## 1. Static Analysis (41 checks)

- [ ] Decompile APK with **jadx** for Java source code review
- [ ] Decompile APK with **apktool** for resource and manifest analysis
- [ ] Check **AndroidManifest.xml** for exported components without permission
- [ ] Check for **exported activities** accessible by other apps
- [ ] Check for **exported services** accessible by other apps
- [ ] Check for **exported content providers** with data access
- [ ] Check for **exported broadcast receivers** for intent injection
- [ ] Check for **debuggable flag** (android:debuggable=true) in manifest
- [ ] Check for **allowBackup flag** (android:allowBackup=true) in manifest
- [ ] Check for **network security config** (cleartext traffic allowed)
- [ ] Analyze **permissions requested** by the application
- [ ] Check for **dangerous permissions** usage without justification
- [ ] Look for **hardcoded secrets** in source code (API keys, tokens)
- [ ] Analyze **third-party SDKs** and libraries for known vulnerabilities
- [ ] Analyze **ProGuard/R8 obfuscation** effectiveness in decompiled code
- [ ] Analyze **WebView configuration** and security settings
- [ ] Check for **JavaScript enabled** in WebView
- [ ] Check for **addJavascriptInterface** usage in WebView (RCE risk)
- [ ] Check for **setAllowFileAccess** in WebView (local file access)
- [ ] Analyze **network communication** for HTTP (cleartext) usage
- [ ] Check for **certificate pinning** implementation in network calls
- [ ] Analyze **custom TrustManager** implementations (SSL bypass risk)
- [ ] Check for **SSL error handler bypass** (onReceivedSslError)
- [ ] Check for **PendingIntent** security and privilege escalation risk
- [ ] Analyze **notification security** for sensitive data exposure
- [ ] Look for **sensitive data in logging** (Log.d, Log.v, Log.i calls)

## 2. Dynamic Analysis (30 checks)

- [ ] Use **Frida** for runtime hooking and function analysis
- [ ] Use **Xposed framework** for runtime method modification
- [ ] Hook **SSL pinning bypass** with Frida/Objection scripts
- [ ] Hook **root detection bypass** with Frida/Objection scripts
- [ ] Monitor **network traffic** with Burp Suite proxy interception
- [ ] Use **Drozer** for Android component testing and enumeration
- [ ] Test **exported activities** with Drozer activity launch
- [ ] Test **content provider queries** with Drozer provider scan
- [ ] Test **broadcast receiver injection** with Drozer broadcast
- [ ] Test **deep link hijacking** from malicious application
- [ ] Test **task affinity attacks** for activity hijacking
- [ ] Test for **tapjacking** vulnerability with overlay app
- [ ] Test for **intent redirection attacks** to internal components
- [ ] Monitor **file system changes** during app usage
- [ ] Check **SharedPreferences file permissions** on device
- [ ] Check **database file permissions** on device storage
- [ ] Monitor **IPC communication** between app components
- [ ] Analyze **Keystore/Keychain** usage for key storage security
- [ ] Test **biometric authentication bypass** with Frida hooking
- [ ] Test for **screenshot prevention** on sensitive screens
- [ ] Monitor **memory for sensitive data** exposure with Frida

## 3. Data Storage (15 checks)

- [ ] Check **SharedPrefs** for plaintext credential and token storage
- [ ] Check **SQLite databases** for sensitive data in plaintext
- [ ] Check **internal storage** file permissions (world-readable)
- [ ] Check **external storage** for sensitive data (world-readable)
- [ ] Check for sensitive data in **cache directories**
- [ ] Test for **backup extraction** via adb backup command
- [ ] Check for **auto backup to Google Drive** with sensitive data
- [ ] Test for **data leakage** through content providers
- [ ] Check for sensitive data in **logcat output** on device
- [ ] Test for **secure deletion** of sensitive data on logout
- [ ] Check for **data encryption at rest** using Android Keystore
- [ ] Test for **data leakage** through clipboard copy operations
- [ ] Check for sensitive data in **intent extras**
- [ ] Test for **data persistence** after user logout

## 4. Network Communication (15 checks)

- [ ] Test for **cleartext traffic (HTTP)** usage in network calls
- [ ] Check for **certificate pinning** implementation and bypass
- [ ] Test for **SSL/TLS version** and cipher suite security
- [ ] Check for **custom TrustManager** implementation vulnerabilities
- [ ] Test for **hostname verifier bypass** in SSL connections
- [ ] Check for **WebView SSL error handler** bypass vulnerability
- [ ] Test for **network security config** enforcement on Android 7+
- [ ] Check for **API communication** over HTTPS only
- [ ] Test for **sensitive data** in network request parameters
- [ ] Check for **WebSocket security** (wss vs ws protocol)

## 5. Reverse Engineering Protection (15 checks)

- [ ] Test for **root detection** implementation and bypass methods
- [ ] Test for **emulator detection** implementation and bypass
- [ ] Test for **Frida detection** implementation and bypass
- [ ] Test for **Xposed detection** implementation and bypass
- [ ] Test for **debugging detection** (android:debuggable check)
- [ ] Check for **code obfuscation effectiveness** in decompiled output
- [ ] Test for **repackaging detection** and signature verification
- [ ] Check for **tamper detection** mechanisms in the application
- [ ] Test for **runtime integrity checks** in application code
- [ ] Check for **string encryption** in decompiled source code
- [ ] Test for **dynamic code loading** security (DexClassLoader)

## 6. IPC Security (15 checks)

- [ ] Test for **intent injection attacks** on exported components
- [ ] Test for **intent redirection attacks** to internal activities
- [ ] Test for **PendingIntent privilege escalation** attacks
- [ ] Test for **broadcast receiver abuse** and message injection
- [ ] Test for **content provider SQL injection** via crafted queries
- [ ] Test for **content provider path traversal** via crafted URIs
- [ ] Test for **AIDL interface** security and access control
- [ ] Check for **implicit intent hijacking** by malicious apps
- [ ] Test for **activity hijacking** via taskAffinity manipulation
- [ ] Test for **task hijacking (Strandhogg)** vulnerability
- [ ] Test for **service binding abuse** by external applications

## 7. Android Firebase & Cloud (15 checks)

- [ ] Test for **Firebase Realtime Database** without authentication rules
- [ ] Test for **Firebase Firestore** without security rules
- [ ] Test for **Firebase Storage** without access control rules
- [ ] Test for **Firebase Cloud Messaging** security
- [ ] Test for **Firebase Authentication** configuration security
- [ ] Test for **Firebase Remote Config** manipulation
- [ ] Test for **Firebase Crashlytics** sensitive data in reports
- [ ] Test for **Firebase Cloud Functions** unauthorized access
- [ ] Test for **google-services.json** exposure and abuse
- [ ] Test for **Firebase database URL** guessing

# iOS Security

## 1. Static Analysis (30 checks)

- [ ] Decompile IPA with **class-dump** for Objective-C header analysis
- [ ] Use **Hopper/IDA** for disassembly and control flow analysis
- [ ] Check **Info.plist** for sensitive configuration and URL schemes
- [ ] Check for **ATS (App Transport Security)** exceptions and bypasses
- [ ] Analyze **URL schemes and deep links** for hijacking potential
- [ ] Check for **hardcoded secrets** in binary strings
- [ ] Analyze **encryption key management** and storage
- [ ] Check for **debug symbols** in binary (stripped or not)
- [ ] Check for **NSLog/NSAssert** statements with sensitive data output
- [ ] Analyze **third-party frameworks and libraries** for vulnerabilities
- [ ] Check for **insecure data storage** in Documents/Library directories
- [ ] Analyze **CoreData model** for sensitive entity attributes
- [ ] Analyze **entitlements** for dangerous permissions and capabilities
- [ ] Check for **background modes security** (location, audio, VOIP)
- [ ] Analyze **app extensions security** (share, today, keyboard)
- [ ] Check for **universal links configuration**
- [ ] Analyze **WKWebView configuration** and security settings
- [ ] Check for **JavaScript enabled** in WKWebView
- [ ] Analyze **Keychain access groups** and sharing between apps
- [ ] Check for **pasteboard (clipboard)** usage with sensitive data
- [ ] Look for **format string vulnerabilities** in NSLog/printf calls
- [ ] Check for **stack buffer overflow** possibilities in C/C++ code
- [ ] Analyze **Objective-C runtime manipulation** potential
- [ ] Check for **app group container** security

## 2. Dynamic Analysis (20 checks)

- [ ] Use **Frida** for runtime hooking on jailbroken iOS device
- [ ] Use **Objection** for runtime exploration and data access
- [ ] Use **Cycript** for runtime manipulation on jailbroken device
- [ ] Use **LLDB** for debugging and memory analysis
- [ ] Hook **SSL pinning bypass** with Frida/Objection scripts
- [ ] Hook **jailbreak detection bypass** with Frida/Objection scripts
- [ ] Monitor **network traffic** with Burp Suite proxy
- [ ] Test for **Touch ID/Face ID bypass** via Frida hooking
- [ ] Monitor **Keychain access** with Keychain dumper tool
- [ ] Test for **pasteboard data leakage** between apps
- [ ] Monitor **UserDefaults** for sensitive data storage
- [ ] Test for **screenshot prevention** on sensitive screens
- [ ] Test for **app backgrounding behavior** and data exposure
- [ ] Monitor **IPC between app and extensions**
- [ ] Test for **URL scheme hijacking** from malicious app

## 3. Data Storage (15 checks)

- [ ] Check **Keychain** for insecure data storage
- [ ] Check **UserDefaults** for sensitive data (credentials, tokens)
- [ ] Check **CoreData database** for sensitive data in plaintext
- [ ] Check **SQLite databases** for sensitive data without encryption
- [ ] Check for **plaintext credentials** in plist files
- [ ] Check for sensitive data in **cache directories**
- [ ] Check for sensitive data in **tmp directories**
- [ ] Test for **backup inclusion** of sensitive data (iTunes/Finder)
- [ ] Check for **iCloud backup** of sensitive app data
- [ ] Test for **secure deletion** of temporary files on logout
- [ ] Check for **data encryption at rest** using iOS Data Protection
- [ ] Check for **keyboard cache leakage** of sensitive input
- [ ] Test for **pasteboard data leakage** between applications

## 4. Network Communication (10 checks)

- [ ] Test for **cleartext HTTP traffic** (ATS bypass or exception)
- [ ] Check for **certificate pinning** implementation and bypass
- [ ] Test for **SSL/TLS version** and cipher suite security
- [ ] Check for **custom certificate validation** bypass vulnerability
- [ ] Test for **ATS exception domains** security and justification
- [ ] Check for **API communication** security (HTTPS, token handling)
- [ ] Test for **WebSocket security** (wss vs ws protocol)

## 5. Cryptography (10 checks)

- [ ] Check for **weak encryption algorithms** (DES, RC4, ECB mode)
- [ ] Check for **hardcoded encryption keys** in binary
- [ ] Test for **proper key derivation** (PBKDF2, Argon2)
- [ ] Check for **IV/nonce reuse** in encryption operations
- [ ] Test for **insecure random number generation**
- [ ] Check for **proper key storage** in Keychain with access control
- [ ] Test for **timing attacks** in cryptographic comparison operations
- [ ] Check for **Secure Enclave** usage for key operations

## 6. Jailbreak Detection (10 checks)

- [ ] Test for **jailbreak detection** implementation and effectiveness
- [ ] Test for **jailbreak detection bypass** methods via Frida
- [ ] Check for **file-based jailbreak detection** (/Applications/Cydia.app)
- [ ] Check for **URL scheme-based jailbreak detection** (cydia://)
- [ ] Test for **dylib injection detection**
- [ ] Check for **code signing verification** and integrity
- [ ] Test for **runtime integrity checks** and method swizzling detection
- [ ] Check for **anti-debugging mechanisms** (sysctl P_TRACED check)

# Thick Client Security

## 1. Static Analysis (20 checks)

- [ ] Decompile **.NET applications** with dnSpy/ILSpy for source review
- [ ] Decompile **Java applications** with JD-GUI/CFR for source review
- [ ] Analyze **Electron apps** with asar extraction and source review
- [ ] Check for **hardcoded credentials** in binary and config files
- [ ] Check for **hardcoded encryption keys** in decompiled source
- [ ] Analyze **configuration files** for sensitive data exposure
- [ ] Check for **debug builds** distributed in production
- [ ] Check for **insecure file permissions** on installation
- [ ] Analyze **Windows registry entries** for sensitive data storage
- [ ] Analyze **SQLite databases** for sensitive data without encryption
- [ ] Check for **temporary file handling** security
- [ ] Analyze **logging** for sensitive data disclosure

## 2. Dynamic Analysis (20 checks)

- [ ] Monitor **network traffic** with Wireshark and Burp Suite
- [ ] Intercept and **modify network requests** in transit
- [ ] Monitor **file system access** with Process Monitor
- [ ] Monitor **registry access** with Process Monitor
- [ ] Monitor **process creation** with Process Monitor
- [ ] Use **Frida** for runtime hooking and function modification
- [ ] Use **Cheat Engine** for memory analysis and value modification
- [ ] Test for **DLL injection** vulnerabilities in the application
- [ ] Test for **DLL hijacking/side-loading** with malicious DLLs
- [ ] Test for **process injection** and memory manipulation
- [ ] Monitor **memory for sensitive data** exposure
- [ ] Test for **local privilege escalation** via service manipulation
- [ ] Analyze **inter-process communication** security
- [ ] Test for **named pipe security** and access control
- [ ] Analyze **Windows service security** configuration

## 3. Binary Analysis (15 checks)

- [ ] Check for **ASLR** enabled
- [ ] Check for **DEP/NX** enabled
- [ ] Check for **stack canaries/cookies** in compiled binary
- [ ] Check for **Control Flow Guard (CFG)** on Windows
- [ ] Check for **SafeSEH**
- [ ] Analyze **buffer overflow** possibilities in input handling
- [ ] Test for **format string** vulnerabilities in printf-family calls
- [ ] Test for **integer overflow** vulnerabilities
- [ ] Check for **use-after-free** vulnerabilities
- [ ] Test for **race conditions** in file operations (TOCTOU)
- [ ] Check for **symbolic link following** vulnerabilities

## 4. Network Communication (15 checks)

- [ ] Test for **cleartext communication** over HTTP/TCP
- [ ] Check for **certificate validation** implementation and bypass
- [ ] Test for **certificate pinning** in thick client network calls
- [ ] Check for **SSL/TLS version** and cipher suite security
- [ ] Monitor **WebSocket communication** for sensitive data
- [ ] Check for **custom protocol** security and message integrity
- [ ] Test for **RMI/DCOM** security and access control
- [ ] Check for **database connection** security and encryption

## 5. Electron Application Security (15 checks)

- [ ] Check for **contextIsolation** enabled in BrowserWindow config
- [ ] Check for **nodeIntegration** enabled in BrowserWindow config
- [ ] Check for **sandbox mode** enabled in BrowserWindow config
- [ ] Test for **preload script** security and validation
- [ ] Test for **IPC message validation** between main and renderer
- [ ] Check for **remote module** usage (deprecated, insecure)
- [ ] Test for **shell.openExternal** injection for RCE
- [ ] Check for **webPreferences security** settings configuration
- [ ] Check for **auto-update security** (code signing verification)
- [ ] Check for **content security policy** in renderer process

## 6. Local Privilege Escalation (10 checks)

- [ ] Test for **DLL search order hijacking** in application directory
- [ ] Test for **unquoted service path** vulnerability on Windows
- [ ] Test for **weak service permissions** allowing modification
- [ ] Test for **registry key permissions** allowing elevation
- [ ] Check for **always-install-elevated** group policy
- [ ] Test for **token impersonation** and privilege manipulation
- [ ] Check for **SUID/SGID binaries** on Linux thick clients
- [ ] Test for **sudo misconfiguration** and NOPASSWD entries

# Tools & Resources Reference

## Reconnaissance Toolkit

| Tool | Purpose | Area |
|------|---------|------|
| **subfinder** | Passive subdomain enumeration | Web |
| **amass** | Deep subdomain discovery with OSINT | Web |
| **assetfinder** | Subdomain finding from data sources | Web |
| **Findomain** | Fast subdomain with CT logs | Web |
| **crt.sh** | Certificate transparency logs | Web |
| **SecurityTrails** | Historical DNS records | Web |
| **Shodan** | Subdomain & port discovery | Web |
| **Censys** | Certificate-based discovery | Web |
| **sublist3r** | Multi-engine subdomain search | Web |
| **massdns** | Fast DNS resolution | Web |
| **nmap** | Port scanning & service detection | Web |
| **masscan** | Ultra-fast port scanning | Web |
| **rustscan** | Fast port discovery + nmap | Web |
| **naabu** | Fast SYN/CONNECT port scan | Web |
| **ffuf** | Fast directory/file fuzzing | Web |
| **gobuster** | Directory/file brute forcing | Web |
| **dirsearch** | Recursive directory scanning | Web |
| **feroxbuster** | Recursive content discovery | Web |
| **katana** | Comprehensive web crawling | Web |
| **hakrawler** | Fast web crawling | Web |
| **waybackurls** | Historical URL discovery | Web |
| **gau** | URL fetching (AlienVault, Wayback) | Web |
| **paramspider** | Parameter discovery | Web |
| **arjun** | Hidden HTTP parameter discovery | Web |
| **LinkFinder** | Extract links from JS files | Web |
| **JSParser** | Extract API endpoints from JS | Web |
| **Wappalyzer** | Technology stack detection | Web |
| **whatweb** | Command-line fingerprinting | Web |
| **wafw00f** | WAF detection | Web |
| **Burp Suite** | Comprehensive web testing proxy | Web |

## Mobile Security Toolkit

| Tool | Purpose | Platform |
|------|---------|----------|
| **jadx** | APK decompilation to Java | Android |
| **apktool** | APK resource/manifest analysis | Android |
| **Frida** | Runtime hooking & analysis | Both |
| **Objection** | Runtime exploration | Both |
| **Xposed** | Runtime method modification | Android |
| **Drozer** | Android component testing | Android |
| **class-dump** | iOS header analysis | iOS |
| **Hopper** | iOS disassembly | iOS |
| **IDA** | Binary disassembly | Both |
| **Cycript** | iOS runtime manipulation | iOS |
| **LLDB** | iOS debugging | iOS |

## Thick Client Toolkit

| Tool | Purpose |
|------|---------|
| **dnSpy** | .NET decompilation |
| **ILSpy** | .NET decompilation |
| **JD-GUI** | Java decompilation |
| **CFR** | Java decompilation |
| **Process Monitor** | File/registry/process monitoring |
| **API Monitor** | API call analysis |
| **Cheat Engine** | Memory analysis |

## Deserialization Exploitation

| Tool | Purpose |
|------|---------|
| **ysoserial** | Java deserialization payloads |
| **PHPGGC** | PHP deserialization payloads |

## Methodology Flow

```
1. RECONNAISSANCE
   - Subdomain Enumeration, Port Scanning, Technology Fingerprinting, Content Discovery

2. MAPPING & DISCOVERY
   - Link & Parameter Discovery, JavaScript Analysis, Google Dorking, API Discovery

3. AUTHENTICATION TESTING
   - Password Attacks, Session Mgmt, OAuth/SSO, Login Bypass, JWT Security

4. AUTHORIZATION TESTING
   - IDOR, Privilege Escalation, API BOLA, CORS Misconfiguration

5. INPUT VALIDATION
   - SQLi, XSS, SSRF, SSTI, Command Injection, NoSQL, LDAP, XXE, Path Traversal

6. BUSINESS LOGIC
   - Payment Manipulation, Race Conditions, Workflow Bypass, Feature Flag Abuse

7. CLIENT-SIDE
   - CSRF, Clickjacking, PostMessage, Prototype Pollution, CRLF Injection

8. INFRASTRUCTURE
   - TLS/SSL, Crypto, Request Smuggling, Cache Poisoning, Cloud & Container

9. MOBILE (if applicable)
   - Static/Dynamic Analysis, Data Storage, Network, Reverse Engineering

10. THICK CLIENT (if applicable)
    - Binary Analysis, DLL/Services, LPE, Electron Security
```

> **IMPORTANT:** Use this checklist only with explicit authorization. Always follow responsible disclosure practices and comply with the target's bug bounty program rules.

---
*Generated from [checklist.hackwithsingh.com](https://checklist.hackwithsingh.com) - The Complete Security Testing Playbook*
