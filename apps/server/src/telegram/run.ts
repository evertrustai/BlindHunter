import { loadSettings, loadCredentials } from '../config/store.js'
import { resolveShellKind } from '../tools/shell.js'
import { getAgent, listSubagents } from '../agents/store.js'
import { mcpExtraTools } from '../mcp/manager.js'
import { runAgent } from '../agent/loop.js'
import { startRun, subscribe, stopRun, isRunning } from '../agent/runs.js'
import { createSession, getSession, addMessages, listSessions } from '../sessions/store.js'
import { recordUsage } from '../usage/store.js'
import { getValidToken } from '../auth/claude.js'
import { getValidToken as getCodexToken, getAccountId as getCodexAccountId } from '../auth/codex.js'
import type { ChatMessage, AgentEvent } from '../agent/types.js'
import { homedir } from 'node:os'

/** Telegram chat id -> BlindHunter session id, so a chat keeps its conversation. */
const chatSessions = new Map<number, string>()

export function resetChatSession(chatId: number): void {
  const id = chatSessions.get(chatId)
  if (id) stopRun(id)
  chatSessions.delete(chatId)
}

export function stopChat(chatId: number): boolean {
  const id = chatSessions.get(chatId)
  return id ? stopRun(id) : false
}

export function chatIsRunning(chatId: number): boolean {
  const id = chatSessions.get(chatId)
  return id ? isRunning(id) : false
}

/** The session this chat is currently pointed at (for marking the active one in a list). */
export function getChatSessionId(chatId: number): string | undefined {
  return chatSessions.get(chatId)
}

/** Recent sessions (any origin — web or Telegram), newest first, for the /sessions list. */
export function listRecentSessions(limit = 12): { id: string; title: string; running: boolean }[] {
  return listSessions()
    .slice(0, limit)
    .map((s) => ({ id: s.id, title: s.title || 'Untitled', running: isRunning(s.id) }))
}

/** Every "providerId/modelId" across enabled providers, for the /model picker. */
export async function listEnabledModels(): Promise<{ ref: string; label: string }[]> {
  const settings = await loadSettings()
  const out: { ref: string; label: string }[] = []
  for (const p of settings.providers) {
    if (!p.enabled) continue
    for (const m of p.models) out.push({ ref: `${p.id}/${m.id}`, label: `${p.displayName} · ${m.name || m.id}` })
  }
  return out
}

/** The model a Telegram run would use right now (TG default → global default → first enabled). */
export async function currentTelegramModel(): Promise<{ ref: string; label: string } | null> {
  const settings = await loadSettings()
  const firstEnabled = settings.providers.find((p) => p.enabled && p.models.length)
  const ref =
    settings.telegram?.defaultModel ||
    settings.defaultModel ||
    (firstEnabled ? `${firstEnabled.id}/${firstEnabled.models[0].id}` : '')
  if (!ref) return null
  const found = (await listEnabledModels()).find((m) => m.ref === ref)
  return found ?? { ref, label: ref }
}

/** The folder a Telegram run would use right now. */
export async function currentTelegramWorkspace(): Promise<string> {
  const settings = await loadSettings()
  return settings.telegram?.defaultWorkspace || homedir()
}

/** Distinct workspaces seen across recent sessions, as quick-pick suggestions for /workspace. */
export function listRecentWorkspaces(limit = 6): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of listSessions()) {
    if (s.workspace && !seen.has(s.workspace)) {
      seen.add(s.workspace)
      out.push(s.workspace)
      if (out.length >= limit) break
    }
  }
  return out
}

/**
 * Point this chat at an existing session so the next prompt continues it. Works for any
 * session, including ones started in the BlindHunter web UI. Returns a short preview.
 */
export function setChatSession(chatId: number, sessionId: string): { ok: boolean; title?: string; preview?: string } {
  const s = getSession(sessionId)
  if (!s) return { ok: false }
  chatSessions.set(chatId, sessionId)
  const lastAssistant = [...s.messages]
    .reverse()
    .find((m) => m.role === 'assistant' && typeof m.content === 'string' && m.content.trim())
  const preview =
    lastAssistant && typeof lastAssistant.content === 'string' ? lastAssistant.content.slice(0, 350) : undefined
  return { ok: true, title: s.title || 'Untitled', preview }
}

export interface TurnCallbacks {
  onProgress: (status: string) => void
  onFinal: (text: string) => void
  onError: (message: string) => void
}

