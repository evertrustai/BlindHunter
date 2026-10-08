import { streamChat } from '../providers/openai.js'
import type { ChatMessage } from './types.js'

/** Tidy the model's raw title output into a clean short label. */
function cleanTitle(raw: string): string {
  let t = raw.replace(/[\r\n]+/g, ' ').trim()
  t = t.replace(/^title\s*[:\-–—]\s*/i, '') // drop an echoed "Title:" prefix
  t = t.replace(/^["'`*_]+|["'`*_]+$/g, '').trim() // strip wrapping quotes/markdown
  t = t.replace(/[.。!?…]+$/g, '').trim() // drop trailing punctuation
  if (!t) return ''
  if (t.length > 56) t = t.slice(0, 56).replace(/\s+\S*$/, '').trim() + '…'
  return t.charAt(0).toUpperCase() + t.slice(1)
}

interface TitleOpts {
  baseUrl: string
  apiKey?: string
  headers?: Record<string, string>
  model: string
  firstMessage: string
  signal?: AbortSignal
}

/**
 * Ask the session's own model for a concise topic title summarizing the first
 * message (e.g. "is claude able to bug hunt?" → "Claude's bug hunting ability").
 * Returns '' on any failure so the caller can fall back to a heuristic title.
 */
export async function generateTitle(opts: TitleOpts): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You generate a concise 3-6 word title that summarizes the topic of a conversation from its first message. ' +
        'Reply with ONLY the title text — no quotes, no trailing punctuation, no "Title:" prefix, no explanation.',
    },
    { role: 'user', content: `First message:\n"""\n${opts.firstMessage.slice(0, 1500)}\n"""` },
  ]
  let out = ''
  try {
    for await (const d of streamChat({
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      headers: opts.headers,
      model: opts.model,
      messages,
      signal: opts.signal,
    })) {
      if (d.content) out += d.content
      if (out.length > 160) break // titles are short — stop early
    }
  } catch {
    return ''
  }
  return cleanTitle(out)
}
