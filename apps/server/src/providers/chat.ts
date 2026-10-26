import { streamChat, type StreamOpts, type StreamDelta } from './openai.js'
import { streamAnthropic } from './anthropic.js'
import { streamCodex } from './codex.js'

/** Pick the provider adapter for a protocol: Anthropic Messages, Codex Responses, else OpenAI. */
export function streamProvider(protocol: string | undefined, opts: StreamOpts): AsyncGenerator<StreamDelta> {
  if (protocol === 'anthropic') return streamAnthropic(opts)
  if (protocol === 'codex') return streamCodex(opts)
  return streamChat(opts)
}

export type { StreamOpts, StreamDelta }
