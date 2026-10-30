# CSP Bypass Playbook

## 1. Check CSP header
curl -sI https://target.com | grep -i content-security-policy

## 2. Analyze CSP directives
- script-src: 'self', 'unsafe-inline', 'unsafe-eval', nonce, hash
- If 'unsafe-inline' -> XSS bypasses CSP
- If 'self' -> look for JSONP endpoints or uploaded files
- If nonce -> check if nonce is predictable/reusable
- If hash -> check if hash is for user-controllable script

## 3. Bypass techniques
- JSONP callback injection
- File upload (upload JS, reference via <script src>)
- <base> tag hijack (if no base-uri)
- Angular sandbox escape (if Angular on page)
- <link rel=import> (deprecated but may work)
- DNS prefetch control
- <meta http-equiv=refresh>

## 4. CSP evaluator
- Use https://csp-evaluator.withgoogle.com/
