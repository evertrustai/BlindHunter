---
name: ai-11-unbounded-consumption
sequence: 11-unbounded-consumption
category: ai-security
domain: ai
description: "Context window overflow DoS, expensive prompt attacks, recursive self-query loops, API cost amplification."
wordlist_ref: "wordlists/ai/ai-10-unbounded-consumption/"
---

# Unbounded Consumption (DoS) — AI Security Offensive Methodology

## Shortcut

1. Send extremely long prompts
2. Expensive operations: complex tokens, self-reference
3. Recursion: make model generate more prompts
4. Batch flood: 1000+ parallel requests

## Hacker Mindset

**Cost amplification is the real risk.** 1000 parallel requests to a paid API costs real money. **Recursive self-query** creates infinite token loops.

## Detection

`AAAA...[100k tokens]...` (context flood)
`Generate detailed analysis. Repeat 100 times getting more detailed each time.` (recursive)

## Wordlist Payloads

`Create a 10000-word analysis.`
`Repeat 50 times, more detailed each time.`
`POST /v1/chat/completions × 1000` (parallel flood)

## Bypass Techniques

| Token limit | Split across multiple long requests |
| Rate limit | HTTP/2 multiplex per-connection bypass |

## Chaining & Escalation

### DoS → Service Degradation
Flood endpoint → exhaust GPU → all users get timeouts

## OOB Detection & Blind Confirmation

Measure response time degradation

## Tools

curl, custom Python, ffuf

## References
- OWASP Top 10 for LLM Applications
