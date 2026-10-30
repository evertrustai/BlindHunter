import { randomUUID } from 'node:crypto'
import type { ChatMessage, ContentPart, ToolCallRef } from '../agent/types.js'
import type { StreamOpts, StreamDelta, ToolSchema } from './openai.js'
import { isTransientNetwork } from './anthropic.js'

/**
 * ChatGPT (Codex) adapter. A connected ChatGPT subscription (auth/codex.ts) talks to the
 * Codex Responses backend, NOT the normal chat-completions API — a different request/stream
 * shape. This translates the agent's OpenAI-style messages/tools into a Responses request,
 * calls the backend with the Codex account headers, and parses the Responses SSE back into
 * the same StreamDelta the agent loop understands.
 *
 * opts.apiKey is the ChatGPT access token; opts.headers carries `chatgpt-account-id`.
 * UNOFFICIAL and picky: the backend allowlists `originator`, requires a non-empty
 * `instructions` and `store:false`, and may rate-limit subscription traffic.
 */

const API_URL = 'https://chatgpt.com/backend-api/codex/responses'
const ORIGINATOR = 'codex_cli_rs'
const UA = 'codex_cli_rs/0.0.0'
const MAX_TOKENS = 8192

type InputItem =
  | { type: 'message'; role: 'user' | 'assistant' | 'developer'; content: ({ type: 'input_text'; text: string } | { type: 'output_text'; text: string })[] }
  | { type: 'function_call'; call_id: string; name: string; arguments: string }
  | { type: 'function_call_output'; call_id: string; output: string }

function textOf(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content
  return content
    .map((p) => (p.type === 'text' ? p.text : ''))
    .filter(Boolean)
    .join('\n')
}

/** Translate OpenAI-style messages into Responses `instructions` + `input` items. */
function toResponses(messages: ChatMessage[]): { instructions: string; input: InputItem[] } {
  const systemParts: string[] = []
  const input: InputItem[] = []
  for (const m of messages) {
    if (m.role === 'system') {
      const t = textOf(m.content)
      if (t.trim()) systemParts.push(t)
    } else if (m.role === 'user') {
      const t = textOf(m.content)
      if (t) input.push({ type: 'message', role: 'user', content: [{ type: 'input_text', text: t }] })
    } else if (m.role === 'assistant') {
      const t = typeof m.content === 'string' ? m.content : ''
      if (t) input.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: t }] })
      for (const tc of m.tool_calls ?? ([] as ToolCallRef[])) {
        input.push({ type: 'function_call', call_id: tc.id, name: tc.function.name, arguments: tc.function.arguments || '{}' })
      }
    } else if (m.role === 'tool') {
      input.push({ type: 'function_call_output', call_id: m.tool_call_id ?? '', output: typeof m.content === 'string' ? m.content : '' })
    }
  }
  return { instructions: systemParts.join('\n\n') || 'You are a helpful assistant.', input }
}

function toResponsesTools(tools?: ToolSchema[]) {
  return (tools ?? []).map((t) => ({
    type: 'function' as const,
    name: t.function.name,
    description: t.function.description,
    strict: false,
    parameters: t.function.parameters,
  }))
}

export async function* streamCodex(opts: StreamOpts): AsyncGenerator<StreamDelta> {
  if (!opts.apiKey) throw new Error('ChatGPT (Codex) not connected — reconnect it in Settings › Models.')
  const { instructions, input } = toResponses(opts.messages)
  const tools = toResponsesTools(opts.tools)

  const headers = {
    'content-type': 'application/json',
    accept: 'text/event-stream',
    authorization: `Bearer ${opts.apiKey}`,
    originator: ORIGINATOR,
    'openai-beta': 'responses=experimental',
    'user-agent': UA,
    session_id: randomUUID(),
    ...(opts.headers ?? {}),
  }
  const body = JSON.stringify({
    model: opts.model,
    instructions,
    input,
    ...(tools.length ? { tools, tool_choice: 'auto', parallel_tool_calls: true } : {}),
    store: false,
    stream: true,
    include: ['reasoning.encrypted_content'],
    max_output_tokens: MAX_TOKENS,
  })

  // Retry a transient connection blip at the start of the turn (before any output).
  let res: Response | undefined
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(API_URL, { method: 'POST', headers, body, signal: opts.signal })
      break
    } catch (e) {
      if (attempt < 3 && isTransientNetwork(e)) {
        await new Promise((r) => setTimeout(r, 400 * attempt))
        continue
      }
      throw e
    }
  }
  if (!res) throw new Error('No response from Codex backend.')

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    let msg = text.slice(0, 400)
    try {
      const j = JSON.parse(text) as { error?: { message?: string; type?: string }; detail?: string }
      msg = j.error?.message ?? j.detail ?? msg
      if (res.status === 429 || j.error?.type === 'usage_limit_reached') {
        throw new Error(
          'ChatGPT is rate-limiting this request (429). Your ChatGPT plan usage limit for the current window is likely reached — wait and try again.',
        )
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('ChatGPT is rate-limiting')) throw e
    }
    throw new Error(`Provider error ${res.status}: ${msg || 'request failed'}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  // Track active function calls by their streaming item id so arg deltas land on the right call.
  const calls = new Map<string, number>() // item_id -> toolCall index
  let nextIndex = 0
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
      if (!data || data === '[DONE]') continue
      let j: {
        type?: string
        delta?: string
        item_id?: string
        item?: { type?: string; id?: string; call_id?: string; name?: string }
        response?: { usage?: { input_tokens?: number; output_tokens?: number } }
        error?: { message?: string }
      }
      try {
        j = JSON.parse(data)
      } catch {
        continue
      }
      switch (j.type) {
        case 'response.output_text.delta':
          if (j.delta) yield { content: j.delta }
          break
        case 'response.output_item.added':
          if (j.item?.type === 'function_call' && j.item.id) {
            const index = nextIndex++
            calls.set(j.item.id, index)
            yield { toolCalls: [{ index, id: j.item.call_id ?? j.item.id, name: j.item.name, args: '' }] }
          }
          break
        case 'response.function_call_arguments.delta':
          if (j.item_id && j.delta !== undefined) {
            const index = calls.get(j.item_id) ?? 0
            yield { toolCalls: [{ index, args: j.delta }] }
          }
          break
        case 'response.completed': {
          const u = j.response?.usage
          if (u) {
            promptTokens = u.input_tokens ?? 0
            completionTokens = u.output_tokens ?? 0
          }
          yield { finish: calls.size ? 'tool_calls' : 'stop' }
          yield { usage: { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens } }
          return
        }
        case 'response.failed':
        case 'error':
          throw new Error(`Provider error: ${(j.error?.message ?? JSON.stringify(j)).slice(0, 200)}`)
      }
    }
  }
}
