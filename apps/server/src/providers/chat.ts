import { streamChat, type StreamOpts, type StreamDelta } from './openai.js'
import { streamAnthropic } from './anthropic.js'

/** Pick the provider adapter for a protocol: Anthropic Messages, else OpenAI-compatible. */
export function streamProvider(protocol: string | undefined, opts: StreamOpts): AsyncGenerator<StreamDelta> {
  return protocol === 'anthropic' ? streamAnthropic(opts) : streamChat(opts)
}

export type { StreamOpts, StreamDelta }
