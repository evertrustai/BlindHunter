import { streamChat } from '../providers/openai.js'
import { TOOL_SCHEMAS, executeTool } from '../tools/registry.js'
import type { ToolSchema } from '../providers/openai.js'
import type { ShellKind } from '../tools/shell.js'
import { systemPrompt, GENERAL_WORKER_PERSONA } from './prompt.js'
import { requestApproval } from './approvals.js'
import type { ChatMessage, AgentEvent, ToolCallRef, ExtraTool, PlanStep } from './types.js'

const UPDATE_PLAN_SCHEMA: ToolSchema = {
  type: 'function',
  function: {
    name: 'update_plan',
    description:
      'Maintain a short checklist of the steps for the current task so the user can follow progress. Call it when you begin multi-step work and again whenever a step changes status. Keep 3-8 concise steps; mark exactly one as in_progress.',
    parameters: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          description: 'The ordered steps.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Short step description.' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
            },
            required: ['title', 'status'],
          },
        },
      },
      required: ['steps'],
    },
  },
}

/** Coerce a model's update_plan args into a clean step list. */
function parsePlanSteps(args: Record<string, unknown>): PlanStep[] {
  const raw = Array.isArray(args.steps) ? args.steps : []
  const out: PlanStep[] = []
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue
    const o = s as { title?: unknown; status?: unknown }
    const title = String(o.title ?? '').trim()
    if (!title) continue
    const status =
      o.status === 'completed' || o.status === 'in_progress' ? o.status : o.status === 'done' ? 'completed' : 'pending'
    out.push({ title: title.slice(0, 120), status })
  }
  return out.slice(0, 12)
}

/** Tools that mutate the system or reach a target — gated behind approval in Manual mode. */
function needsApproval(name: string): boolean {
  return (
    name === 'bash' ||
    name === 'write_file' ||
    name === 'edit_file' ||
    // Reading files/dirs can exfiltrate sensitive data, so it's approved in Manual mode too.
    name === 'read_file' ||
    name === 'list_dir' ||
    // Browser actions that send traffic to a target (screenshots stay auto).
    name === 'browser_navigate' ||
    name === 'browser_click' ||
    name === 'browser_fill' ||
    name === 'browser_press'
  )
}

/** A specialist the main agent can delegate a sub-task to via spawn_subagent. */
export interface SubagentDef {
  name: string
  description: string
  systemPrompt: string
}

const SPAWN_SUBAGENT_SCHEMA: ToolSchema = {
  type: 'function',
  function: {
    name: 'spawn_subagent',
    description:
      'Delegate a focused, self-contained sub-task to a subagent that works independently with its own tools and returns a report. Spawn as many as you need — one per distinct sub-task. Optionally target a named specialist via "agent"; omit it for a capable general-purpose worker.',
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The specific, self-contained task for the subagent to carry out and report on.',
        },
        agent: {
          type: 'string',
          description: 'Optional: name of a named specialist subagent. Omit to use a general-purpose worker.',
        },
      },
      required: ['task'],
    },
  },
}

export interface RunOpts {
  baseUrl: string
  apiKey?: string
  headers?: Record<string, string>
  model: string
  cwd: string
  history: ChatMessage[]
  userMessage: string
  maxSteps?: number
  contextWindow?: number
  permission?: string
  effort?: string
  shell?: ShellKind
  disabledTools?: string[]
  /** The active agent's persona (custom or built-in). */
  persona?: string
  /** Named specialist subagents this run may target by name. */
  subagents?: SubagentDef[]
  /** Whether this run may spawn subagents at all. False inside a subagent (one level deep). Default true. */
  canDelegate?: boolean
  /** External tools (e.g. MCP servers) advertised to the model alongside the built-ins. */
  extraTools?: ExtraTool[]
  signal?: AbortSignal
}

/**
 * The core think -> act -> observe loop. Streams events; runs tool calls until the
 * model stops requesting them or maxSteps is reached.
 */
