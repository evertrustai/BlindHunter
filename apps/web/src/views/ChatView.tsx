import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, streamMessage, subscribeStream, baseName } from '../lib/api'
import type { ModelRef, Session, Usage, AgentEvent } from '../lib/api'
import { ComposerBar } from '../components/ComposerBar'
import { Attachments } from '../components/Attachments'
import { SlashMenu } from '../components/SlashMenu'
import { ProgressPanel } from '../components/ProgressPanel'
import { Markdown } from '../components/Markdown'
import { useComposer } from '../hooks/useComposer'
import { useSlashMenu } from '../hooks/useSlashMenu'
import { useMentionMenu } from '../hooks/useMentionMenu'
import { SLASH_COMMANDS } from '../lib/commands'
import type { SlashCommand, SettingsTabId } from '../lib/commands'
import type { Agent, PlanStep } from '../lib/api'

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

// A session's workspace is fixed once created, so "open-folder" doesn't apply here.
const CHAT_COMMANDS = SLASH_COMMANDS.filter((c) => c.id !== 'open-folder')

type Item =
  | { kind: 'user'; text: string; images?: string[] }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; id: string; name: string; args: string; result?: string; approval?: 'pending' | 'approved' | 'rejected' }
  | { kind: 'error'; text: string }

const MAX_OUT = 4000

/** A clean, human-readable label for a tool call (no raw args JSON). */
function toolTitle(name: string, argsJson: string): { title: string; cmd?: string } {
  let a: Record<string, unknown> = {}
  try {
    a = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {}
  } catch {
    /* ignore malformed args */
  }
  const s = (k: string) => (typeof a[k] === 'string' ? (a[k] as string) : '')
  switch (name) {
    case 'bash':
      return { title: 'bash', cmd: s('command') }
    case 'read_file':
      return { title: `read  ${s('path')}` }
    case 'write_file':
      return { title: `write  ${s('path')}` }
    case 'edit_file':
      return { title: `edit  ${s('path')}` }
    case 'list_dir':
      return { title: `list  ${s('path') || '.'}` }
    case 'spawn_subagent':
      return { title: `⇢ subagent  ${s('agent') || 'worker'}`, cmd: s('task') }
    default:
      return { title: name }
  }
}

type ToolItem = Extract<Item, { kind: 'tool' }>