/** Run one agent turn for a Telegram prompt. Resolves when the run ends. */
export async function runTelegramTurn(chatId: number, text: string, cb: TurnCallbacks): Promise<void> {
  const settings = await loadSettings()
  const tg = settings.telegram

  // Pick the model: Telegram default, else global default, else the first enabled model.
  const firstEnabled = settings.providers.find((p) => p.enabled && p.models.length)
  const modelRef =
    tg?.defaultModel ||
    settings.defaultModel ||
    (firstEnabled ? `${firstEnabled.id}/${firstEnabled.models[0].id}` : '')
  const [providerId, ...rest] = String(modelRef).split('/')
  const modelId = rest.join('/')
  const provider = settings.providers.find((p) => p.id === providerId && p.enabled)
  if (!provider) {
    cb.onError('No model is configured for Telegram. Set one in Settings › Integrations.')
    return
  }

  const creds = await loadCredentials()
  let apiKey: string | undefined
  let managedHeaders: Record<string, string> | undefined
  if (provider.protocol === 'anthropic') {
    apiKey = (await getValidToken()) ?? undefined
    if (!apiKey) {
      cb.onError('The Claude subscription for this model is not connected.')
      return
    }
  } else if (provider.protocol === 'codex') {
    apiKey = (await getCodexToken()) ?? undefined
    if (!apiKey) {
      cb.onError('The ChatGPT subscription for this model is not connected.')
      return
    }
    const accountId = await getCodexAccountId()
    if (accountId) managedHeaders = { 'chatgpt-account-id': accountId }
  } else {
    apiKey = creds[providerId]
  }
  const contextWindow = provider.models.find((m) => m.id === modelId)?.contextWindow ?? provider.defaultContext ?? 0

  // One session per chat (created on first message, reused after).
  let sessionId = chatSessions.get(chatId)
  let session = sessionId ? getSession(sessionId) : undefined
  if (!session) {
    const workspace = tg?.defaultWorkspace || homedir()
    session = createSession({ workspace, model: modelRef, preset: 'pentest', title: `Telegram chat ${chatId}` })
    sessionId = session.id
    chatSessions.set(chatId, sessionId)
  }

  const activeAgent = session.agentId ? getAgent(session.agentId) : undefined
  const subagents = listSubagents().map((s) => ({ name: s.name, description: s.description, systemPrompt: s.systemPrompt }))

  const toStore: ChatMessage[] = [{ role: 'user', content: text }]
  const toolMeta = new Map<string, { name: string; args: string }>()

  const runOpts = {
    baseUrl: provider.baseUrl,
    apiKey,
    protocol: provider.protocol,
    headers: managedHeaders ? { ...provider.headers, ...managedHeaders } : provider.headers,
    model: modelId,
    cwd: session.workspace,
    history: session.messages,
    userMessage: text,
    maxSteps:
      typeof settings.maxSteps === 'number' && settings.maxSteps > 0 ? Math.min(Math.floor(settings.maxSteps), 1000) : undefined,
    contextWindow,
    // Telegram runs honour the configured default permission (not the composer picker).
    permission: settings.defaultPermission ?? 'auto',
    shell: resolveShellKind(settings.agentEnvironment, settings.terminalShell),
    disabledTools: settings.disabledTools,
    persona: activeAgent?.systemPrompt,
    subagents,
    extraTools: mcpExtraTools(),
  }

  const make = (signal: AbortSignal): AsyncGenerator<AgentEvent> => runAgent({ ...runOpts, signal })

  await new Promise<void>((resolve) => {
    startRun(sessionId as string, make, {
      onEvent: (ev) => {
        if (ev.type === 'usage') recordUsage(modelRef, ev.prompt, ev.completion, ev.total)
        else if (ev.type === 'assistant_message') toStore.push({ role: 'assistant', content: ev.content })
        else if (ev.type === 'tool_call' || ev.type === 'approval_request') toolMeta.set(ev.id, { name: ev.name, args: ev.arguments })
        else if (ev.type === 'tool_result') {
          const meta = toolMeta.get(ev.id) ?? { name: ev.name, args: '' }
          toStore.push({ role: 'tool', content: JSON.stringify({ name: meta.name || ev.name, args: meta.args, result: ev.result }) })
        }
      },
      onComplete: () => addMessages(sessionId as string, toStore),
    })

    let finalText = ''
    let steps = 0
    const unsub = subscribe(sessionId as string, (ev) => {
      switch (ev.type) {
        case 'assistant_message':
          if (ev.content?.trim()) finalText = ev.content
          break
        case 'tool_call':
          steps++
          cb.onProgress(`🔧 running ${ev.name}… (step ${steps})`)
          break
        case 'error':
          cb.onError(ev.message || 'error')
          break
        case 'end':
          cb.onFinal(finalText || '(done — no text reply)')
          unsub?.()
          resolve()
          break
      }
    })
    if (!unsub) resolve()
  })
}
