export interface ProviderModel {
  id: string
  name?: string
  contextWindow?: number
}

export interface Provider {
  id: string
  displayName: string
  baseUrl: string
  protocol: string
  defaultContext?: number
  headers?: Record<string, string>
  models: ProviderModel[]
  enabled: boolean
  hasKey?: boolean
}

export interface ModelRef {
  ref: string
  providerId: string
  providerName: string
  id: string
  name: string
  contextWindow?: number
}

export interface DirEntry {
  name: string
  type: 'dir' | 'file'
  path: string
}

export interface FsList {
  path: string
  parent: string | null
  entries: DirEntry[]
}

export interface Session {
  id: string
  title: string
  workspace: string
  model: string
  preset: string
  createdAt: number
  updatedAt?: number
  pinned?: boolean
  groupId?: string | null
  agentId?: string | null
  messageCount?: number
}

export interface Agent {
  id: string
  name: string
  description: string
  systemPrompt: string
  kind: 'agent' | 'subagent'
  builtin?: boolean
  createdAt: number
}

export interface Group {
  id: string
  name: string
  createdAt: number
}

export interface AppSettings {
  theme: 'dark' | 'light'
  language: string
  agentEnvironment: 'windows' | 'wsl'
  terminalShell: 'powershell' | 'gitbash' | 'wsl'
  defaultPermission: 'auto' | 'manual' | 'bypass'
  importAutosync: boolean
  logLevel: 'info' | 'debug' | 'trace'
  experimental: boolean
  browserInsecureCerts?: boolean
  disabledTools: string[]
  defaultModel?: string
}

export interface PluginTool {
  name: string
  description: string
  enabled: boolean
}

export interface McpServer {
  id: string
  name: string
  transport: 'stdio' | 'sse' | 'http'
  command?: string
  args?: string[]
  url?: string
  enabled: boolean
  createdAt: number
  // live connection status (from the server):
  status?: string
  toolCount?: number
  error?: string
  tools?: string[]
}

export interface BrowserTab {
  id: string
  url: string
  title: string
  active: boolean
  loading: boolean
}

export interface ImportResult {
  count?: number
  imported?: number
  group?: string
  message?: string
}

export interface StoredMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export interface PlanStep {
  title: string
  status: 'pending' | 'in_progress' | 'completed'
}

export interface AgentEvent {
  type:
    | 'assistant_delta'
    | 'tool_call'
    | 'approval_request'
    | 'tool_result'
    | 'assistant_message'
    | 'assistant_retract'
    | 'usage'
    | 'session_title'
    | 'plan'
    | 'done'
    | 'error'
  text?: string
  id?: string
  name?: string
  arguments?: string
  result?: string
  content?: string
  message?: string
  prompt?: number
  completion?: number
  total?: number
  context?: number
  steps?: PlanStep[]
}

