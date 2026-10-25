import type { ChatMessage, ContentPart, ToolCallRef } from '../agent/types.js'
import type { StreamOpts, StreamDelta, ToolSchema } from './openai.js'
import { isClaudeApiKey, anthropicAuthHeaders } from '../auth/claude.js'

/**
 * Anthropic Messages API adapter, used for a connected Claude Pro/Max subscription
 * (providers/../auth/claude.ts). Claude's API isn't OpenAI-shaped, so this translates
 * the agent's OpenAI-style messages/tools into the Messages format, calls the API with
 * the OAuth Bearer token + oauth beta header, and parses Anthropic's SSE back into the
 * same StreamDelta the agent loop already understands. `opts.apiKey` is the OAuth token.
 */

const API_URL = 'https://api.anthropic.com/v1/messages'
const MAX_TOKENS = 8192

type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }

interface AMessage {
  role: 'user' | 'assistant'
  content: Block[]
}

function userBlocks(content: string | ContentPart[]): Block[] {
  if (typeof content === 'string') return content ? [{ type: 'text', text: content }] : []
  const blocks: Block[] = []
  for (const p of content) {
    if (p.type === 'text') {
      if (p.text) blocks.push({ type: 'text', text: p.text })
    } else if (p.type === 'image_url') {
      const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(p.image_url.url)
      if (m) blocks.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } })
    }
  }
  return blocks
}

function assistantBlocks(m: ChatMessage): Block[] {
  const blocks: Block[] = []
  const text = typeof m.content === 'string' ? m.content : ''
  if (text) blocks.push({ type: 'text', text })
  for (const tc of m.tool_calls ?? ([] as ToolCallRef[])) {
    let input: unknown = {}
    try {
      input = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
    } catch {
      input = {}
    }
    blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input })
  }
  return blocks
}

/** Convert OpenAI-style messages/tools into Anthropic Messages format. */
function toAnthropic(messages: ChatMessage[], tools?: ToolSchema[], spoofClaudeCode = true) {
  // The oauth subscription path expects requests to look like Claude Code; a plain API
  // key doesn't need (or want) that spoofed system line.
  const systemParts: string[] = spoofClaudeCode ? ["You are Claude Code, Anthropic's official CLI for Claude."] : []
  const seq: AMessage[] = []
  for (const m of messages) {
    if (m.role === 'system') {
      if (typeof m.content === 'string' && m.content.trim()) systemParts.push(m.content)
      continue
    }
    if (m.role === 'tool') {
      // Tool results belong in a user turn as tool_result blocks.
      seq.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.tool_call_id ?? '', content: typeof m.content === 'string' ? m.content : '' }],
      })
      continue
    }
    if (m.role === 'user') seq.push({ role: 'user', content: userBlocks(m.content) })
    else if (m.role === 'assistant') {
      const blocks = assistantBlocks(m)
      if (blocks.length) seq.push({ role: 'assistant', content: blocks })
    }
  }
  // Merge consecutive same-role turns — Anthropic requires alternating roles.
  const merged: AMessage[] = []
  for (const msg of seq) {
    const last = merged[merged.length - 1]
    if (last && last.role === msg.role) last.content.push(...msg.content)
    else merged.push({ role: msg.role, content: [...msg.content] })
  }
  // The conversation must begin with a user turn.
  while (merged.length && merged[0].role !== 'user') merged.shift()
  const outTools = (tools ?? []).map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }))
  return { system: systemParts.join('\n\n'), messages: merged, tools: outTools }
}

export async function* streamAnthropic(opts: StreamOpts): AsyncGenerator<StreamDelta> {
  if (!opts.apiKey) {
    throw new Error('Claude subscription not connected — reconnect it in Settings › Models.')
  }
  const usingApiKey = isClaudeApiKey(opts.apiKey)
  const { system, messages, tools } = toAnthropic(opts.messages, opts.tools, !usingApiKey)
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      ...anthropicAuthHeaders(opts.apiKey),
      ...(opts.headers ?? {}),
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: MAX_TOKENS,
      system,
      messages,
      ...(tools.length ? { tools } : {}),
      stream: true,
    }),
    signal: opts.signal,
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    let msg = text.slice(0, 500)
    let type = ''
    try {
      const j = JSON.parse(text) as { error?: { message?: string; type?: string } }
      msg = j.error?.message ?? msg
      type = j.error?.type ?? ''
    } catch {
      /* keep raw text */
    }
    // Anthropic returns a terse rate_limit_error ("Error") when it throttles a subscription
    // token — usually the Claude Pro/Max usage limit for the current window, which resets on a
    // rolling basis. Spell that out instead of surfacing the opaque body.
    if (res.status === 429 || type === 'rate_limit_error') {
      throw new Error(
        'Claude is rate-limiting this request (429). Your Claude subscription usage limit for the current window is likely reached — it resets on a rolling basis, so wait a bit and try again. Note that Claude Code usage on the same plan counts toward the same limit.',
      )
    }
    throw new Error(`Provider error ${res.status}: ${msg || type || 'request failed'}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let promptTokens = 0
  let completionTokens = 0

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let sep: number
    while ((sep = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, sep).trim()
      buf = buf.slice(sep + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data) continue
      let j: {
        type?: string
        index?: number
        message?: { usage?: { input_tokens?: number } }
        content_block?: { type?: string; id?: string; name?: string }
        delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string }
        usage?: { output_tokens?: number }
        error?: unknown
      }
      try {
        j = JSON.parse(data)
      } catch {
        continue
      }
      switch (j.type) {
        case 'message_start':
          promptTokens = j.message?.usage?.input_tokens ?? 0
          break
        case 'content_block_start':
          if (j.content_block?.type === 'tool_use') {
            yield { toolCalls: [{ index: j.index ?? 0, id: j.content_block.id, name: j.content_block.name, args: '' }] }
          }
          break
        case 'content_block_delta':
          if (j.delta?.type === 'text_delta' && j.delta.text) {
            yield { content: j.delta.text }
          } else if (j.delta?.type === 'input_json_delta' && j.delta.partial_json !== undefined) {
            yield { toolCalls: [{ index: j.index ?? 0, args: j.delta.partial_json }] }
          }
          break
        case 'message_delta':
          if (j.usage?.output_tokens != null) completionTokens = j.usage.output_tokens
          if (j.delta?.stop_reason) {
            const sr = j.delta.stop_reason
            const finish = sr === 'tool_use' ? 'tool_calls' : sr === 'max_tokens' ? 'length' : 'stop'
            yield { finish }
          }
          break
        case 'message_stop':
          yield { usage: { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens } }
          return
        case 'error':
          throw new Error(`Provider error: ${JSON.stringify(j.error).slice(0, 200)}`)
      }
    }
  }
}
