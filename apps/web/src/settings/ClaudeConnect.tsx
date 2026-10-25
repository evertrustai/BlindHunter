import { useEffect, useState } from 'react'
import { api } from '../lib/api'

type Status = { connected: boolean; expiresAt?: number; scopes?: string; models?: { id: string }[] } | null

/**
 * "Connect with Claude" — use a Claude Pro/Max subscription by pasting the key you were
 * given (an OAuth subscription token, or a plain Anthropic API key), so its models work in
 * BlindHunter without per-token API billing.
 */
export function ClaudeConnect({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<Status>(null)
  const [loading, setLoading] = useState(true)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
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
          <div className="conn-sub">Paste a Claude subscription token or an Anthropic API key.</div>
        </div>
      </div>

      <div className="conn-code">
        <div className="conn-hint">
          Paste your Claude key (it starts with <code>sk-ant-</code>) and connect:
        </div>
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
        <div className="conn-hint" style={{ marginTop: 8, opacity: 0.8, lineHeight: 1.6 }}>
          How to get a key:
          <br />• <b>Subscription (Pro/Max):</b> run <code>claude setup-token</code> in a terminal and paste the{' '}
          <code>sk-ant-oat01-…</code> token it prints.
          <br />• <b>API key:</b> create one at <code>console.anthropic.com</code> and paste the{' '}
          <code>sk-ant-api03-…</code> key.
        </div>
      </div>

      {err && <div className="conn-err">{err}</div>}

      <div className="conn-note">
        Your key is stored owner-only on this machine and is sent only to Anthropic. Using a Pro/Max subscription token
        with a third-party app is against Anthropic's terms and unofficial — an API key is the supported option.
      </div>
    </div>
  )
}
