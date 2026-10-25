import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { SocketStream } from '@fastify/websocket'
import { spawnTerminal } from '../terminal/pty.js'
import { resolveShellKind } from '../tools/shell.js'
import { loadSettings } from '../config/store.js'
import { hostAllowed, originAllowed } from '../security/loopback.js'

/**
 * Interactive terminal over a WebSocket: one socket = one PTY-backed shell (a terminal tab).
 * Client → server messages are JSON: {t:'i',d} for keystrokes, {t:'r',c,r} to resize.
 * Server → client frames are raw PTY output the client writes straight into xterm.
 */
export async function terminalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/terminal/ws', { websocket: true }, async (conn: SocketStream, req: FastifyRequest) => {
    const ws = conn.socket
    // The upgrade is a GET, so the global CSRF (mutation-only) hook doesn't cover it. Re-check
    // host + origin here so a foreign page can't open a shell via DNS-rebinding.
    if (!hostAllowed(req.headers.host) || (req.headers.origin && !originAllowed(req.headers.origin))) {
      try {
        ws.close(1008, 'forbidden')
      } catch {
        /* already closing */
      }
      return
    }

    const q = req.query as { cwd?: string; cols?: string; rows?: string }
    const settings = await loadSettings()
    const kind = resolveShellKind(settings.agentEnvironment, settings.terminalShell)

    let term
    try {
      term = spawnTerminal(kind, q.cwd || '', Number(q.cols) || 80, Number(q.rows) || 24)
    } catch (e) {
      try {
        ws.send(`\r\n\x1b[31mCould not start a shell: ${e instanceof Error ? e.message : String(e)}\x1b[0m\r\n`)
        ws.close()
      } catch {
        /* ignore */
      }
      return
    }

    term.onData((d) => {
      try {
        ws.send(d)
      } catch {
        /* socket gone */
      }
    })
    term.onExit(() => {
      try {
        ws.close()
      } catch {
        /* already closed */
      }
    })

    ws.on('message', (raw: Buffer) => {
      let msg: { t?: string; d?: string; c?: number; r?: number }
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (msg.t === 'i' && typeof msg.d === 'string') term.write(msg.d)
      else if (msg.t === 'r') term.resize(Math.max(1, Number(msg.c) || 80), Math.max(1, Number(msg.r) || 24))
    })

    const stop = () => {
      try {
        term.kill()
      } catch {
        /* already gone */
      }
    }
    ws.on('close', stop)
    ws.on('error', stop)
  })
}
