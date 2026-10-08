import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

interface BrowserViewProps {
  onClose: () => void
}

/** The in-app browser: a real Chromium driven by the backend, streamed as screenshots. */
export function BrowserView({ onClose }: BrowserViewProps) {
  const [tabs, setTabs] = useState<BrowserTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [addr, setAddr] = useState('')
  const [shotTick, setShotTick] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const wheelAt = useRef(0)

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

  // Keep the address bar synced to the active tab (unless the user is editing).
  useEffect(() => {
    if (active) setAddr(active.url === 'about:blank' ? '' : active.url)
  }, [active?.id, active?.url]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live screenshot polling while a tab is open and the tab/window is visible.
  useEffect(() => {
    if (!activeId) return
    const iv = setInterval(() => {
      if (!document.hidden) setShotTick((t) => t + 1)
    }, 700)
    return () => clearInterval(iv)
  }, [activeId])

  const shotSrc = useMemo(() => (activeId ? api.browserShotUrl(activeId) : ''), [activeId, shotTick])

  const bump = useCallback(() => setTimeout(() => setShotTick((t) => t + 1), 150), [])

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
    if (now - wheelAt.current < 110) return // throttle
    wheelAt.current = now
    void api.browserScroll(activeId, Math.round(e.deltaX), Math.round(e.deltaY)).then(bump)
  }

  return (
    <div className="bx">
      <div className="bx-tabs">
        <button className="bx-icon" title="Back to chat" onClick={onClose}>
          ‹
        </button>
        {tabs.map((t) => (
          <div
            key={t.id}
            className={t.id === activeId ? 'bx-tab on' : 'bx-tab'}
            onClick={() => activateTab(t.id)}
            title={t.url}
          >
            <span className="bx-globe">🌐</span>
            <span className="bx-tabtitle">{t.title || t.url || 'New tab'}</span>
            <span className="bx-x" onClick={(e) => closeTab(t.id, e)}>
              ×
            </span>
          </div>
        ))}
        <button className="bx-icon" title="New tab" onClick={() => newTab()} disabled={busy}>
          ＋
        </button>
      </div>

      <div className="bx-toolbar">
        <button className="bx-icon" title="Back" onClick={() => navigate('back')} disabled={!activeId}>
          ⟵
        </button>
        <button className="bx-icon" title="Forward" onClick={() => navigate('forward')} disabled={!activeId}>
          ⟶
        </button>
        <button className="bx-icon" title="Reload" onClick={() => navigate('reload')} disabled={!activeId}>
          ⟳
        </button>
        <input
          className="bx-addr"
          placeholder="Enter a URL and press Enter"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate(addr)
          }}
        />
        {busy && <span className="bx-spin" />}
      </div>

      {error && <div className="bx-error">⚠ {error}</div>}

      <div
        className="bx-stage"
        ref={stageRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onWheel={onWheel}
      >
        {activeId ? (
          <img className="bx-shot" src={shotSrc} alt="page" draggable={false} onClick={onShotClick} />
        ) : (
          <div className="bx-empty">
            <div className="bx-empty-mark">🌐</div>
            <div className="bx-empty-t">In-app browser</div>
            <div className="bx-empty-d">
              A real Chromium the agent shares with you. Enter a URL above or open a new tab to start.
            </div>
            <button className="bx-empty-btn" onClick={() => newTab()} disabled={busy}>
              Open a tab
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
