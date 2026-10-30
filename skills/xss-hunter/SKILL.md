# XSS-HUNTER: Multi-Agent XSS Hunting Skill

Trained on 60 real HackerOne XSS reports + 20 research articles + devspidr payloads + PayloadPlayground.

## 5-Phase Kill Chain

1. **Recon** — Subdomains → params → JS analysis → context detection
2. **Context Mapping** — HTML/Attribute/JS/Markdown context identification
3. **Payload Generation** — Context-aware payloads from 6600+ event handler combos
4. **Injection & Bypass** — WAF bypass, CSP bypass, filter evasion
5. **Verification** — Triple verification (alert, callback, DOM check)

## Multi-Agent Workflow

- **Agent 1: Recon** — subfinder, assetfinder, gau, httpx, katana, waybackurls
- **Agent 2: Context** — unfurl, subjs, jsluice, manual JS analysis
- **Agent 3: Payload** — Selects from 7 payload categories + polyglots
- **Agent 4: Bypass** — 25 WAF bypass techniques, CSP eval
- **Agent 5: Verify** — Blind XSS via xss.report/interactsh, triple check

## Zero False Positive Protocol

1. Payload must ALERT, CONSOLE.LOG, or CALLBACK
2. Verify in clean browser (no extensions)
3. Confirm via xss.report or interactsh callback

## Reports Referenced

60 real HackerOne XSS reports, 20 research articles, devspidr 6600+ event handler payloads.
