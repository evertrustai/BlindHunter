import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { SocketStream } from '@fastify/websocket'
import { spawnTerminal } from '../terminal/pty.js'
import { resolveShellKind } from '../tools/shell.js'
import { loadSettings } from '../config/store.js'
import { hostAllowed, originAllowed } from '../security/loopback.js'
import { setKey } from '../auth/claude.js'
import { upsertClaudeProvider } from './auth.js'

/** The one allowlisted managed command (not an arbitrary shell string). */
const CMD_SETUP_TOKEN = 'claude-setup-token'
// Strip ANSI/OSC escape sequences so the token/prompt can be matched in the raw PTY stream.
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g
// A Claude OAuth subscription token (sk-ant-oat01-…) printed by `claude setup-token`. The
// high minimum length avoids ever matching a wrapped fragment as if it were the whole token.
const TOKEN_RE = /sk-ant-oat01-[A-Za-z0-9_-]{40,}/

type WsSocket = SocketStream['socket']

/** Store a captured token and register the subscription provider; report into the terminal. */
async function storeToken(ws: WsSocket, token: string): Promise<void> {
  try {
    const r = await setKey(token)
    if (r.ok) {
      await upsertClaudeProvider()
      ws.send('\r\n\x1b[32m[BlindHunter] Token captured — Claude subscription connected. You can close this terminal.\x1b[0m\r\n')
    } else {
      ws.send(`\r\n\x1b[31m[BlindHunter] Could not store the token: ${r.error ?? 'unknown error'}\x1b[0m\r\n`)
    }
  } catch (e) {
    try {
      ws.send(`\r\n\x1b[31m[BlindHunter] ${e instanceof Error ? e.message : String(e)}\x1b[0m\r\n`)
    } catch {
      /* socket gone */
    }
  }
}

/**
 * Interactive terminal over a WebSocket: one socket = one PTY-backed shell (a terminal tab).
 * Client → server messages are JSON: {t:'i',d} for keystrokes, {t:'r',c,r} to resize.
 * Server → client frames are raw PTY output the client writes straight into xterm.
 *
 * With ?cmd=claude-setup-token the shell auto-runs `claude setup-token` (Claude's own
 * long-lived-token flow) and the server watches the output for the resulting token, storing
 * it and connecting the subscription automatically — so the user only clicks Authorize.
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

    const q = req.query as { cwd?: string; cols?: string; rows?: string; cmd?: string }
    const setupMode = q.cmd === CMD_SETUP_TOKEN
    const settings = await loadSettings()
    const kind = resolveShellKind(settings.agentEnvironment, settings.terminalShell)

    let term
    try {
      // setup-token runs at a fixed wide width (and ignores client resizes, below) so the
      // ~110-char token prints on one line — a narrow/hidden terminal would reflow it across
      // lines and break the server-side capture.
      term = setupMode
        ? spawnTerminal(kind, q.cwd || '', 512, 40)
        : spawnTerminal(kind, q.cwd || '', Number(q.cols) || 80, Number(q.rows) || 24)
    } catch (e) {
      try {
        ws.send(`\r\n\x1b[31mCould not start a shell: ${e instanceof Error ? e.message : String(e)}\x1b[0m\r\n`)
        ws.close()
      } catch {
        /* ignore */
      }
      return
    }

    // setup-token mode: once the shell shows a prompt, type the command; then watch for the token.
    let capBuf = ''
    let captured = false
    let typed = !setupMode
    const typeCmd = () => {
      if (typed) return
      typed = true
      try {
        term.write('claude setup-token\r')
      } catch {
        /* ignore */
      }
    }
    const typeTimer = setupMode ? setTimeout(typeCmd, 2500) : undefined

    term.onData((d) => {
      try {
        ws.send(d)
      } catch {
        /* socket gone */
      }
      if (!setupMode) return
      capBuf += d
      if (capBuf.length > 60000) capBuf = capBuf.slice(-10000)
      const clean = capBuf.replace(ANSI, '')
      if (!typed) {
        if (/[>$#]\s*$/.test(clean)) {
          if (typeTimer) clearTimeout(typeTimer)
          typeCmd()
        }
        return
      }
      if (!captured) {
        const m = clean.match(TOKEN_RE)
        if (m) {
          captured = true
          void storeToken(ws, m[0])
        }
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
      // Ignore client resizes in setup-token mode — the PTY stays at its fixed wide width so
      // the token never wraps (see spawn above).
      else if (msg.t === 'r' && !setupMode) term.resize(Math.max(1, Number(msg.c) || 80), Math.max(1, Number(msg.r) || 24))
    })

    const stop = () => {
      if (typeTimer) clearTimeout(typeTimer)
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
