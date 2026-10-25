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
  const [pkceId, setPkceId] = useState('')
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

  // Step 1: open Claude's authorize page in the browser and remember this attempt's PKCE id.
  async function authorize() {
    setErr('')
    try {
      const { url, pkceId: id } = await api.startClaudeLogin()
      setPkceId(id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  // Step 2: take whatever Claude gave back — an sk-ant- key (store it directly) or the
  // authorize code (exchange it, needs the pkceId from step 1).
  async function connect() {
    const val = key.trim()
    if (!val) return
    setBusy(true)
    setErr('')
    try {
      const r = val.startsWith('sk-ant-')
        ? await api.setClaudeKey(val)
        : pkceId
          ? await api.completeClaudeLogin(pkceId, val)
          : { ok: false as const, error: 'Click "Authorize with Claude" first, then paste the code it gives you.' }
      if (!r.ok) {
        setErr(r.error ?? 'Could not connect.')
        return
      }
      setKey('')
      setPkceId('')
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
          <div className="conn-sub">Use your Claude Pro/Max subscription — no API-key billing.</div>
        </div>
        <button className="conn-go" onClick={authorize}>
          Authorize with Claude →
        </button>
      </div>

      <div className="conn-code">
        <div className="conn-hint">
          Click <b>Authorize with Claude</b>, approve in the browser, then paste the key or code it gives you here:
        </div>
        <div className="conn-code-row">
          <input
            className="conn-input"
            type="password"
            placeholder="Paste your key or code…"
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
        <div className="conn-hint" style={{ marginTop: 6, opacity: 0.75 }}>
          Already have a key (e.g. from <code>claude setup-token</code> or an Anthropic API key)? Paste it above and
          Connect — no need to Authorize.
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