export async function* runAgent(opts: RunOpts): AsyncGenerator<AgentEvent> {
  const subagents = opts.subagents ?? []
  const canDelegate = opts.canDelegate !== false
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt(
        opts.cwd,
        opts.persona,
        subagents.map((s) => ({ name: s.name, description: s.description })),
        canDelegate,
        opts.shell,
      ),
    },
    // Stored 'tool' messages are display-only records for the UI; they aren't paired
    // with tool_calls, so keep them out of the model's context to avoid API errors.
    ...opts.history.filter((m) => m.role !== 'tool'),
    { role: 'user', content: opts.userMessage },
  ]
  // The root orchestrator gets more steps so it can spawn + coordinate many subagents.
  const maxSteps = opts.maxSteps ?? (canDelegate ? 24 : 12)
  const disabled = new Set(opts.disabledTools ?? [])
  const extraTools = opts.extraTools ?? []
  const extraRun = new Map(extraTools.map((t) => [t.schema.function.name, t.run]))
  const activeTools = TOOL_SCHEMAS.filter((t) => !disabled.has(t.function.name))
  if (canDelegate) {
    // The top-level agent gets planning + delegation; subagents stay focused.
    activeTools.push(UPDATE_PLAN_SCHEMA)
    activeTools.push(SPAWN_SUBAGENT_SCHEMA)
  }
  for (const t of extraTools) activeTools.push(t.schema)
  const reasoningEffort =
    opts.effort === 'extra'
      ? 'high'
      : opts.effort && ['low', 'medium', 'high'].includes(opts.effort)
        ? opts.effort
        : undefined

  for (let step = 0; step < maxSteps; step++) {
    let content = ''
    let usage: { prompt: number; completion: number; total: number } | undefined
    const acc = new Map<number, { id: string; name: string; args: string }>()

    try {
      for await (const d of streamChat({
        baseUrl: opts.baseUrl,
        apiKey: opts.apiKey,
        headers: opts.headers,
        model: opts.model,
        messages,
        tools: activeTools,
        reasoningEffort,
        signal: opts.signal,
      })) {
        if (d.usage) usage = d.usage
        if (d.content) {
          content += d.content
          yield { type: 'assistant_delta', text: d.content }
        }
        if (d.toolCalls) {
          for (const tc of d.toolCalls) {
            const cur = acc.get(tc.index) ?? { id: '', name: '', args: '' }
            if (tc.id) cur.id = tc.id
            if (tc.name) cur.name = tc.name
            if (tc.args) cur.args += tc.args
            acc.set(tc.index, cur)
          }
        }
      }
    } catch (err) {
      yield { type: 'error', message: err instanceof Error ? err.message : String(err) }
      return
    }

    if (usage) {
      yield {
        type: 'usage',
        prompt: usage.prompt,
        completion: usage.completion,
        total: usage.total,
        context: opts.contextWindow ?? 0,
      }
    }

    const calls = [...acc.values()].filter((t) => t.name)

    let toolRefs: ToolCallRef[] = calls.map((t, i) => ({
      id: t.id || `call_${step}_${i}`,
      type: 'function',
      function: { name: t.name, arguments: t.args || '{}' },
    }))

    // Fallback: some local models (via Ollama, etc.) emit a tool call as plain-text
    // JSON in the content rather than structured tool_calls. Recover it so tools run.
    let assistantText = content
    if (toolRefs.length === 0) {
      const inline = parseInlineToolCalls(content)
      if (inline.length) {
        toolRefs = inline.map((t, i) => ({
          id: `call_${step}_${i}`,
          type: 'function' as const,
          function: { name: t.name, arguments: t.arguments },
        }))
        assistantText = ''
        yield { type: 'assistant_retract' } // undo the raw JSON we streamed as text
      }
    }

    messages.push({ role: 'assistant', content: assistantText, ...(toolRefs.length ? { tool_calls: toolRefs } : {}) })
    if (assistantText) yield { type: 'assistant_message', content: assistantText }

    if (!toolRefs.length) {
      yield { type: 'done' }
      return
    }

    for (const ref of toolRefs) {
      // Plan updates drive the Progress panel, not a tool card.
      if (ref.function.name === 'update_plan') {
        let planArgs: Record<string, unknown> = {}
        try {
          planArgs = ref.function.arguments ? (JSON.parse(ref.function.arguments) as Record<string, unknown>) : {}
        } catch {
          /* ignore */
        }
        const steps = parsePlanSteps(planArgs)
        yield { type: 'plan', steps }
        messages.push({ role: 'tool', tool_call_id: ref.id, name: 'update_plan', content: `Plan updated: ${steps.length} steps.` })
        continue
      }
      const isExtra = extraRun.has(ref.function.name)
      // External (MCP) tools can have side effects — gate them in Manual mode too.
      if (opts.permission === 'manual' && (needsApproval(ref.function.name) || isExtra)) {
        yield { type: 'approval_request', id: ref.id, name: ref.function.name, arguments: ref.function.arguments }
        const approved = await requestApproval(ref.id, opts.signal)
        if (!approved) {
          const rejected = '(rejected by the user — not executed)'
          yield { type: 'tool_result', id: ref.id, name: ref.function.name, result: rejected }
          messages.push({ role: 'tool', tool_call_id: ref.id, name: ref.function.name, content: rejected })
          continue
        }
      } else {
        yield { type: 'tool_call', id: ref.id, name: ref.function.name, arguments: ref.function.arguments }
      }
      let parsed: Record<string, unknown> = {}
      try {
        parsed = ref.function.arguments ? (JSON.parse(ref.function.arguments) as Record<string, unknown>) : {}
      } catch {
        // leave empty — tool will surface a useful error
      }
      let result: string
      if (ref.function.name === 'spawn_subagent') {
        result = yield* runSubagent(opts, subagents, parsed as { agent?: string; task?: string })
      } else if (isExtra) {
        try {
          result = await extraRun.get(ref.function.name)!(parsed)
        } catch (e) {
          result = `error: ${e instanceof Error ? e.message : String(e)}`
        }
      } else {
        try {
          result = await executeTool(ref.function.name, parsed, opts.cwd, opts.shell)
        } catch (e) {
          result = `error: ${e instanceof Error ? e.message : String(e)}`
        }
      }
      yield { type: 'tool_result', id: ref.id, name: ref.function.name, result }
      messages.push({ role: 'tool', tool_call_id: ref.id, name: ref.function.name, content: result })
    }
  }

  yield { type: 'done' }
}

