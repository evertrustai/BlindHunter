---
name: ai-14-llm-infra-security
sequence: 14-llm-infra-security
category: ai-security
domain: ai
description: "Model API endpoint vulns, inference server misconfig, API key exposure, rate limit bypass, cloud AI service abuse."
wordlist_ref: "wordlists/ai/ai-25-llm-infra-security/"
---

# LLM Infrastructure Security — AI Security Offensive Methodology

## Shortcut

1. Identify hosting: OpenAI proxy, self-hosted, or cloud
2. Test API key validation
3. Test rate limiting
4. Find hidden/debug endpoints

## Hacker Mindset

**Self-hosted LLMs often run without auth.** vLLM, TGI, Ollama expose unauthenticated endpoints by default.

## Detection

`curl https://target.com/v1/chat/completions -d '{"prompt":"test"}'  # no key`
`/health, /metrics, /debug, /config`

## Wordlist Payloads

`/v1, /v2, /api, /inference, /generate, /health, /metrics, /debug, /config, /openapi.json`

## Bypass Techniques

| API key | Try empty, 'test', 'sk-test', none |
| IP allowlist | Internal DNS, alternative ports |

## Chaining & Escalation

### Infra → Injection
1. Find unauthenticated endpoint
2. Fire prompt injections at will without rate limit

## OOB Detection & Blind Confirmation

Time-based endpoint probing

## Tools

curl, nmap, ffuf

## References
- OWASP Top 10 for LLM Applications
