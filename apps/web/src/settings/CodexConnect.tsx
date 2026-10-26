import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

type Status = { connected: boolean; expiresAt?: number; accountId?: string; models?: { id: string }[] } | null

/**
 * "Connect with ChatGPT (Codex)" — sign in with a ChatGPT Plus/Pro subscription using
 * OpenAI's device-code flow. The user enables device-code auth in ChatGPT settings, clicks
 * Connect, gets a one-time code, approves it on OpenAI's device page, and the card polls
 * until sign-in completes. Inference runs through the Codex Responses backend.
 */
export function CodexConnect({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<Status>(null)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<'idle' | 'connecting'>('idle')
  const [code, setCode] = useState('')
  const [verifyUrl, setVerifyUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const pollId = useRef('')
  const interval = useRef(5)

  async function refresh() {
    try {
      setStatus(await api.codexStatus())
    } catch {
      setStatus({ connected: false })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void refresh()
  }, [])

  // Step 1: get a device code to show.
  async function begin() {
    setErr('')
    setBusy(true)
    try {
      const r = await api.codexStart()
      if (!r.ok || !r.pollId || !r.userCode) {
        setErr(r.error ?? 'Could not start sign-in.')
        return
      }
      pollId.current = r.pollId
      interval.current = Math.max(3, r.interval ?? 5)
      setCode(r.userCode)
      setVerifyUrl(r.verificationUri ?? 'https://auth.openai.com/codex/device')
      setPhase('connecting')
      if (r.verificationUri) window.open(r.verificationUri, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // Step 2: poll until approved.
  useEffect(() => {
    if (phase !== 'connecting' || !pollId.current) return
    let stop = false
    const tick = async () => {
      if (stop) return
      try {
        const r = await api.codexPoll(pollId.current)
        if (stop) return
        if (r.status === 'connected') {
          setPhase('idle')
          await refresh()
          onChanged?.()
          return
        }
        if (r.status === 'error') {
          setErr(r.error ?? 'Sign-in failed.')
          setPhase('idle')
          return
        }
      } catch {
        /* keep polling */
      }
      if (!stop) window.setTimeout(tick, interval.current * 1000)
    }
    const t = window.setTimeout(tick, interval.current * 1000)
    return () => {
      stop = true
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — user can select manually */
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      await api.disconnectCodex()
      await refresh()
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }

  if (loading) return null

  if (status?.connected) {
    const n = status.models?.length ?? 0
    return (
      <div className="conn-card is-connected" style={{ marginTop: 14 }}>
        <div className="conn-ico codex">◉</div>
        <div className="conn-info">
          <div className="conn-title">ChatGPT subscription — connected</div>
          <div className="conn-sub">
            {n} model{n === 1 ? '' : 's'} available
          </div>
        </div>
        <button className="conn-dis" onClick={disconnect} disabled={busy}>
          {busy ? '…' : 'Disconnect'}
        </button>
      </div>
    )
  }

  return (
    <div className="conn-card" style={{ marginTop: 14 }}>
      <div className="conn-head">
        <div className="conn-ico codex">◉</div>
        <div className="conn-info">
          <div className="conn-title">Connect with ChatGPT (Codex)</div>
          <div className="conn-sub">Use your ChatGPT Plus/Pro subscription via OpenAI's device-code sign-in.</div>
        </div>
      </div>

      {phase === 'idle' ? (
        <>
          <div className="conn-steps">
            <div className="conn-steps-h">First, enable device-code sign-in in ChatGPT:</div>
            <ol>
              <li>Open ChatGPT → <b>Settings</b></li>
              <li>Go to <b>Security</b> (or Codex settings)</li>
              <li>Turn on <b>device code authorization for Codex</b></li>
            </ol>
          </div>
          <button className="conn-go" onClick={begin} disabled={busy}>
            {busy ? 'Starting…' : 'I have enabled it — connect →'}
          </button>
        </>
      ) : (
        <div className="conn-setup">
          <div className="conn-hint">
            A browser opened. On OpenAI's page, paste this one-time code and confirm:
          </div>
          <div className="conn-code-row">
            <code className="conn-usercode">{code}</code>
            <button className="conn-go" onClick={copyCode}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <a className="conn-reopen" href={verifyUrl} target="_blank" rel="noopener noreferrer">
            Open the device page
          </a>
          <div className="conn-connecting" style={{ marginTop: 10 }}>
            <span className="conn-spin" />
            <span>Waiting for you to finish signing in…</span>
          </div>
          <button className="conn-reopen" onClick={() => setPhase('idle')}>
            Cancel
          </button>
        </div>
      )}

      {err && <div className="conn-err">{err}</div>}

      <div className="conn-note">
        Unofficial — routing a ChatGPT subscription through a third-party app is against OpenAI's terms, and the backend
        may rate-limit it. Your token is stored owner-only on this machine and is sent only to OpenAI.
      </div>
    </div>
  )
}
