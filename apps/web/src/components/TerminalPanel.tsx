import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

/** A single PTY-backed terminal tab: an xterm wired to a /api/terminal/ws WebSocket. */
function TerminalTab({ cwd, visible }: { cwd: string | null; visible: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  // Create the terminal + socket once. The tab's cwd is fixed at creation.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      theme: { background: '#0c0d10', foreground: '#d7d7db', cursor: '#e6b450', selectionBackground: '#2a3a55' },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    try {
      fit.fit()
    } catch {
      /* host not sized yet */
    }
    termRef.current = term
    fitRef.current = fit

    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${location.host}/api/terminal/ws?cwd=${encodeURIComponent(cwd ?? '')}&cols=${term.cols}&rows=${term.rows}`
    const ws = new WebSocket(url)
    const send = (m: Record<string, unknown>) => {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m))
      } catch {
        /* socket not ready */
      }
    }
    ws.onopen = () => {
      try {
        fit.fit()
      } catch {
        /* ignore */
      }
      send({ t: 'r', c: term.cols, r: term.rows })
      term.focus()
    }
    ws.onmessage = (e) => {
      if (typeof e.data === 'string') term.write(e.data)
    }
    ws.onclose = () => term.write('\r\n\x1b[90m[terminal session ended]\x1b[0m\r\n')

    const dataSub = term.onData((d) => send({ t: 'i', d }))
    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
        send({ t: 'r', c: term.cols, r: term.rows })
      } catch {
        /* ignore */
      }
    })
    ro.observe(host)

    return () => {
      ro.disconnect()
      dataSub.dispose()
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      term.dispose()
    }
    // Create once — cwd/visible changes must not re-spawn the shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fit and focus when this tab becomes the visible one (xterm can't size while hidden).
  useEffect(() => {
    if (!visible) return
    const id = requestAnimationFrame(() => {
      try {
        fitRef.current?.fit()
        termRef.current?.focus()
      } catch {
        /* ignore */
      }
    })
    return () => cancelAnimationFrame(id)
  }, [visible])

  return <div ref={hostRef} className="term-xterm" style={{ display: visible ? 'block' : 'none' }} />
}

interface TerminalPanelProps {
  open: boolean
  cwd: string | null
  width: number
  onWidth: (w: number) => void
  onClose: () => void
}

/** Right-docked terminal panel with tabs. Stays mounted once opened so shells persist. */
export function TerminalPanel({ open, cwd, width, onWidth, onClose }: TerminalPanelProps) {
  const [tabs, setTabs] = useState<{ id: string; cwd: string | null }[]>([])
  const [active, setActive] = useState('')
  const [everOpened, setEverOpened] = useState(false)
  const nextN = useRef(1)

  function addTab() {
    const id = Math.random().toString(36).slice(2, 9)
    setTabs((t) => [...t, { id, cwd }])
    setActive(id)
    nextN.current += 1
  }

  function closeTab(id: string) {
    setTabs((prev) => {
      const rest = prev.filter((t) => t.id !== id)
      setActive((a) => (a !== id ? a : rest.length ? rest[rest.length - 1].id : ''))
      return rest
    })
  }

  // Open the first tab the first time the panel is shown.
  useEffect(() => {
    if (!open) return
    setEverOpened(true)
    setTabs((t) => {
      if (t.length) return t
      const id = Math.random().toString(36).slice(2, 9)
      setActive(id)
      return [{ id, cwd }]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Drag the left edge to resize the panel width.
  function startDrag(e: ReactMouseEvent) {
    e.preventDefault()
    const move = (ev: MouseEvent) => {
      const w = Math.max(320, Math.min(window.innerWidth - 360, window.innerWidth - ev.clientX))
      onWidth(w)
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  if (!everOpened) return null

  return (
    <div className={open ? 'termpanel' : 'termpanel hidden'} style={{ width }}>
      <div className="term-resize" onMouseDown={startDrag} title="Drag to resize" />
      <div className="term-head">
        <span className="term-title">Terminal</span>
        <div className="term-tabs">
          {tabs.map((t, i) => (
            <button
              key={t.id}
              className={t.id === active ? 'term-tab active' : 'term-tab'}
              onClick={() => setActive(t.id)}
              title={`Terminal ${i + 1}`}
            >
              <span>{i + 1}</span>
              <span
                className="term-tab-x"
                role="button"
                aria-label="Close terminal"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(t.id)
                }}
              >
                ✕
              </span>
            </button>
          ))}
          <button className="term-add" title="New terminal" aria-label="New terminal" onClick={addTab}>
            ＋
          </button>
        </div>
        <button className="term-x" title="Close panel" aria-label="Close terminal panel" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="term-body">
        {tabs.length === 0 ? (
          <div className="term-empty">
            No terminals. <button className="term-link" onClick={addTab}>Open one</button>.
          </div>
        ) : (
          tabs.map((t) => <TerminalTab key={t.id} cwd={t.cwd} visible={open && t.id === active} />)
        )}
      </div>
    </div>
  )
}
