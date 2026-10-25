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

  async function connect() {
    if (!key.trim()) return
    setBusy(true)
    setErr('')
    try {
      const r = await api.setClaudeKey(key.trim())
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
          <div className="conn-sub">Paste your Claude key to use your Pro/Max subscription — no API-key billing.</div>
        </div>
      </div>

      <div className="conn-code">
        <div className="conn-hint">
          Paste the key you were given (it starts with <code>sk-ant-</code>) and connect:
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
      </div>

      {err && <div className="conn-err">{err}</div>}

      <div className="conn-note">
        Works with a Claude subscription token or an Anthropic API key. Unofficial for subscription tokens — Anthropic
        may change it, and routing a Pro/Max plan through a third-party app is against their terms. Your key is stored
        owner-only on this machine and is sent only to Anthropic.
      </div>
    </div>
  )
}
