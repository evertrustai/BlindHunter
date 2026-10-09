import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { runAgent } from '../agent/loop.js'
import { generateTitle } from '../agent/title.js'
import { resolveApproval } from '../agent/approvals.js'
import {
  createSession,
  getSession,
  listSessions,
  addMessages,
  setTitle,
  isUnnamed,
  updateSession,
  deleteSession,
  listGroups,
  createGroup,
  renameGroup,
  deleteGroup,
} from '../sessions/store.js'
import { loadSettings, loadCredentials } from '../config/store.js'
import { resolveShellKind } from '../tools/shell.js'
import { findByName, getAgent, listSubagents } from '../agents/store.js'
import { setSessionAgent } from '../sessions/store.js'
import { mcpExtraTools } from '../mcp/manager.js'
import { startRun, subscribe, stopRun, isRunning } from '../agent/runs.js'
import type { ChatMessage, AgentEvent } from '../agent/types.js'

/** First @mention of a known top-level agent in a message, e.g. "@recon". */
function detectMention(text: string): string | null {
  const m = /(?:^|\s)@([a-zA-Z0-9][a-zA-Z0-9-]*)/.exec(text)
  return m ? m[1] : null
}

/**
 * Stream a session's background run to one client over SSE: replays buffered events
 * then streams live. The client disconnecting only unsubscribes — it never stops the
 * run. If there's no active run, sends a terminal event and closes.
 */
