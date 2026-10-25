import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { SetupTokenTerminal } from '../components/SetupTokenTerminal'

type Status = { connected: boolean; expiresAt?: number; scopes?: string; models?: { id: string }[] } | null

/**
 * "Connect with Claude" — connect a Claude Pro/Max subscription. The one-click flow runs
 * `claude setup-token` in an embedded terminal: a browser opens, the user clicks Authorize,
 * and the server captures the printed token and connects automatically. A manual paste field
 * (for a token or an Anthropic API key) is kept as a fallback.
 */
export function ClaudeConnect({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<Status>(null)
  const [loading, setLoading] = useState(true)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [showTerm, setShowTerm] = useState(false)
  const [err, setErr] = useState('')

  async function refresh() {
    try {
      setStatus(await api.claudeStatus())
    } catch {
      setStatus({ connected: false })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void refresh()
  }, [])

  // While the setup-token terminal is running, poll until the server captures + stores the
  // token (status flips to connected), then close the flow.
  useEffect(() => {
    if (!connecting) return
    const t = window.setInterval(async () => {
      try {
        const st = await api.claudeStatus()
        if (st.connected) {
          setStatus(st)
          setConnecting(false)
          onChanged?.()
        }
      } catch {
        /* keep polling */
      }
    }, 2500)
    return () => window.clearInterval(t)
  }, [connecting, onChanged])

  // Store the pasted key (an sk-ant-oat01 subscription token, or an sk-ant-api03 API key).
  async function connect() {
    const val = key.trim()
    if (!val) return
    setBusy(true)
    setErr('')
    try {
      const r = await api.setClaudeKey(val)
      if (!r.ok) {
        setErr(r.error ?? 'Could not connect.')
        return
      }
      setKey('')
      await refresh()
      onChanged?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      await api.disconnectClaude()
      await refresh()
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }

  if (loading) return null

  if (status?.connected) {
    const n = status.models?.length ?? 0
    const exp = status.expiresAt ? new Date(status.expiresAt).toLocaleString() : ''
    return (
      <div className="conn-card is-connected">
        <div className="conn-ico">✳</div>
        <div className="conn-info">
          <div className="conn-title">Claude subscription — connected</div>
          <div className="conn-sub">
            {n} model{n === 1 ? '' : 's'} available{exp ? ` · token valid until ${exp}` : ''}
          </div>
        </div>
        <button className="conn-dis" onClick={disconnect} disabled={busy}>
          {busy ? '…' : 'Disconnect'}
        </button>
      </div>
    )
  }

  return (
    <div className="conn-card">
      <div className="conn-head">
        <div className="conn-ico">✳</div>
        <div className="conn-info">
          <div className="conn-title">Connect with Claude</div>
          <div className="conn-sub">
            {connecting ? 'Authorize in the browser — connecting automatically…' : 'One click, then Authorize in your browser.'}
          </div>
        </div>
        {!connecting && (
          <button className="conn-go" onClick={() => { setErr(''); setConnecting(true) }}>
            Connect with Claude →
          </button>
        )}
      </div>

      {connecting ? (
        <div className="conn-setup">
          <div className="conn-connecting">
            <span className="conn-spin" />
            <span>
              A browser opened — click <b>Authorize</b>. You'll be connected automatically, no copying needed.
            </span>
          </div>
          <div className="conn-setup-actions">
            <button className="conn-reopen" onClick={() => setShowTerm((s) => !s)}>
              {showTerm ? 'Hide terminal' : 'Show terminal'}
            </button>
            <button
              className="conn-reopen"
              onClick={() => {
                setConnecting(false)
                setShowTerm(false)
              }}
            >
              Cancel
            </button>
          </div>
          {/* The shell runs in the background (the server captures the token); the terminal is
              kept mounted but hidden, and only shown if Claude asks the user to paste a code. */}
          <div style={{ display: showTerm ? 'block' : 'none' }}>
            <SetupTokenTerminal />
          </div>
        </div>
      ) : (
        <div className="conn-code">
          <div className="conn-hint">Already have a key? Paste it (a token or an Anthropic API key, starts with <code>sk-ant-</code>):</div>
          <div className="conn-code-row">
            <input
              className="conn-input"
              type="password"
              placeholder="sk-ant-…"
              value={key}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void connect()
              }}
            />
            <button className="conn-go" onClick={connect} disabled={busy || !key.trim()}>
              {busy ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </div>
      )}

      {err && <div className="conn-err">{err}</div>}

      <div className="conn-note">
        The one-click flow runs <code>claude setup-token</code> (needs Claude Code installed). Your token is stored
        owner-only on this machine and is sent only to Anthropic. Using a Pro/Max subscription with a third-party app is
        against Anthropic's terms and unofficial — an API key is the supported option.
      </div>
    </div>
  )
}
