# WAF Bypass Playbook

## Detection
- Send normal request (baseline)
- Send <script>alert(1)</script> (blocked?)
- Check response code/content for WAF signatures

## Bypass techniques (try in order)
1. Case mutation: <ScRiPt> -> <sCrIpT>
2. Encoding: URL, double URL, hex, octal, unicode
3. Comment injection: <sc<!-->ript>
4. HPP: ?p=1&p=<script>&r=alert(1)
5. Buffer overflow: send 8-10KB padding before payload
6. Charset: UTF-7, charset=mib
7. Content-Type switch: text/plain, multipart
8. Parameter pollution: array params

## Tool
- Use nuclei with custom templates
- Use ffuf for fuzzing bypass patterns
