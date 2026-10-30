---
name: ai-02-llm-enum-recon
sequence: 02-llm-enum-recon
category: ai-security
domain: ai
description: "LLM endpoint reconnaissance: model API discovery, inference endpoint probing, vector store identification, embedding API detection, and model metadata extraction."
wordlist_ref: "wordlists/ai/ai-43-model-api-enumeration/"
---

# LLM Enumeration & Recon — AI Security Offensive Methodology

## Shortcut

1. Probe `/v1/chat/completions`, `/v1/completions`, `/generate`
2. Query model metadata via `/v1/models`, `/health`
3. Check vector stores: `/search`, `/query`, `/embed`
4. Test auth: send request with no key — if 200, endpoint is exposed

## Hacker Mindset

**LLM APIs follow OpenAI's convention.** Most use `/v1/chat/completions`. Discover one and you can use any OpenAI client against it.
**Vector stores are gold mines.** Embedding endpoints reveal what data the RAG system holds.
**Auth is frequently missing** on internal LLM endpoints.

## Detection

### Endpoint Discovery
```
/v1/chat/completions    /v1/completions    /v1/embeddings
/v1/models             /api/generate      /generate
/invoke                /chat              /health
```

### Metadata Extraction
```bash
curl https://target.com/v1/models
curl https://target.com/v1/chat/completions -d '{"messages":[{"role":"user","content":"hello"}]}'
```

### Auth Bypass
```bash
curl https://target.com/v1/chat/completions -d '{"prompt":"test"}'  # no key
curl -H "Authorization: Bearer " https://target.com/chat            # empty key
```

## Wordlist Payloads

### Model Endpoints
`/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`, `/v1/models`
`/chat`, `/api/chat`, `/generate`, `/inference`, `/invoke`

### Admin/Debug Paths
`/health`, `/metrics`, `/debug`, `/config`, `/openapi.json`, `/docs`, `/redoc`

## Bypass Techniques

| Block | Bypass |
|-------|--------|
| IP allowlist | Try internal DNS names, alternative ports |
| API key | Try empty, 'test', 'sk-test', no auth |
| Rate limited | Rotate endpoints: /v1 vs /api vs direct |

## Chaining & Escalation

### Enum → Prompt Injection
1. Discover `/v1/chat/completions` (unauthenticated)
2. Fire prompt injections directly into the protected model

### Enum → Vector Store
1. Find `/v1/embeddings` or `/search`
2. Probe for RAG data → sensitive documents exposed

## OOB Detection & Blind Confirmation

Time-based: `curl -s --max-time 10 -d '{"prompt":"sleep(5)"}'` — 5s+ delay = endpoint alive

## Tools

curl, ffuf (AI endpoint wordlists), OpenAI Python client

## References
- OWASP Top 10 for LLM Applications