export interface Usage {
  prompt: number
  completion: number
  total: number
  context: number
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`)
  return (await res.json()) as T
}

const jsonHeaders = { 'content-type': 'application/json' }

export const api = {
  getProviders: () => fetch('/api/providers').then((r) => json<Provider[]>(r)),
  addProvider: (p: Partial<Provider> & { apiKey?: string }) =>
    fetch('/api/providers', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(p) }).then((r) => json(r)),
  deleteProvider: (id: string) => fetch(`/api/providers/${id}`, { method: 'DELETE' }).then((r) => json(r)),
  fetchProviderModels: async (body: {
    baseUrl: string
    apiKey?: string
    headers?: Record<string, string>
    providerId?: string
  }): Promise<{ models?: { id: string; grade?: string; vision?: boolean }[]; error?: string }> => {
    const r = await fetch('/api/providers/fetch-models', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) })
    return (await r.json()) as { models?: { id: string; grade?: string; vision?: boolean }[]; error?: string }
  },
  getModels: () => fetch('/api/models').then((r) => json<ModelRef[]>(r)),
  listDir: (path?: string) =>
    fetch(`/api/fs/list${path ? `?path=${encodeURIComponent(path)}` : ''}`).then((r) => json<FsList>(r)),
  pickFolder: () =>
    fetch('/api/fs/pick-folder', { method: 'POST' }).then((r) => json<{ path: string | null; error?: string }>(r)),
  createSession: (input: Partial<Session>) =>
    fetch('/api/sessions', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }).then((r) =>
      json<Session>(r),
    ),
  getSessions: () => fetch('/api/sessions').then((r) => json<Session[]>(r)),
  getSession: (id: string) =>
    fetch(`/api/sessions/${id}`).then((r) => json<Session & { messages: StoredMessage[] }>(r)),
  approveToolCall: (sessionId: string, callId: string, approved: boolean) =>
    fetch(`/api/sessions/${sessionId}/approve`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ callId, approved }),
    }).then((r) => json(r)),
  updateSession: (id: string, patch: { title?: string; pinned?: boolean; groupId?: string | null }) =>
    fetch(`/api/sessions/${id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(patch) }).then((r) =>
      json<Session>(r),
    ),
  deleteSession: (id: string) => fetch(`/api/sessions/${id}`, { method: 'DELETE' }).then((r) => json(r)),
  getGroups: () => fetch('/api/groups').then((r) => json<Group[]>(r)),
  createGroup: (name: string) =>
    fetch('/api/groups', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ name }) }).then((r) =>
      json<Group>(r),
    ),
  renameGroup: (id: string, name: string) =>
    fetch(`/api/groups/${id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ name }) }).then((r) =>
      json<Group>(r),
    ),
  deleteGroup: (id: string) => fetch(`/api/groups/${id}`, { method: 'DELETE' }).then((r) => json(r)),
  getSettings: () => fetch('/api/settings').then((r) => json<AppSettings>(r)),
  updateSettings: (patch: Partial<AppSettings>) =>
    fetch('/api/settings', { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(patch) }).then((r) =>
      json<AppSettings>(r),
    ),
  importFrom: (source: string, dryRun: boolean) =>
    fetch(`/api/import/${source}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ dryRun }) }).then(
      (r) => json<ImportResult>(r),
    ),
  getSystemInfo: () => fetch('/api/system/info').then((r) => json<{ home: string; settingsFile: string; platform: string }>(r)),
  checkUpdate: () =>
    fetch('/api/system/check-update').then((r) =>
      json<{
        current: string
        latest: string | null
        updateAvailable: boolean
        url: string
        state: 'latest' | 'update' | 'no-releases' | 'error'
        error?: string
      }>(r),
    ),
  openConfig: (target: 'config-file' | 'config-dir') =>
    fetch('/api/system/open', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ target }) }).then((r) =>
      json<{ ok?: boolean; path?: string; error?: string }>(r),
    ),
  getPlugins: () => fetch('/api/plugins').then((r) => json<{ tools: PluginTool[] }>(r)),
  getAgents: () => fetch('/api/agents').then((r) => json<Agent[]>(r)),
  createAgent: (input: { name: string; description?: string; systemPrompt: string; kind: 'agent' | 'subagent' }) =>
    fetch('/api/agents', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }).then((r) =>
      json<Agent>(r),
    ),
  updateAgent: (
    id: string,
    patch: { name?: string; description?: string; systemPrompt?: string; kind?: 'agent' | 'subagent' },
  ) =>
    fetch(`/api/agents/${id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(patch) }).then((r) =>
      json<Agent>(r),
    ),
  deleteAgent: (id: string) => fetch(`/api/agents/${id}`, { method: 'DELETE' }).then((r) => json(r)),
  getMcp: () => fetch('/api/mcp').then((r) => json<McpServer[]>(r)),
  addMcp: (input: Partial<McpServer>) =>
    fetch('/api/mcp', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }).then((r) =>
      json<McpServer>(r),
    ),
  updateMcp: (id: string, patch: Partial<McpServer>) =>
    fetch(`/api/mcp/${id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(patch) }).then((r) =>
      json<McpServer>(r),
    ),
  deleteMcp: (id: string) => fetch(`/api/mcp/${id}`, { method: 'DELETE' }).then((r) => json(r)),
  reconnectMcp: (id: string) =>
    fetch(`/api/mcp/${id}/reconnect`, { method: 'POST' }).then((r) => json<McpServer>(r)),

  // ---- in-app browser ----
  browserTabs: () => fetch('/api/browser/tabs').then((r) => json<{ tabs: BrowserTab[] }>(r)),
  browserNewTab: (url?: string) =>
    fetch('/api/browser/tabs', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ url }) }).then((r) =>
      json<BrowserTab | { error: string }>(r),
    ),
  browserActivate: (id: string) => fetch(`/api/browser/tabs/${id}/activate`, { method: 'POST' }).then((r) => json(r)),
  browserCloseTab: (id: string) => fetch(`/api/browser/tabs/${id}`, { method: 'DELETE' }).then((r) => json(r)),
  browserNavigate: (id: string, target: string) =>
    fetch(`/api/browser/tabs/${id}/navigate`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ target }) }).then(
      (r) => json<BrowserTab | { error: string }>(r),
    ),
  browserClick: (id: string, x: number, y: number) =>
    fetch(`/api/browser/tabs/${id}/click`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ x, y }) }).then(
      (r) => json(r),
    ),
  browserType: (id: string, text: string) =>
    fetch(`/api/browser/tabs/${id}/type`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ text }) }).then(
      (r) => json(r),
    ),
  browserKey: (id: string, key: string) =>
    fetch(`/api/browser/tabs/${id}/key`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ key }) }).then((r) =>
      json(r),
    ),
  browserScroll: (id: string, dx: number, dy: number) =>
    fetch(`/api/browser/tabs/${id}/scroll`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ dx, dy }) }).then(
      (r) => json(r),
    ),
  /** Cache-busted screenshot URL for an <img> src (Vite proxies /api to the backend). */
  browserShotUrl: (id: string) => `/api/browser/tabs/${id}/screenshot?t=${Date.now()}`,
}

/** POST a message and stream agent events (SSE) back through `onEvent`. */
export async function streamMessage(
  sessionId: string,
  content: string,
  model: string,
  permission: string,
  effort: string,
  onEvent: (e: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ content, model, permission, effort }),
    signal,
  })
  if (!res.body) throw new Error('no response stream')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let sep: number
    while ((sep = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, sep)
      buf = buf.slice(sep + 2)
      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue
        try {
          onEvent(JSON.parse(line.slice(5).trim()) as AgentEvent)
        } catch {
          // ignore malformed line
        }
      }
    }
  }
}

/** Basename of a filesystem path (handles both / and \\). */
export function baseName(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? p
}
