import { useEffect, useState } from 'react'
import { api } from '../lib/api'

type Status = { connected: boolean; expiresAt?: number; scopes?: string; models?: { id: string }[] } | null

/**
 * "Connect with Claude" — sign in with a Claude Pro/Max subscription (OAuth: approve in
 * the browser, paste the code back) and use its models in BlindHunter without an API key.
 */
export function ClaudeConnect({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<Status>(null)
  const [loading, setLoading] = useState(true)
  const [awaitingCode, setAwaitingCode] = useState(false)
  const [pkceId, setPkceId] = useState('')
  const [code, setCode] = useState('')
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

  async function begin() {
    setErr('')
    try {
      const { url, pkceId: id } = await api.startClaudeLogin()
      setPkceId(id)
      setAwaitingCode(true)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function finish() {
    if (!code.trim()) return
    setBusy(true)
    setErr('')
    try {
      const r = await api.completeClaudeLogin(pkceId, code.trim())
      if (!r.ok) {
        setErr(r.error ?? 'Could not connect.')
        return
      }
      setCode('')
      setAwaitingCode(false)
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
          <div className="conn-sub">Use your Claude Pro/Max subscription and its models — no API key needed.</div>
        </div>
        {!awaitingCode && (
          <button className="conn-go" onClick={begin}>
            Connect →
          </button>
        )}
      </div>

      {awaitingCode && (
        <div className="conn-code">
          <div className="conn-hint">Approve in the browser tab that opened, then paste the code you’re given:</div>
          <div className="conn-code-row">
            <input
              className="conn-input"
              placeholder="Paste code…"
              value={code}
              autoFocus
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void finish()
              }}
            />
            <button className="conn-go" onClick={finish} disabled={busy || !code.trim()}>
              {busy ? 'Connecting…' : 'Finish'}
            </button>
          </div>
        </div>
      )}

      {err && <div className="conn-err">{err}</div>}

      <div className="conn-note">
        Uses the same browser sign-in as Claude Code (unofficial — Anthropic may change it). Your token is stored
        encrypted on this machine and is sent only to Anthropic.
      </div>
    </div>
  )
}
