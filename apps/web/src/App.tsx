import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { ConsoleView } from './views/ConsoleView'
import { ChatView } from './views/ChatView'
import { BrowserView } from './views/BrowserView'
import { SettingsView } from './views/SettingsView'
import { AgentsManager } from './components/AgentsManager'
import { BypassModal } from './components/Modal'
import { api } from './lib/api'
import { applyLanguage, applyTheme } from './lib/appearance'
import type { SettingsTabId } from './lib/commands'
import type { Agent, Group, ModelRef, Session } from './lib/api'

type View = 'console' | 'chat' | 'settings' | 'browser'

/** localStorage helpers that no-op safely (private mode / disabled storage). */
function loadLS(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function saveLS(key: string, val: string | null): void {
  try {
    if (val === null) localStorage.removeItem(key)
    else localStorage.setItem(key, val)
  } catch {
    // storage unavailable — ignore
  }
}

/** Workspaces the user has already accepted Bypass/Full-access for (per path). */
const BYPASS_ACK_KEY = 'bh.bypassAcked'
function bypassAcked(ws: string): boolean {
  try {
    return (JSON.parse(loadLS(BYPASS_ACK_KEY) ?? '[]') as string[]).includes(ws)
  } catch {
    return false
  }
}
function recordBypassAck(ws: string): void {
  try {
    const set = new Set(JSON.parse(loadLS(BYPASS_ACK_KEY) ?? '[]') as string[])
    set.add(ws)
    saveLS(BYPASS_ACK_KEY, JSON.stringify([...set]))
  } catch {
    // ignore
  }
}

export function App() {
  const [view, setView] = useState<View>('console')
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>('general')
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentsView, setAgentsView] = useState<'agent' | 'subagent' | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [models, setModels] = useState<ModelRef[]>([])
  // Console selections persist across refresh/restart. Sessions keep their OWN
  // workspace (stored server-side), so this is only the default for new sessions.
  const [selectedModel, setSelectedModel] = useState<string | null>(() => loadLS('bh.model'))
  const [workspace, setWorkspace] = useState<string | null>(() => loadLS('bh.workspace'))
  const [session, setSession] = useState<Session | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<string[] | undefined>(undefined)
  const [sessions, setSessions] = useState<Session[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  // Permission is seeded from the Settings › Permissions default (below); the
  // composer picker overrides it per session (in-memory, not persisted).
  const [permission, setPermission] = useState('auto')
  const [effort, setEffort] = useState(() => loadLS('bh.effort') ?? 'high')
  // When switching a workspace to Bypass for the first time, hold the pending
  // workspace here to show the confirmation modal ({ ws } | null).
  const [bypassAsk, setBypassAsk] = useState<{ ws: string | null } | null>(null)

  useEffect(() => saveLS('bh.workspace', workspace), [workspace])
  useEffect(() => saveLS('bh.model', selectedModel), [selectedModel])
  useEffect(() => saveLS('bh.effort', effort), [effort])

  async function loadModels() {
    try {
      const m = await api.getModels()
      setModels(m)
      // Keep the persisted/current model if it still exists, else pick the first.
      setSelectedModel((cur) => (cur && m.some((x) => x.ref === cur) ? cur : (m[0]?.ref ?? null)))
    } catch {
      // server not up yet
    }
  }

  async function loadSessions() {
    try {
      setSessions(await api.getSessions())
    } catch {
      // ignore
    }
  }

  async function loadGroups() {
    try {
      setGroups(await api.getGroups())
    } catch {
      // ignore
    }
  }

  async function loadAgents() {
    try {
      setAgents(await api.getAgents())
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadModels()
    void loadSessions()
    void loadGroups()
    void loadAgents()
    // Apply the persisted theme + language app-wide on startup.
    void api
      .getSettings()
      .then((s) => {
        applyTheme(s.theme)
        applyLanguage(s.language)
        setPermission(s.defaultPermission ?? 'auto')
      })
      .catch(() => {
        // server not up — keep the default dark theme
      })
  }, [])

  // Keep the sidebar's per-session run indicators (the yellow dot) fresh, so a run
  // progressing or finishing in the background shows up even while viewing another
  // session. Cheap local poll; `running` changes don't reorder the list.
  useEffect(() => {
    const t = window.setInterval(() => {
      api.getSessions().then(setSessions).catch(() => {})
    }, 3000)
    return () => window.clearInterval(t)
  }, [])

  async function pinSession(s: Session, pinned: boolean) {
    await api.updateSession(s.id, { pinned })
    await loadSessions()
  }
  async function renameSession(s: Session, title: string) {
    await api.updateSession(s.id, { title })
    await loadSessions()
  }
  async function moveSession(s: Session, groupId: string | null) {
    await api.updateSession(s.id, { groupId })
    await loadSessions()
  }
  async function removeSession(s: Session) {
    await api.deleteSession(s.id)
    if (session?.id === s.id) {
      setSession(null)
      setView('console')
    }
    await loadSessions()
  }
  async function makeGroup(name: string): Promise<Group> {
    const g = await api.createGroup(name)
    await loadGroups()
    return g
  }
  async function renameGroupH(id: string, name: string) {
    await api.renameGroup(id, name)
    await loadGroups()
  }
  async function removeGroup(id: string) {
    await api.deleteGroup(id)
    await Promise.all([loadGroups(), loadSessions()])
  }

  async function handleSend(prompt: string, images?: string[]) {
    if (!workspace || !selectedModel) return
    // No title — the backend auto-names the session from the first prompt.
    const s = await api.createSession({ workspace, model: selectedModel })
    setSession(s)
    setPending(prompt)
    setPendingImages(images)
    setView('chat')
    void loadSessions()
  }

  function newSession() {
    setSession(null)
    setPending(null)
    setView('console')
    void loadSessions()
  }

  function openSession(s: Session) {
    setSession(s)
    setPending(null)
    setView('chat')
  }

  /** Jump to Settings, optionally on a specific tab — used by the sidebar and "/" commands. */
  function openSettings(tab: SettingsTabId = 'general') {
    setSettingsTab(tab)
    setView('settings')
  }

  /**
   * Permission changes flow through here. Switching to Bypass (Full access) prompts
   * a one-time confirmation per workspace; every other change applies immediately.
   */
  function requestPermission(id: string) {
    if (id === 'bypass') {
      const ws = view === 'chat' && session ? session.workspace : workspace
      if (!ws || !bypassAcked(ws)) {
        setBypassAsk({ ws: ws ?? null })
        return
      }
    }
    setPermission(id)
  }
  function confirmBypass() {
    if (bypassAsk?.ws) recordBypassAck(bypassAsk.ws)
    setPermission('bypass')
    setBypassAsk(null)
  }

  /** Pick a folder and open a fresh session in it (the "+" next to Workspaces). */
  async function addWorkspace() {
    try {
      const { path } = await api.pickFolder()
      if (!path) return
      setWorkspace(path)
      newSession()
    } catch {
      // dialog unavailable — ignore
    }
  }

  return (
    <div className={sidebarCollapsed ? 'app collapsed' : 'app'}>
      {sidebarCollapsed ? (
        <button className="expand-side" aria-label="Show sidebar" title="Show sidebar" onClick={() => setSidebarCollapsed(false)}>
          ⟩⟨
        </button>
      ) : (
        <Sidebar
          sessions={sessions}
          groups={groups}
          activeId={session?.id}
          onNew={newSession}
          onOpenSettings={openSettings}
          onOpenAgents={setAgentsView}
          onOpen={openSession}
          onPin={pinSession}
          onRename={renameSession}
          onMove={moveSession}
          onDelete={removeSession}
          onCreateGroup={makeGroup}
          onRenameGroup={renameGroupH}
          onDeleteGroup={removeGroup}
          onCollapse={() => setSidebarCollapsed(true)}
          onAddWorkspace={addWorkspace}
        />
      )}
      <main className="main">
        {view === 'console' && (
          <ConsoleView
            models={models}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            workspace={workspace}
            onSelectWorkspace={setWorkspace}
            onSend={handleSend}
            permission={permission}
            onPermission={requestPermission}
            effort={effort}
            onEffort={setEffort}
            onOpenSettings={openSettings}
            agents={agents}
            onOpenAgents={setAgentsView}
            onBrowser={() => setView('browser')}
          />
        )}
        {view === 'chat' && session && (
          <ChatView
            key={session.id}
            session={session}
            model={session.model || selectedModel || ''}
            models={models}
            initialPrompt={pending}
            initialImages={pendingImages}
            onConsumePrompt={() => {
              setPending(null)
              setPendingImages(undefined)
            }}
            onUpdated={loadSessions}
            permission={permission}
            onPermission={requestPermission}
            effort={effort}
            onEffort={setEffort}
            onOpenSettings={openSettings}
            onNewSession={newSession}
            agents={agents}
            onOpenAgents={setAgentsView}
            onBrowser={() => setView('browser')}
          />
        )}
        {view === 'browser' && <BrowserView onClose={() => setView(session ? 'chat' : 'console')} />}
        {view === 'settings' && (
          <SettingsView
            initialTab={settingsTab}
            onClose={() => {
              void loadModels()
              setView('console')
            }}
            onDataChanged={() => {
              void loadSessions()
              void loadGroups()
            }}
          />
        )}
      </main>

      {agentsView && (
        <AgentsManager
          initialKind={agentsView}
          onClose={() => {
            setAgentsView(null)
            void loadAgents()
          }}
        />
      )}

      {bypassAsk && (
        <BypassModal
          workspace={bypassAsk.ws}
          onCancel={() => setBypassAsk(null)}
          onConfirm={confirmBypass}
        />
      )}
    </div>
  )
}
