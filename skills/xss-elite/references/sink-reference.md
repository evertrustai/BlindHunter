# DOM Sink & Source Reference

## Dangerous Sinks (can execute attacker-controlled content)

| Sink | Example | Risk |
|------|---------|------|
| `element.innerHTML = userInput` | `div.innerHTML = user` | Critical |
| `element.outerHTML = userInput` | `div.outerHTML = user` | Critical |
| `document.write(userInput)` | `document.write(user)` | Critical |
| `document.writeln(userInput)` | `document.writeln(user)` | Critical |
| `eval(userInput)` | `eval(user)` | Critical |
| `setTimeout(userInput)` (string) | `setTimeout("alert(1)", 100)` | Critical |
| `setInterval(userInput)` (string) | `setInterval("alert(1)", 100)` | Critical |
| `new Function(userInput)` | `new Function("alert(1)")()` | Critical |
| `element.insertAdjacentHTML(userInput)` | `div.insertAdjacentHTML(user)` | Critical |
| `jQuery .html()` | `$('#x').html(user)` | Critical |
| `jQuery .append()` | `$('#x').append(user)` | Critical |
| `jQuery .prepend()` | `$('#x').prepend(user)` | Critical |
| `jQuery .before()` | `$('#x').before(user)` | Critical |
| `jQuery .after()` | `$('#x').after(user)` | Critical |
| `jQuery .wrapAll()` | `$('#x').wrapAll(user)` | Critical |
| `jQuery .replaceWith()` | `$('#x').replaceWith(user)` | Critical |
| `jQuery $(user)` | `$(user)` | Critical |
| `Vue v-html` | `<div v-html="user">` | Critical |
| `React dangerouslySetInnerHTML` | `<div dangerouslySetInnerHTML={{__html:user}}>` | Critical |
| `Range.createContextualFragment()` | `range.createContextualFragment(user)` | High |
| `location = userInput` | `location = user` | High |
| `location.href = userInput` | `location.href = user` | High |
| `location.assign(userInput)` | `location.assign(user)` | High |
| `location.replace(userInput)` | `location.replace(user)` | High |
| `window.open(userInput)` | `window.open(user)` | High |
| `element.src = userInput` | `iframe.src = user` | High |
| `execScript(userInput)` (IE) | `execScript(user)` | High |

## Dangerous Sources (attacker can control)

| Source | Typical Value | Risk |
|--------|--------------|------|
| `location.hash` | `#<img/src/onerror=alert(1)>` | Critical |
| `location.search` | `?param=<script>alert(1)</script>` | Critical |
| `location.pathname` | `/path/alert(1)` | Critical |
| `location.href` | Full URL with params | Critical |
| `document.URL` | Full URL | Critical |
| `document.documentURI` | Full URL | Critical |
| `document.baseURI` | May be hijacked via `<base>` | Critical |
| `document.referrer` | Referer header | High |
| `window.name` | Window name (controlled by opener) | High |
| `postMessage` event.data | Message from child/parent iframe | High |
| `location.search params` | Query string values | High |
| `location.hash params` | Fragment values | High |
| `cookie` | Cookie values (if name is reflected) | Medium |
| `localStorage` | Stored values (if attacker can write) | Medium |
| `sessionStorage` | Stored values (if attacker can write) | Medium |
| `history.pushState` state | State object | Low |
| `URL.createObjectURL` | Blob URLs | Low |

## Common Vulnerability Patterns

### Pattern 1: Hash-based routing
```javascript
// VULN: hash used directly as HTML
var page = location.hash.slice(1);
document.getElementById('content').innerHTML = page;
```
PoC: `https://target.com/#<img src=x onerror=alert(1)>`

### Pattern 2: URL param to HTML
```javascript
// VULN: search param to innerHTML
var name = new URLSearchParams(location.search).get('name');
document.getElementById('greeting').innerHTML = 'Hello ' + name;
```
PoC: `https://target.com/?name=<img src=x onerror=alert(1)>`

### Pattern 3: postMessage without origin check
```javascript
// VULN: no origin validation
window.addEventListener('message', function(e) {
    document.getElementById('content').innerHTML = e.data;
});
```
PoC: `<iframe src="https://target.com" onload="this.contentWindow.postMessage('<img src=x onerror=alert(1)>', '*')">`

### Pattern 4: JSON.parse then innerHTML
```javascript
// VULN: parsed JSON into HTML
fetch('/api/data').then(r=>r.json()).then(d=>{
    document.getElementById('output').innerHTML = d.content;
});
```

### Pattern 5: Cookie-based content
```javascript
// VULN: cookie value into DOM
var theme = document.cookie.split('theme=')[1];
document.body.className = theme;  // May not be XSS, but `innerHTML` version is
```

## Detection Commands

### Static detection (grep)
```bash
# Find dangerous sinks
grep -rn "innerHTML\|outerHTML\|document.write\|\.html(\|\.append(\|\.prepend(\|eval(\|setTimeout(\|setInterval(\|new Function(\|insertAdjacentHTML\|v-html\|dangerouslySetInnerHTML" src/

# Find dangerous source usage
grep -rn "location\.hash\|location\.search\|location\.pathname\|document\.referrer\|window\.name\|postMessage\|\.href\s*=" src/

# Find unvalidated postMessage
grep -rn "addEventListener.*message\|onmessage\s*=" src/
```

### Dynamic detection (DOM Invader)
Use Burp Suite's DOM Invader or:
```javascript
// Inject into page to monitor DOM manipulation
// Use selenium with execute_script to check for sink usage
```

## Safe Alternatives
| Instead of | Use |
|-----------|-----|
| `innerHTML = userInput` | `textContent = userInput` |
| `document.write()` | `createElement()` + `appendChild()` |
| `eval(userInput)` | `JSON.parse()` (if JSON) |
| `setTimeout(string)` | `setTimeout(function)` |
| `jQuery.html(userInput)` | `jQuery.text(userInput)` |
| `insertAdjacentHTML()` | `insertAdjacentText()` or DOM methods |
