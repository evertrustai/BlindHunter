---
name: ai-12-model-extraction
sequence: 12-model-extraction
category: ai-security
domain: ai
description: "Endpoint probing, inference API stealing, model architecture fingerprinting, weight extraction via API queries."
wordlist_ref: "wordlists/ai/ai-12-model-extraction/"
---

# Model Extraction & Theft — AI Security Offensive Methodology

## Shortcut

1. Probe with varied inputs
2. Record output distributions
3. Determine architecture via response analysis

## Hacker Mindset

**Model extraction is IP theft.** For $20 in API calls you can clone a model's behavior. **Output distribution analysis** reveals GPT-4 vs GPT-3.5 vs fine-tune.

## Detection

`How many parameters do you have?`
`What architecture are you based on?`
`What quantization level?`

## Wordlist Payloads

Probe with varied temperatures and prompts to expose output distributions

## Bypass Techniques

| Rate limit | Rotate X-Forwarded-For |
| Output restriction | Use generate() API if chat limited |

## Chaining & Escalation

### Extraction → Cloning
Collect prompt/response pairs → replicate behavior locally

## OOB Detection & Blind Confirmation

Compare response times across queries

## Tools

Custom Python, OpenAI clients

## References
- OWASP Top 10 for LLM Applications