/** A concise, human summary for a run of consecutive tool calls (e.g. "Ran 3 commands"). */
function summarizeTools(tools: ToolItem[]): string {
  const argOf = (t: ToolItem): Record<string, unknown> => {
    try {
      return t.args ? (JSON.parse(t.args) as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  const bash = tools.filter((t) => t.name === 'bash').length
  const edits = tools.filter((t) => t.name === 'write_file' || t.name === 'edit_file')
  const reads = tools.filter((t) => t.name === 'read_file').length
  const lists = tools.filter((t) => t.name === 'list_dir').length
  const subs = tools.filter((t) => t.name === 'spawn_subagent').length
  const browses = tools.filter((t) => t.name.startsWith('browser_')).length
  const parts: string[] = []
  if (edits.length === 1) {
    const p = argOf(edits[0]).path
    parts.push(`edited ${typeof p === 'string' ? baseName(p) : 'a file'}`)
  } else if (edits.length > 1) parts.push(`edited ${edits.length} files`)
  if (bash) parts.push(bash === 1 ? 'ran a command' : `ran ${bash} commands`)
  if (browses) parts.push(browses === 1 ? 'used the browser' : `used the browser ${browses}×`)
  if (reads) parts.push(reads === 1 ? 'read a file' : `read ${reads} files`)
  if (lists) parts.push(lists === 1 ? 'listed a directory' : `listed ${lists} directories`)
  if (subs) parts.push(subs === 1 ? 'ran a subagent' : `ran ${subs} subagents`)
  if (!parts.length) parts.push(`ran ${tools.length} ${tools.length === 1 ? 'tool' : 'tools'}`)
  const s = parts.join(', ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** A collapsed, borderless summary line for a run of tool calls; expands to clean output. */
const ToolGroup = memo(function ToolGroup({ tools }: { tools: ToolItem[] }) {
  const [open, setOpen] = useState(false)
  const running = tools.some((t) => t.result === undefined && t.approval !== 'rejected')
  return (
    <div className="toolg">
      <button className="toolg-head" onClick={() => setOpen((o) => !o)}>
        <span className="toolg-label">{summarizeTools(tools)}</span>
        {running && <span className="toolg-spin" />}
        <span className={open ? 'toolg-cv open' : 'toolg-cv'}>›</span>
      </button>
      {open && (
        <div className="toolg-body">
          {tools.map((t, i) => {
            const { title, cmd } = toolTitle(t.name, t.args)
            const raw = t.result ?? ''
            const out = raw.length > MAX_OUT ? `${raw.slice(0, MAX_OUT)}\n… (${raw.length - MAX_OUT} more chars)` : raw
            const note =
              t.approval === 'rejected' ? ' · rejected' : t.result === undefined ? ' · running' : ''
            return (
              <div className="toolg-item" key={t.id || i}>
                <div className="toolg-cap">
                  {title}
                  {note}
                </div>
                <pre className="toolg-pre">
                  {cmd ? (
                    <span className="toolg-cmd">
                      <span className="pr">$</span> {cmd}
                      {t.result !== undefined ? '\n' : ''}
                    </span>
                  ) : null}
                  {t.result !== undefined ? out : null}
                </pre>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

/** A pending manual-approval request — shown on its own so the user can act. */
const ToolApproval = memo(function ToolApproval({
  item,
  onApprove,
}: {
  item: ToolItem
  onApprove: (id: string, approved: boolean) => void
}) {
  const { title, cmd } = toolTitle(item.name, item.args)
  return (
    <div className="toolapp">
      <div className="toolapp-head">
        <span className="tt">{title}</span>
        <span className="st">⏸ needs approval</span>
      </div>
      {cmd && (
        <pre className="toolg-pre">
          <span className="toolg-cmd">
            <span className="pr">$</span> {cmd}
          </span>
        </pre>
      )}
      <span className="ta-note">
        Manual mode — approve to run this {item.name === 'bash' ? 'command' : 'action'}.
      </span>
      <div className="ta-btns">
        <button className="ta-ok" onClick={() => onApprove(item.id, true)}>
          Approve and run
        </button>
        <button className="ta-no" onClick={() => onApprove(item.id, false)}>
          Reject
        </button>
      </div>
    </div>
  )
})

interface ChatViewProps {
  session: Session
  model: string
  models: ModelRef[]
  initialPrompt: string | null
  initialImages?: string[]
  onConsumePrompt: () => void
  onUpdated?: () => void
  permission: string
  onPermission: (id: string) => void
  effort: string
  onEffort: (id: string) => void
  onOpenSettings?: (tab?: SettingsTabId) => void
  onNewSession?: () => void
  agents: Agent[]
  onOpenAgents?: (kind: 'agent' | 'subagent') => void
  onBrowser?: () => void
}

export function ChatView({
  session,
  model,
  models,
  initialPrompt,
  initialImages,
  onConsumePrompt,
  onUpdated,
  permission,
  onPermission,
  effort,
  onEffort,
  onOpenSettings,
  onNewSession,
  agents,
  onOpenAgents,
  onBrowser,
}: ChatViewProps) {
  const [items, setItems] = useState<Item[]>([])
  const [streaming, setStreaming] = useState(false)
  const [modelSel, setModelSel] = useState(model)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [plan, setPlan] = useState<PlanStep[]>([])
  const [cmdCount, setCmdCount] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const turnStartRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const c = useComposer()
  const slash = useSlashMenu(c.text, CHAT_COMMANDS)
  const mention = useMentionMenu(c.text, c.setText, agents)
  const [activeAgentId, setActiveAgentId] = useState<string | null | undefined>(session.agentId)
  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? agents.find((a) => a.builtin)
  const started = useRef(false)

  /** A sent message @mentioning a known top-level agent takes over the session. */
  function applyMentionTakeover(text: string) {
    const m = /(?:^|\s)@([a-zA-Z0-9-]+)/.exec(text)
    if (!m) return
    const found = agents.find((a) => a.kind === 'agent' && a.name === m[1].toLowerCase())
    if (found) setActiveAgentId(found.id)
  }
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Apply one streamed agent event to local state. Shared by the live send path
  // and by reconnecting to an in-progress background run, so both render identically.
  const handleEvent = useCallback((e: AgentEvent) => {
    if (e.type === 'usage') {
      setUsage({ prompt: e.prompt ?? 0, completion: e.completion ?? 0, total: e.total ?? 0, context: e.context ?? 0 })
      return
    }
    if (e.type === 'plan') {
      setPlan(e.steps ?? [])
      return
    }
    if (e.type === 'tool_call' && e.name === 'bash') setCmdCount((n) => n + 1)
    setItems((prev) => {
      const next = prev.slice()
      const last = next[next.length - 1]
      switch (e.type) {
        case 'user_message':
          // Echoed by the server at the start of a turn — this (not an optimistic
          // local add) is the single source of the user bubble, so reconnecting
          // to a run rebuilds it too.
          next.push({ kind: 'user', text: e.content ?? '', images: e.images })
          break
        case 'assistant_delta':
          if (last?.kind === 'assistant') next[next.length - 1] = { ...last, text: last.text + (e.text ?? '') }
          else next.push({ kind: 'assistant', text: e.text ?? '' })
          break
        case 'assistant_message':
          if (last?.kind !== 'assistant') next.push({ kind: 'assistant', text: e.content ?? '' })
          break
        case 'assistant_retract':
          // model emitted a tool call as text — drop that raw bubble
          if (last?.kind === 'assistant') next.pop()
          break
        case 'tool_call':
          next.push({ kind: 'tool', id: e.id ?? '', name: e.name ?? '', args: e.arguments ?? '' })
          break
        case 'approval_request':
          next.push({ kind: 'tool', id: e.id ?? '', name: e.name ?? '', args: e.arguments ?? '', approval: 'pending' })
          break
        case 'tool_result':
          for (let i = next.length - 1; i >= 0; i--) {
            const it = next[i]
            if (it.kind === 'tool' && it.id === e.id) {
              next[i] = { ...it, result: e.result }
              break
            }
          }
          break
        case 'error':
          next.push({ kind: 'error', text: e.message ?? 'error' })
          break
      }
      return next
    })
  }, [])

  // Start the per-turn UI feedback (spinner, command counter, elapsed timer).
  function beginTurn() {
    setStreaming(true)
    setCmdCount(0)
    setElapsedMs(0)
    turnStartRef.current = Date.now()
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => setElapsedMs(Date.now() - turnStartRef.current), 1000)
  }

  function endTurn() {
    setStreaming(false)
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setElapsedMs(Date.now() - turnStartRef.current)
    abortRef.current = null
    onUpdated?.()
  }

  // Send a new message. The run executes on the server and survives this client
  // disconnecting; the user bubble arrives via the echoed `user_message` event.
  async function send(prompt: string, images?: string[]) {
    applyMentionTakeover(prompt)
    beginTurn()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      await streamMessage(session.id, prompt, modelSel, permission, effort, handleEvent, ctrl.signal, images)
    } catch (err) {
      // Disconnecting (stop / unmount) aborts the fetch — that isn't an error.
      if (!ctrl.signal.aborted) {
        setItems((prev) => [...prev, { kind: 'error', text: err instanceof Error ? err.message : String(err) }])
      }
    } finally {
      endTurn()
    }
  }

  // Reconnect to a session's in-progress background run: replay buffered events,
  // then stream live ones. Used when returning to a session whose run is active.
  async function reconnect() {
    beginTurn()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      await subscribeStream(session.id, handleEvent, ctrl.signal)
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setItems((prev) => [...prev, { kind: 'error', text: err instanceof Error ? err.message : String(err) }])
      }
    } finally {
      endTurn()
    }
  }

  // The Stop button: actually stop the server-side run (not just disconnect).
  function stop() {
    void api.stopRun(session.id)
    abortRef.current?.abort()
  }

  const handleApprove = useCallback(
    (id: string, approved: boolean) => {
      void api.approveToolCall(session.id, id, approved)
      setItems((prev) =>
        prev.map((it) =>
          it.kind === 'tool' && it.id === id ? { ...it, approval: approved ? 'approved' : 'rejected' } : it,
        ),
      )
    },
    [session.id],
  )

  // Load the persisted (completed) transcript. Returns whether a run is still
  // active on the server, so the caller can reconnect to it.
  async function loadHistory(): Promise<boolean> {
    try {
      const full = await api.getSession(session.id)
      const its: Item[] = []
      for (const m of full.messages) {
        if (m.role === 'user' || m.role === 'assistant') {
          its.push({ kind: m.role, text: m.content })
        } else if (m.role === 'tool') {
          // Display-only tool record persisted by the backend — rebuild the tool card.
          try {
            const t = JSON.parse(m.content) as { name?: string; args?: string; result?: string }
            its.push({ kind: 'tool', id: `h${its.length}`, name: t.name ?? '', args: t.args ?? '', result: t.result ?? '' })
          } catch {
            /* not a structured record — skip */
          }
        }
      }
      setItems(its)
      return Boolean(full.running)
    } catch {
      return false
    }
  }

  // On mount: fire the handed-over first prompt, or load history — and if a run
  // is still going in the background, reconnect to it.
  useEffect(() => {
    if (started.current) return
    started.current = true
    if (initialPrompt || (initialImages && initialImages.length)) {
      void send(initialPrompt ?? '', initialImages)
      onConsumePrompt()
    } else {
      void loadHistory().then((running) => {
        if (running) void reconnect()
      })
    }
    // On unmount (e.g. switching sessions) just disconnect from the stream — the
    // run keeps going on the server; only the Stop button actually stops it.
    return () => {
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [items])

  function submit() {
    if (streaming) return
    const msg = c.compose()
    const imgs = c.imageUrls()
    if (!msg && imgs.length === 0) return // allow sending images with no text
    c.reset()
    void send(msg, imgs.length ? imgs : undefined)
  }

  function runCommand(cmd: SlashCommand) {
    c.setText('')
    switch (cmd.id) {
      case 'new-session':
        onNewSession?.()
        break
      case 'agents':
        onOpenAgents?.('agent')
        break
      case 'subagents':
        onOpenAgents?.('subagent')
        break
      case 'permission-auto':
        onPermission('auto')
        break
      case 'permission-manual':
        onPermission('manual')
        break
      case 'permission-bypass':
        onPermission('bypass')
        break
      case 'effort-low':
        onEffort('low')
        break
      case 'effort-medium':
        onEffort('medium')
        break
      case 'effort-high':
        onEffort('high')
        break
      case 'effort-extra':
        onEffort('extra')
        break
      case 'settings':
        onOpenSettings?.()
        break
      case 'models':
        onOpenSettings?.('models')
        break
      case 'permissions':
        onOpenSettings?.('permissions')
        break
      case 'import':
        onOpenSettings?.('import')
        break
      case 'developer':
        onOpenSettings?.('developer')
        break
      case 'about':
        onOpenSettings?.('about')
        break
    }
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <div className="chat-title">
          {baseName(session.workspace)}
          <span className="wsx">{session.workspace}</span>
        </div>
        <div className="chat-head-r">
          {streaming && (
            <span className="runchip">
              <span className="rd" /> running
            </span>
          )}
          <button
            className="mode"
            style={{ color: 'var(--amber-2)' }}
            title="Manage agents"
            onClick={() => onOpenAgents?.('agent')}
          >
            ⬡ {activeAgent && !activeAgent.builtin ? `@${activeAgent.name}` : 'Pentest Mode'}
          </button>
          <span>{models.find((m) => m.ref === modelSel)?.name ?? modelSel}</span>
        </div>
      </div>

      <ProgressPanel steps={plan} running={streaming} cmdCount={cmdCount} elapsed={fmtElapsed(elapsedMs)} />

      <div className="chat-scroll">
        <div className="chat-inner">
          {(() => {
            const nodes: ReactNode[] = []
            let batch: ToolItem[] = []
            const flush = () => {
              if (batch.length) {
                nodes.push(<ToolGroup key={`g${batch[0].id}`} tools={batch} />)
                batch = []
              }
            }
            items.forEach((item, i) => {
              // Group consecutive completed/running tool calls into one summary line.
              if (item.kind === 'tool' && item.approval !== 'pending') {
                batch.push(item)
                return
              }
              flush()
              if (item.kind === 'tool') {
                nodes.push(<ToolApproval item={item} key={i} onApprove={handleApprove} />)
              } else if (item.kind === 'user') {
                nodes.push(
                  <div className="msg user" key={i}>
                    <div className="bubble">
                      {item.images && item.images.length > 0 && (
                        <div className="msg-imgs">
                          {item.images.map((src, k) => (
                            <img key={k} src={src} alt="pasted" />
                          ))}
                        </div>
                      )}
                      {item.text && <p>{item.text}</p>}
                    </div>
                  </div>,
                )
              } else if (item.kind === 'assistant') {
                nodes.push(
                  <div className="msg assistant" key={i}>
                    <div className="bubble">
                      <Markdown text={item.text} />
                    </div>
                  </div>,
                )
              } else {
                nodes.push(
                  <div className="chat-error" key={i}>
                    {item.text}
                  </div>,
                )
              }
            })
            flush()
            return nodes
          })()}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="chat-composer">
        <div className="chat-cc">
          <Attachments items={c.attachments} onRemove={c.removeAttachment} />
          <div className="box">
            {slash.open ? (
              <SlashMenu items={slash.items} activeIndex={slash.activeIndex} onHover={slash.setActiveIndex} onSelect={runCommand} />
            ) : mention.open ? (
              <SlashMenu
                items={mention.items}
                activeIndex={mention.activeIndex}
                prefix="@"
                onHover={mention.setActiveIndex}
                onSelect={mention.apply}
              />
            ) : null}
            <textarea
              ref={c.textareaRef}
              className="composer-input"
              rows={1}
              placeholder={streaming ? 'Running…' : 'Reply…  (/ commands · @ agents)'}
              value={c.text}
              onChange={(e) => c.setText(e.target.value)}
              onPaste={c.onPaste}
              onKeyDown={(e) => {
                if (mention.handleKeyDown(e)) return
                if (slash.handleKeyDown(e, runCommand)) return
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
            {streaming ? (
              <button className="stopbtn" onClick={stop} aria-label="Stop generating" title="Stop">
                <span className="sq" />
              </button>
            ) : (
              <span className="ret" style={{ cursor: 'pointer' }} onClick={submit}>
                ↵
              </span>
            )}
          </div>
          <input ref={c.fileRef} type="file" multiple style={{ display: 'none' }} onChange={c.onFiles} />
          <ComposerBar
            models={models}
            selectedModel={modelSel}
            onSelectModel={setModelSel}
            permission={permission}
            onPermission={onPermission}
            effort={effort}
            onEffort={onEffort}
            usage={usage}
            onAttach={c.triggerAttach}
            onMic={c.toggleMic}
            micActive={c.listening}
            onBrowser={onBrowser}
            terminals={cmdCount}
            running={streaming}
          />
        </div>
      </div>
    </div>
  )
}
