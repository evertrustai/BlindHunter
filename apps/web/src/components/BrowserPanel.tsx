import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { api } from '../lib/api'
import type { BrowserTab } from '../lib/api'

/** Backend viewport — click/scroll coordinates are scaled to this. */
const VW = 1280
const VH = 800

const SPECIAL_KEYS = new Set([
  'Enter',
  'Backspace',
  'Tab',
  'Delete',
  'Escape',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
])

interface BrowserPanelProps {
  width: number
  onWidth: (w: number) => void
  onClose: () => void
}

/** Short hostname for a tab monogram / address display. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * The in-app browser, docked beside the chat: a real Chromium the agent shares with you,
 * streamed as self-pacing screenshots. Looks and behaves like a normal browser pane —
 * tabs with favicons, an address bar with a security indicator, a loading bar, and live
 * click / type / scroll forwarded into the page.
 */
export function BrowserPanel({ width, onWidth, onClose }: BrowserPanelProps) {
  const [tabs, setTabs] = useState<BrowserTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [addr, setAddr] = useState('')
  const [editingAddr, setEditingAddr] = useState(false)
  const [shotTick, setShotTick] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [badFavicons, setBadFavicons] = useState<Set<string>>(new Set())
  const stageRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wheelAt = useRef(0)
  const fastUntil = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  const active = tabs.find((t) => t.id === activeId) ?? null

  const refreshTabs = useCallback(async () => {
    try {
      const { tabs: list } = await api.browserTabs()
      setTabs(list)
      setActiveId((cur) => {
        if (cur && list.some((t) => t.id === cur)) return cur
        return list.find((t) => t.active)?.id ?? list[0]?.id ?? null
      })
    } catch {
      // server unreachable — leave as-is
    }
  }, [])

  useEffect(() => {
    void refreshTabs()
  }, [refreshTabs])

  // Keep tab metadata (title / favicon / url / loading) fresh while the panel is open.
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (!document.hidden) void refreshTabs()
    }, 1500)
    return () => window.clearInterval(iv)
  }, [refreshTabs])

  // Keep the address bar synced to the active tab — unless the user is editing it.
  useEffect(() => {
    if (active && !editingAddr) setAddr(active.url === 'about:blank' ? '' : active.url)
  }, [active?.id, active?.url, editingAddr]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Self-pacing screenshot stream: fast right after you interact, calm when idle. ---
  const shotSrc = useMemo(() => (activeId ? api.browserShotUrl(activeId) : ''), [activeId, shotTick])

  const scheduleNext = useCallback(() => {
    window.clearTimeout(timer.current)
    if (!activeId) return
    const delay = Date.now() < fastUntil.current ? 160 : 650
    timer.current = window.setTimeout(() => {
      if (document.hidden) {
        scheduleNext()
        return
      }
      setShotTick((t) => t + 1)
    }, delay)
  }, [activeId])

  // Pull a frame soon after an interaction, and enter the fast cadence for a moment.
  const bump = useCallback(() => {
    fastUntil.current = Date.now() + 1400
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShotTick((t) => t + 1), 110)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function newTab(url?: string) {
    setBusy(true)
    setError(null)
    try {
      const r = await api.browserNewTab(url)
      if ('error' in r) setError(r.error)
      else {
        await refreshTabs()
        setActiveId(r.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function navigate(target: string) {
    if (!target.trim()) return
    setEditingAddr(false)
    if (!activeId) return newTab(target)
    setBusy(true)
    setError(null)
    try {
      const r = await api.browserNavigate(activeId, target)
      if ('error' in r) setError(r.error)
      await refreshTabs()
      bump()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function activateTab(id: string) {
    setActiveId(id)
    await api.browserActivate(id).catch(() => {})
    bump()
  }

  async function closeTab(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await api.browserCloseTab(id).catch(() => {})
    await refreshTabs()
  }

  function toBrowserCoords(e: React.MouseEvent<HTMLImageElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * VW),
      y: Math.round(((e.clientY - rect.top) / rect.height) * VH),
    }
  }

  function onShotClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!activeId) return
    const { x, y } = toBrowserCoords(e)
    void api.browserClick(activeId, x, y).then(bump)
    stageRef.current?.focus() // route subsequent keystrokes into the page
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!activeId) return
    const k = e.key
    if (SPECIAL_KEYS.has(k)) {
      e.preventDefault()
      void api.browserKey(activeId, k).then(bump)
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      void api.browserType(activeId, k).then(bump)
    }
  }

  function onWheel(e: React.WheelEvent) {
    if (!activeId) return
    const now = Date.now()
    if (now - wheelAt.current < 90) return // throttle
    wheelAt.current = now
    void api.browserScroll(activeId, Math.round(e.deltaX), Math.round(e.deltaY)).then(bump)
  }

  // Drag the left edge to resize; base the width on the panel's own right edge so it
  // works whether or not the terminal is docked to its right.
  function startDrag(e: ReactMouseEvent) {
    e.preventDefault()
    const right = panelRef.current?.getBoundingClientRect().right ?? window.innerWidth
    const move = (ev: MouseEvent) => onWidth(Math.max(340, Math.min(window.innerWidth - 360, right - ev.clientX)))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const loading = busy || Boolean(active?.loading)
  const secure = active ? /^https:\/\//i.test(active.url) : false
  const insecure = active ? /^http:\/\//i.test(active.url) : false

  return (
    <div className="bxpanel" style={{ width }} ref={panelRef}>
      <div className="bxp-resize" onMouseDown={startDrag} title="Drag to resize" />

      {/* Tab strip */}
      <div className="bxp-tabs">
        {tabs.map((t) => {
          const fav = t.favicon && !badFavicons.has(t.favicon) ? t.favicon : ''
          return (
            <div
              key={t.id}
              className={t.id === activeId ? 'bxp-tab on' : 'bxp-tab'}
              onClick={() => activateTab(t.id)}
              title={t.url}
            >
              {fav ? (
                <img
                  className="bxp-fav"
                  src={fav}
                  alt=""
                  onError={() => setBadFavicons((s) => new Set(s).add(t.favicon as string))}
                />
              ) : (
                <span className="bxp-fav mono">{hostOf(t.url).slice(0, 1).toUpperCase() || '●'}</span>
              )}
              <span className="bxp-tabtitle">{t.title || hostOf(t.url) || 'New tab'}</span>
              <span className="bxp-tabx" title="Close tab" onClick={(e) => closeTab(t.id, e)}>
                ✕
              </span>
            </div>
          )
        })}
        <button className="bxp-newtab" title="New tab" onClick={() => newTab()} disabled={busy}>
          ＋
        </button>
        <div className="bxp-spacer" />
        <button className="bxp-close" title="Close browser" aria-label="Close browser" onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Toolbar */}
      <div className="bxp-toolbar">
        <button className="bxp-nav" title="Back" onClick={() => navigate('back')} disabled={!activeId}>
          ←
        </button>
        <button className="bxp-nav" title="Forward" onClick={() => navigate('forward')} disabled={!activeId}>
          →
        </button>
        <button className="bxp-nav" title="Reload" onClick={() => navigate('reload')} disabled={!activeId}>
          {loading ? '×' : '⟳'}
        </button>
        <div className={`bxp-addr${insecure ? ' danger' : ''}`}>
          <span className="bxp-lock" title={secure ? 'Secure (HTTPS)' : insecure ? 'Not secure (HTTP)' : ''}>
            {secure ? '🔒' : insecure ? '⚠' : '🌐'}
          </span>
          <input
            className="bxp-addr-in"
            placeholder="Search or enter a URL"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            onFocus={() => setEditingAddr(true)}
            onBlur={() => setEditingAddr(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                ;(e.target as HTMLInputElement).blur()
                navigate(addr)
              }
            }}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Loading bar */}
      <div className={`bxp-progress${loading ? ' on' : ''}`} />

      {error && (
        <div className="bxp-error">
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Stage */}
      <div className="bxp-stage" ref={stageRef} tabIndex={0} onKeyDown={onKeyDown} onWheel={onWheel}>
        {activeId ? (
          <img
            className="bxp-shot"
            src={shotSrc}
            alt="page"
            draggable={false}
            onClick={onShotClick}
            onLoad={scheduleNext}
            onError={scheduleNext}
          />
        ) : (
          <div className="bxp-empty">
            <div className="bxp-empty-mark">🌐</div>
            <div className="bxp-empty-t">Shared browser</div>
            <div className="bxp-empty-d">A real Chromium you and the agent drive together. Open a page to begin.</div>
            <button className="bxp-empty-btn" onClick={() => newTab()} disabled={busy}>
              Open a tab
            </button>
          </div>
        )}
      </div>

      <div className="bxp-foot">
        <span className="bxp-live">
          <span className="bxp-dot" /> Live · shared with agent
        </span>
        <span className="bxp-hint">click · type · scroll</span>
      </div>
    </div>
  )
}
