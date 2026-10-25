import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

/**
 * A small embedded terminal that runs `claude setup-token` (via the terminal WS in
 * cmd=claude-setup-token mode). The server auto-runs the command, opens the browser, and
 * watches the output for the resulting token — so the user only clicks Authorize. The
 * terminal is interactive, so the user can also paste the code if Claude prompts for it.
 */
export function SetupTokenTerminal() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      theme: { background: '#0c0d10', foreground: '#d7d7db', cursor: '#e6b450', selectionBackground: '#2a3a55' },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    try {
      fit.fit()
    } catch {
      /* not sized yet */
    }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/api/terminal/ws?cmd=claude-setup-token&cols=${term.cols}&rows=${term.rows}`)
    const send = (m: Record<string, unknown>) => {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m))
      } catch {
        /* not ready */
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
    ws.onclose = () => term.write('\r\n\x1b[90m[session ended]\x1b[0m\r\n')
    const sub = term.onData((d) => send({ t: 'i', d }))
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
      sub.dispose()
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      term.dispose()
    }
  }, [])

  return <div ref={hostRef} className="setup-term" />
}
