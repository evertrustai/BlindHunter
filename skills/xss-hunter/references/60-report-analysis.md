# XSS Report Analysis — 60 Real HackerOne Reports

## Key Findings

1. 70% of stored XSS came from markdown/rich text editors
2. 45% of reflected XSS came from search params
3. 30% of DOM XSS came from hash/fragment parameters
4. WAF bypass was needed in 25% of targets
5. Blind XSS via user-agent/headers: 15% of reports

## Top Payout Vectors
- Stored XSS via file upload (SVG/HTML): $2k-$10k
- Stored XSS in admin panels: $1k-$5k
- Blind XSS via email/log viewers: $500-$3k
- DOM XSS via postMessage: $500-$2k

## Common Filter Evasions
- Case mutation bypasses regex filters
- Unicode normalization bypasses WAF
- Polyglots bypass content-type checks
- Double encoding bypasses decode-once filters
