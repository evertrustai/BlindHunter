import type { ChatMessage } from '../agent/types.js'

export interface ToolSchema {
  type: 'function'
  function: { name: string; description: string; parameters: unknown }
}

export interface StreamDelta {
  content?: string
  toolCalls?: { index: number; id?: string; name?: string; args?: string }[]
  finish?: string
  usage?: { prompt: number; completion: number; total: number }
}

interface StreamOpts {
  baseUrl: string
  apiKey?: string
  headers?: Record<string, string>
  model: string
  messages: ChatMessage[]
  tools?: ToolSchema[]
  reasoningEffort?: string
  signal?: AbortSignal
}

/**
 * Stream a chat completion from any OpenAI-compatible endpoint.
 * Yields incremental content and tool-call fragments as they arrive.
 */
function parseErr(text: string): string {
  let msg = text.slice(0, 500)
  try {
    const j = JSON.parse(text) as { error?: { message?: string }; message?: string }
    msg = j.error?.message ?? j.message ?? msg
  } catch {
    // response wasn't JSON — keep the raw text
  }
  return msg
}

/** Transient errors worth a bounded retry — but only before any output was produced. */
function isRetriable(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  if (/fetch failed|econnreset|econnrefused|enotfound|etimedout|timed out|timeout|socket|network|und_err/.test(msg)) {
    return true
  }
  const m = msg.match(/provider error (\d{3})/)
  if (m) {
    const s = Number(m[1])
    return s === 429 || s >= 500
  }
  return false
}

export async function* streamChat(opts: StreamOpts): AsyncGenerator<StreamDelta> {
  const url = opts.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const headers = {
    'content-type': 'application/json',
    ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}),
    ...(opts.headers ?? {}),
  }
  const doFetch = (withEffort: boolean) =>
    fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        tools: opts.tools,
        stream: true,
        stream_options: { include_usage: true },
        ...(withEffort && opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
      }),
      signal: opts.signal,
    })

  // Retry a turn a few times ONLY while it hasn't produced output yet, so a transient
  // blip at the start of a long hunt doesn't kill the run — while a mid-stream failure
  // still surfaces, with no duplicated tokens. (long-hunt robustness)
  const MAX_ATTEMPTS = 3
  for (let attempt = 1; ; attempt++) {
    let emitted = false
    try {
      let res = await doFetch(true)
      // Many models reject reasoning_effort ("does not support thinking"). Retry without it.
      if (!res.ok && opts.reasoningEffort) {
        const text = await res.text().catch(() => '')
        if (/think|reason/i.test(text)) {
          res = await doFetch(false)
        } else {
          throw new Error(`Provider error ${res.status}: ${parseErr(text)}`)
        }
      }

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw new Error(`Provider error ${res.status}: ${parseErr(text)}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (data === '[DONE]') return

          let json: unknown
          try {
            json = JSON.parse(data)
          } catch {
            continue
          }
          const j = json as {
            choices?: unknown[]
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
          }
          if (j.usage) {
            emitted = true
            yield {
              usage: {
                prompt: j.usage.prompt_tokens ?? 0,
                completion: j.usage.completion_tokens ?? 0,
                total: j.usage.total_tokens ?? 0,
              },
            }
          }
          const choice = j.choices?.[0] as
            | { delta?: { content?: string; tool_calls?: unknown[] }; finish_reason?: string }
            | undefined
          if (!choice) continue

          const out: StreamDelta = {}
          if (typeof choice.delta?.content === 'string') out.content = choice.delta.content
          if (Array.isArray(choice.delta?.tool_calls)) {
            out.toolCalls = (choice.delta.tool_calls as Array<{
              index: number
              id?: string
              function?: { name?: string; arguments?: string }
            }>).map((tc) => ({
              index: tc.index,
              id: tc.id,
              name: tc.function?.name,
              args: tc.function?.arguments,
            }))
          }
          if (choice.finish_reason) out.finish = choice.finish_reason
          if (out.content !== undefined || out.toolCalls || out.finish) {
            emitted = true
            yield out
          }
        }
      }
      return
    } catch (err) {
      // A user stop is final; otherwise retry a transient start-of-turn failure.
      if (opts.signal?.aborted) throw err
      if (!emitted && attempt < MAX_ATTEMPTS && isRetriable(err)) {
        await new Promise((r) => setTimeout(r, 400 * attempt))
        continue
      }
      throw err
    }
  }
}
