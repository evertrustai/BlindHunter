# Security Policy

Thanks for helping keep **BlindHunter** and its users safe. This project is an agent for
**authorized** security testing, so I take the security of the tool itself seriously.

## Supported versions

Security fixes are released against the latest version. Please upgrade to the newest
[release](https://github.com/evertrustai/BlindHunter/releases) before reporting.

| Version | Supported |
| ------- | --------- |
| 0.2.x   | ✅        |
| < 0.2   | ❌        |

## Reporting a vulnerability

**Please do not open a public issue for security problems.** Report privately via either
of these channels:

1. **GitHub private vulnerability reporting (preferred)** — use the
   **"Report a vulnerability"** button on the repository's
   [Security Advisories page](https://github.com/evertrustai/BlindHunter/security/advisories/new).
   This keeps the report private between you and the maintainer and tracks it to a fix.

2. **Email** — [evertrustai@gmail.com](mailto:evertrustai@gmail.com). Please use the subject
   line `BlindHunter security` and, if you can, encrypt sensitive details.

### What to include

To help triage quickly, please include where you can:

- The affected version / commit and your environment (OS, Node/pnpm version).
- A clear description of the issue and its impact.
- Step-by-step reproduction, a proof of concept, or a minimal patch.
- Any logs or output (with secrets redacted).

### What to expect

- **Acknowledgement:** within **72 hours**.
- **Assessment & updates:** I'll confirm the issue, keep you posted on progress, and agree
  a disclosure timeline with you (coordinated disclosure — typically fixed and released
  before public details).
- **Credit:** I'm happy to credit you in the release notes / advisory unless you prefer to
  stay anonymous.

## Scope

In scope: vulnerabilities in **BlindHunter's own code** — the server, web UI, provider/auth
layer, the shared browser/terminal, the Telegram integration, and the credential handling.

Out of scope: issues that require an attacker to already control the machine BlindHunter runs
on, or misuse of the tool against third-party targets. BlindHunter binds to `127.0.0.1` by
design — exposing it to a network without your own authentication in front of it is a
deployment choice, not a vulnerability. Credentials are stored owner-only (`0600`) under
`~/.blindhunter`; findings that bypass that isolation are in scope.

## Responsible use

BlindHunter is built for testing systems you are **authorized** to test. Reports demonstrating
attacks against systems you do not own or have permission to test will not be accepted.