function streamRunToClient(sessionId: string, req: FastifyRequest, reply: FastifyReply): void {
  reply.hijack()
  const raw = reply.raw
  raw.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
  const send = (e: unknown) => {
    try {
      raw.write(`data: ${JSON.stringify(e)}\n\n`)
    } catch {
      /* client gone */
    }
  }
  const unsub = subscribe(sessionId, (ev) => {
    send(ev)
    if (ev.type === 'end') {
      try {
        raw.end()
      } catch {
        /* already closed */
      }
    }
  })
  if (!unsub) {
    send({ type: 'end' })
    try {
      raw.end()
    } catch {
      /* ignore */
    }
    return
  }
  req.raw.on('close', () => unsub())
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/sessions', async (req) => createSession(req.body as Record<string, unknown>))
  app.get('/api/sessions', async () => listSessions().map((s) => ({ ...s, running: isRunning(s.id) })))

  app.get('/api/sessions/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const session = getSession(id)
    if (!session) {
      reply.code(404)
      return { error: 'session not found' }
    }
    return { ...session, running: isRunning(id) }
  })

  // Rename / pin / move-to-group.
  app.patch('/api/sessions/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as { title?: string; pinned?: boolean; groupId?: string | null }
    const updated = updateSession(id, body)
    if (!updated) {
      reply.code(404)
      return { error: 'session not found' }
    }
    const { messages, ...rest } = updated
    return { ...rest, messageCount: messages.length }
  })

  app.delete('/api/sessions/:id', async (req) => {
    const { id } = req.params as { id: string }
    return { ok: await deleteSession(id) }
  })

  // Groups for organizing sessions in the sidebar.
  app.get('/api/groups', async () => listGroups())
  app.post('/api/groups', async (req, reply) => {
    const { name } = req.body as { name?: string }
    if (!name || !name.trim()) {
      reply.code(400)
      return { error: 'name required' }
    }
    return createGroup(name)
  })
  app.patch('/api/groups/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { name } = req.body as { name?: string }
    const g = renameGroup(id, String(name ?? ''))
    if (!g) {
      reply.code(404)
      return { error: 'group not found' }
    }
    return g
  })
  app.delete('/api/groups/:id', async (req) => {
    const { id } = req.params as { id: string }
    return { ok: deleteGroup(id) }
  })

  // Send a message; responds with a Server-Sent Events stream of agent events.
  app.post('/api/sessions/:id/messages', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { content, model, permission, effort, images } = req.body as {
      content: string
      model?: string
      permission?: string
      effort?: string
      images?: string[]
    }
    // Only accept data-URL images (pasted screenshots etc.), capped in count.
    const userImages = (Array.isArray(images) ? images : [])
      .filter((u) => typeof u === 'string' && u.startsWith('data:image/'))
      .slice(0, 8)
    const session = getSession(id)
    if (!session) {
      reply.code(404)
      return { error: 'session not found' }
    }

    const modelRef = model ?? session.model
    const [providerId, ...rest] = String(modelRef).split('/')
    const modelId = rest.join('/')
    const settings = await loadSettings()
    const creds = await loadCredentials()
    const provider = settings.providers.find((p) => p.id === providerId)
    if (!provider) {
      reply.code(400)
      return { error: `unknown provider: ${providerId || '(none)'} — configure one in Settings › Models` }
    }
    const contextWindow = provider.models.find((m) => m.id === modelId)?.contextWindow ?? provider.defaultContext ?? 0

    // Resolve the permission mode server-side: honour a valid value from the request
    // (the composer picker), but never silently fall back to "auto" when it's missing
    // or malformed — use the user's configured default so approvals can't be skipped.
    const effectivePermission = (['auto', 'manual', 'bypass'] as const).includes(permission as 'auto')
      ? (permission as string)
      : (settings.defaultPermission ?? 'auto')

    // @mention takes over the session: switch the active agent for this + all future turns.
    const mention = detectMention(String(content))
    if (mention) {
      const mentioned = findByName(mention, 'agent')
      if (mentioned) setSessionAgent(id, mentioned.id)
    }
    // Resolve the persona for this turn (active agent, or built-in default).
    const activeAgent = session.agentId ? getAgent(session.agentId) : undefined
    const persona = activeAgent?.systemPrompt
    const subagents = listSubagents().map((s) => ({
      name: s.name,
      description: s.description,
      systemPrompt: s.systemPrompt,
    }))

    // Name the session from the first prompt (LLM summary, heuristic fallback).
    const wantTitle = session.messages.length === 0 && isUnnamed(session)

    const userMsg: ChatMessage = { role: 'user', content: String(content) }
    const toStore: ChatMessage[] = [userMsg]
    // Correlate a tool call's args (from tool_call/approval_request) with its result,
    // so the run's tool activity survives a reload and re-renders in the transcript.
    const toolMeta = new Map<string, { name: string; args: string }>()

    const runOpts = {
      baseUrl: provider.baseUrl,
      apiKey: creds[providerId],
      headers: provider.headers,
      model: modelId,
      cwd: session.workspace,
      history: session.messages,
      userMessage: String(content),
      userImages,
      contextWindow,
      permission: effectivePermission,
      effort,
      shell: resolveShellKind(settings.agentEnvironment, settings.terminalShell),
      disabledTools: settings.disabledTools,
      persona,
      subagents,
      extraTools: mcpExtraTools(),
    }

    // The run's event source: echo the user message (so a client reconnecting
    // mid-run rebuilds the bubble), run the agent, then (first turn) title it.
    const make = (signal: AbortSignal): AsyncGenerator<AgentEvent> =>
      (async function* () {
        const echo: AgentEvent = {
          type: 'user_message',
          content: String(content),
          ...(userImages.length ? { images: userImages } : {}),
        }
        yield echo
        yield* runAgent({ ...runOpts, signal })
        if (wantTitle) {
          const title = await Promise.race<string>([
            generateTitle({
              baseUrl: provider.baseUrl,
              apiKey: creds[providerId],
              headers: provider.headers,
              model: modelId,
              firstMessage: String(content),
              signal,
            }).catch(() => ''),
            new Promise<string>((resolve) => setTimeout(() => resolve(''), 8000)),
          ])
          if (title) {
            setTitle(id, title)
            yield { type: 'session_title', title }
          }
        }
      })()

    // Start the run in the BACKGROUND — it runs to completion even if this client
    // disconnects (navigates to another session, closes the tab, etc.).
    startRun(id, make, {
      onEvent: (ev) => {
        if (ev.type === 'assistant_message') {
          toStore.push({ role: 'assistant', content: ev.content })
        } else if (ev.type === 'tool_call' || ev.type === 'approval_request') {
          toolMeta.set(ev.id, { name: ev.name, args: ev.arguments })
        } else if (ev.type === 'tool_result') {
          const meta = toolMeta.get(ev.id) ?? { name: ev.name, args: '' }
          // Display-only record (kept out of the model context — see loop.ts).
          toStore.push({
            role: 'tool',
            content: JSON.stringify({ name: meta.name || ev.name, args: meta.args, result: ev.result }),
          })
        }
      },
      onComplete: () => addMessages(id, toStore),
    })

    // Stream this run to the current client. Disconnecting unsubscribes but does
    // NOT stop the run (that's POST /stop, driven by the Stop button).
    streamRunToClient(id, req, reply)
  })

  // Reconnect to a session's in-progress run (replays buffered events, then live).
  app.get('/api/sessions/:id/stream', async (req, reply) => {
    streamRunToClient((req.params as { id: string }).id, req, reply)
  })

  // Explicitly stop a running session (the Stop button).
  app.post('/api/sessions/:id/stop', async (req) => ({
    stopped: stopRun((req.params as { id: string }).id),
  }))

  // Resolve a pending Manual-mode approval.
  app.post('/api/sessions/:id/approve', async (req) => {
    const { callId, approved } = req.body as { callId: string; approved: boolean }
    return { ok: resolveApproval(callId, Boolean(approved)) }
  })
}