/**
 * Run a subagent as a nested loop. Its tool activity and reasoning are forwarded
 * to the client (so the user sees the work + manual approvals still work), while
 * its final answer is returned as the parent tool's result. Subagents can't
 * spawn subagents (no recursion), keeping delegation one level deep.
 */
async function* runSubagent(
  parent: RunOpts,
  subagents: SubagentDef[],
  args: { agent?: string; task?: string },
): AsyncGenerator<AgentEvent, string> {
  const task = String(args.task ?? '').trim()
  if (!task) return 'The subagent "task" was empty — nothing to delegate.'

  // A named specialist if requested and found; otherwise a general-purpose worker.
  const name = String(args.agent ?? '').trim()
  const sub = name ? subagents.find((s) => s.name === name) : undefined
  const persona = sub?.systemPrompt ?? GENERAL_WORKER_PERSONA
  const label = sub?.name ?? 'worker'

  let report = ''
  for await (const ev of runAgent({
    ...parent,
    persona,
    subagents: [],
    canDelegate: false, // one level deep — a subagent can't spawn subagents
    history: [],
    userMessage: task,
    maxSteps: 8,
  })) {
    if (ev.type === 'assistant_message') {
      report += (report ? '\n' : '') + ev.content
      continue
    }
    if (ev.type === 'done' || ev.type === 'usage') continue // parent turn owns these
    if (ev.type === 'error') {
      report += `\n[subagent error] ${ev.message}`
      continue
    }
    yield ev // forward tool_call / tool_result / approval_request / assistant_delta / assistant_retract
  }
  return report.trim() || `(subagent "${label}" finished without a written report)`
}

/** Recover tool calls that a model emitted as plain-text JSON in its content. */
function parseInlineToolCalls(text: string): { name: string; arguments: string }[] {
  let s = text.trim()
  if (!s) return []
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence?.[1]) s = fence[1].trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(s)
  } catch {
    return []
  }

  const toCall = (o: unknown): { name: string; arguments: string } | null => {
    if (o && typeof o === 'object' && typeof (o as { name?: unknown }).name === 'string') {
      const rec = o as { name: string; arguments?: unknown; parameters?: unknown }
      const args = rec.arguments ?? rec.parameters ?? {}
      return { name: rec.name, arguments: typeof args === 'string' ? args : JSON.stringify(args) }
    }
    return null
  }

  if (Array.isArray(parsed)) {
    return parsed.map(toCall).filter((x): x is { name: string; arguments: string } => x !== null)
  }
  const one = toCall(parsed)
  return one ? [one] : []
}
