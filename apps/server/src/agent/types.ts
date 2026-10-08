import type { ToolSchema } from '../providers/openai.js'

export interface ToolCallRef {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/** An external tool (e.g. from an MCP server) the agent can call, with its runner. */
export interface ExtraTool {
  schema: ToolSchema
  run: (args: Record<string, unknown>) => Promise<string>
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCallRef[]
  tool_call_id?: string
  name?: string
}

/** Events streamed from the agent loop to the client over SSE. */
export type AgentEvent =
  | { type: 'assistant_delta'; text: string }
  | { type: 'tool_call'; id: string; name: string; arguments: string }
  | { type: 'approval_request'; id: string; name: string; arguments: string }
  | { type: 'tool_result'; id: string; name: string; result: string }
  | { type: 'assistant_message'; content: string }
  | { type: 'assistant_retract' }
  | { type: 'usage'; prompt: number; completion: number; total: number; context: number }
  | { type: 'session_title'; title: string }
  | { type: 'plan'; steps: PlanStep[] }
  | { type: 'done' }
  | { type: 'error'; message: string }

export interface PlanStep {
  title: string
  status: 'pending' | 'in_progress' | 'completed'
}
