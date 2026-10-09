import { useState } from 'react'
import maintainerMark from '../assets/maintainer-mark.jpg'
import { api } from '../lib/api'

const SPEC: { k: string; v: string }[] = [
  { k: 'Version', v: '0.1.0.1' },
  { k: 'License', v: 'MIT' },
]

type UpdateInfo = Awaited<ReturnType<typeof api.checkUpdate>>

const LINKS = [
  { label: 'GitHub', href: 'https://github.com/evertrustai' },
  { label: 'LinkedIn', href: 'https://linkedin.com/in/ananthanrayananr' },
  { label: 'Instagram', href: 'https://instagram.com/evertrustai' },
  { label: 'Portfolio', href: 'https://evertrustai.github.io/portfolio/' },
  { label: 'Email', href: 'mailto:evertrustai@gmail.com' },
]

export function AboutPane() {
  const [upd, setUpd] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState(false)

  async function checkForUpdate() {
    setChecking(true)
    setUpd(null)
    try {
      const r = await api.checkUpdate()
      setUpd(r)
      // A newer release exists → take the user to it to download. Only follow
      // real http(s) links so a tampered response can't inject a javascript: URL.
      if (r.updateAvailable && /^https?:\/\//i.test(r.url ?? '')) {
        window.open(r.url, '_blank', 'noreferrer')
      }
    } catch {
      setUpd({ current: '0.1.0.1', latest: null, updateAvailable: false, url: 'https://github.com/evertrustai/BlindHunter', state: 'error' })
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <div className="ab-head">
        <div className="ab-word">
          <span className="hl">B</span>LIND<span className="hl">H</span>UNTER
        </div>
        <span className="ab-status">
          <span className="dot" /> in development
        </span>
      </div>
      <p className="ab-lede">
        A privacy-first, model-agnostic agent for authorized security testing. Self-hosted, connected
        to any provider you choose — cloud or local — so nothing leaves your machine you didn't send.
      </p>

      <div className="ab-spec">
        {SPEC.map((row) => (
          <div className="ab-row" key={row.k}>
            <span className="ab-k">{row.k}</span>
            <span className="ab-v">{row.v}</span>
          </div>
        ))}
      </div>

      <div className="ab-actions">
        <button className="ab-action" onClick={checkForUpdate} disabled={checking}>
          <span className="ic">⟳</span> {checking ? 'Checking…' : 'Check for updates'}
        </button>
        <a className="ab-action" href="https://github.com/evertrustai/BlindHunter/issues" target="_blank" rel="noreferrer">
          <span className="ic">⚑</span> Report an issue
        </a>
      </div>
      {upd && (
        <div className={`ab-update ${upd.state}`}>
          {upd.state === 'update' ? (
            <>
              Update available — <b>v{upd.latest}</b> (you have {upd.current}).{' '}
              <a href={upd.url} target="_blank" rel="noreferrer">
                Download ↗
              </a>
            </>
          ) : upd.state === 'latest' ? (
            <>✓ You're on the latest version ({upd.current}).</>
          ) : upd.state === 'no-releases' ? (
            <>
              You're on the current dev build ({upd.current}) — no releases published yet.{' '}
              <a href={upd.url} target="_blank" rel="noreferrer">
                View repository ↗
              </a>
            </>
          ) : (
            <>
              Couldn't reach GitHub to check.{' '}
              <a href={upd.url} target="_blank" rel="noreferrer">
                View repository ↗
              </a>
            </>
          )}
        </div>
      )}

      <div className="grouphdr">Maintainer</div>
      <div className="ab-maint">
        <span className="ab-mono">
          <img src={maintainerMark} alt="" />
        </span>
        <div className="ab-mtext">
          <div className="ab-mname">evertrustai</div>
          <div className="ab-mrole">Creator &amp; maintainer</div>
        </div>
      </div>
      <div className="ab-links">
        {LINKS.map((l, i) => (
          <span className="ab-lk" key={l.label}>
            <a href={l.href} target="_blank" rel="noreferrer">
              {l.label}
            </a>
            {i < LINKS.length - 1 && <span className="sep">·</span>}
          </span>
        ))}
      </div>

      <div className="ab-foot">Built for authorized security testing only — use responsibly.</div>
    </>
  )
}
