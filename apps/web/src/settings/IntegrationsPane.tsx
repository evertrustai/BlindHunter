import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { ModelRef } from '../lib/api'

type Status = Awaited<ReturnType<typeof api.telegramStatus>> | null

/** Settings › Integrations: connect BlindHunter to the user's own Telegram bot. */
export function IntegrationsPane() {
  const [status, setStatus] = useState<Status>(null)
  const [models, setModels] = useState<ModelRef[]>([])
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const pollRef = useRef<number | null>(null)
  // Voice speech-to-text fields, seeded once from status when the bot is first paired.
  const [stt, setStt] = useState({ baseUrl: '', model: '', key: '' })
  const sttSeeded = useRef(false)

  async function refresh() {
    try {
      setStatus(await api.telegramStatus())
    } catch {
      setStatus({ enabled: false, hasToken: false, paired: false })
    }
  }
  useEffect(() => {
    void refresh()
    void api.getModels().then(setModels).catch(() => setModels([]))
  }, [])

  // Seed the voice fields from the server once, the first time we see a paired bot.
  useEffect(() => {
    if (status?.paired && !sttSeeded.current) {
      sttSeeded.current = true
      setStt({ baseUrl: status.transcription?.baseUrl ?? '', model: status.transcription?.model ?? '', key: '' })
    }
  }, [status?.paired, status?.transcription?.baseUrl, status?.transcription?.model])

  const saveStt = () => void api.telegramSettings({ transcription: { baseUrl: stt.baseUrl.trim(), model: stt.model.trim() } })

  // While waiting to be paired, poll so the card flips to "connected" when the user
  // sends the code to their bot.
  useEffect(() => {
    const waiting = status?.hasToken && !status.paired
    if (waiting && pollRef.current == null) {
      pollRef.current = window.setInterval(() => void refresh(), 3000)
    }
    if (!waiting && pollRef.current != null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [status?.hasToken, status?.paired])

  async function connect() {
    if (!token.trim()) return
    setBusy(true)
    setErr('')
    try {
      const r = await api.telegramConnect(token.trim())
      if (r.error) {
        setErr(r.error)
        return
      }
      setToken('')
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function repair() {
    setBusy(true)
    try {
      await api.telegramRepair()
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      await api.telegramDisconnect()
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!status) return <div className="setrow-d" style={{ padding: '8px 2px' }}>Loading…</div>

  const botLink = status.botUsername ? `https://t.me/${status.botUsername}` : undefined

  return (
    <>
      <div className="grouphdr">Telegram bot</div>

      {/* 1 — not connected: paste the bot token */}
      {!status.hasToken && (
        <div className="conn-card">
          <div className="conn-head">
            <div className="conn-ico tg">✈</div>
            <div className="conn-info">
              <div className="conn-title">Connect your Telegram bot</div>
              <div className="conn-sub">
                Send prompts and tasks to BlindHunter from Telegram. Create a bot with{' '}
                <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
                  @BotFather
                </a>{' '}
                and paste its token below.
              </div>
            </div>
          </div>
          <div className="conn-code-row" style={{ marginTop: 14 }}>
            <input
              className="conn-input"
              placeholder="Bot token (e.g. 123456:ABC-DEF…)"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void connect()
              }}
            />
            <button className="conn-go" onClick={connect} disabled={busy || !token.trim()}>
              {busy ? 'Connecting…' : 'Connect'}
            </button>
          </div>
          {err && <div className="conn-err">{err}</div>}
          <div className="conn-note">
            The token is stored encrypted on this machine. Anyone who messages your bot could otherwise control BlindHunter,
            so the next step locks it to your Telegram account.
          </div>
        </div>
      )}

      {/* 2 — connected but not yet claimed: show the pairing code */}
      {status.hasToken && !status.paired && (
        <div className="conn-card">
          <div className="conn-head">
            <div className="conn-ico tg">✈</div>
            <div className="conn-info">
              <div className="conn-title">Claim your bot {status.botUsername ? `(@${status.botUsername})` : ''}</div>
              <div className="conn-sub">
                Open{' '}
                {botLink ? (
                  <a href={botLink} target="_blank" rel="noreferrer">
                    your bot
                  </a>
                ) : (
                  'your bot'
                )}{' '}
                in Telegram and send it this code. Whoever sends it first becomes the sole owner.
              </div>
            </div>
          </div>
          <div className="tg-code">{status.pairingCode ?? '••••••'}</div>
          <div className="conn-hint">⏳ Waiting for you to send the code…</div>
          <button className="conn-dis" style={{ marginTop: 6 }} onClick={disconnect} disabled={busy}>
            Cancel
          </button>
        </div>
      )}

      {/* 3 — connected + paired: ready, with defaults */}
      {status.hasToken && status.paired && (
        <>
          <div className="conn-card is-connected">
            <div className="conn-ico tg">✈</div>
            <div className="conn-info">
              <div className="conn-title">
                Connected{status.botUsername ? ` — @${status.botUsername}` : ''}
              </div>
              <div className="conn-sub">Owner locked (Telegram id {status.ownerId}). Only you can use this bot.</div>
            </div>
            <button className="conn-dis" onClick={disconnect} disabled={busy}>
              Disconnect
            </button>
          </div>

          <div className="setrow" style={{ marginTop: 16 }}>
            <div>
              <div className="setrow-t">Model for Telegram</div>
              <div className="setrow-d">Which model runs when you message the bot.</div>
            </div>
            <select
              className="ctl"
              value={status.defaultModel ?? ''}
              onChange={(e) => {
                const v = e.target.value
                setStatus((s) => (s ? { ...s, defaultModel: v } : s))
                void api.telegramSettings({ defaultModel: v })
              }}
            >
              <option value="">(default model)</option>
              {models.map((m) => (
                <option key={m.ref} value={m.ref}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="setrow">
            <div>
              <div className="setrow-t">Workspace folder</div>
              <div className="setrow-d">Where the agent reads/writes and runs commands for Telegram tasks.</div>
            </div>
            <input
              className="conn-input"
              style={{ maxWidth: 280, fontFamily: 'var(--font-mono)' }}
              placeholder="e.g. C:/Users/you/BugBounty"
              defaultValue={status.defaultWorkspace ?? ''}
              onBlur={(e) => void api.telegramSettings({ defaultWorkspace: e.target.value.trim() })}
            />
          </div>

          <div className="grouphdr" style={{ marginTop: 20 }}>Voice (speech-to-text)</div>
          <div className="conn-note" style={{ marginTop: 0, marginBottom: 10 }}>
            Send the bot a 🎙️ voice message and it runs the spoken prompt. Transcription uses an OpenAI-compatible{' '}
            <code>/audio/transcriptions</code> endpoint — point it at a <b>local</b> whisper server (e.g.{' '}
            <a href="https://github.com/speaches-ai/speaches" target="_blank" rel="noreferrer">Speaches</a> /
            faster-whisper = fully offline, stays private) or a cloud one. Leave blank to disable voice.
          </div>

          <div className="setrow">
            <div>
              <div className="setrow-t">Endpoint base URL</div>
              <div className="setrow-d">Before <code>/audio/transcriptions</code>.</div>
            </div>
            <input
              className="conn-input"
              style={{ maxWidth: 280, fontFamily: 'var(--font-mono)' }}
              placeholder="http://localhost:8000/v1"
              value={stt.baseUrl}
              onChange={(e) => setStt((s) => ({ ...s, baseUrl: e.target.value }))}
              onBlur={saveStt}
            />
          </div>

          <div className="setrow">
            <div>
              <div className="setrow-t">Model</div>
              <div className="setrow-d">e.g. whisper-1, whisper-large-v3.</div>
            </div>
            <input
              className="conn-input"
              style={{ maxWidth: 280, fontFamily: 'var(--font-mono)' }}
              placeholder="whisper-1"
              value={stt.model}
              onChange={(e) => setStt((s) => ({ ...s, model: e.target.value }))}
              onBlur={saveStt}
            />
          </div>

          <div className="setrow">
            <div>
              <div className="setrow-t">API key</div>
              <div className="setrow-d">Optional — local servers usually need none. Stored encrypted.</div>
            </div>
            <input
              className="conn-input"
              type="password"
              style={{ maxWidth: 280, fontFamily: 'var(--font-mono)' }}
              placeholder={status.hasSttKey ? '•••• saved (type to replace)' : 'Optional'}
              value={stt.key}
              onChange={(e) => setStt((s) => ({ ...s, key: e.target.value }))}
              onBlur={() => stt.key.trim() && api.telegramSettings({ sttKey: stt.key.trim() })}
            />
          </div>

          <div className="conn-note" style={{ marginTop: 10 }}>
            Message your bot a prompt (text or voice) to run it. Commands: <b>/model</b> switch model · <b>/workspace</b>{' '}
            switch folder · <b>/sessions</b> open any session · <b>/new</b> fresh · <b>/stop</b> cancel · <b>/help</b>.
            Telegram runs use your default permission mode (Settings › Permissions). Re-pair to a different Telegram
            account:{' '}
            <button className="conn-reopen" onClick={repair} disabled={busy}>
              re-pair
            </button>
            .
          </div>
        </>
      )}
    </>
  )
}
