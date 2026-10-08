import { Dropdown, MenuItem } from './Dropdown'
import type { ModelRef, Usage } from '../lib/api'

function fmtTok(n: number): string {
  if (!n) return '0'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const PERMISSIONS = [
  { id: 'auto', t: 'Auto', d: 'Runs commands and edits on its own in the workspace' },
  { id: 'manual', t: 'Manual', d: 'Approve each command and file change' },
  { id: 'bypass', t: 'Bypass permissions', d: 'Skips all permission checks — use with care' },
] as const

const EFFORTS = [
  { id: 'low', t: 'Low' },
  { id: 'medium', t: 'Medium' },
  { id: 'high', t: 'High' },
  { id: 'extra', t: 'Extra' },
] as const

interface ComposerBarProps {
  models: ModelRef[]
  selectedModel: string | null
  onSelectModel: (ref: string) => void
  permission: string
  onPermission: (id: string) => void
  effort: string
  onEffort: (id: string) => void
  usage?: Usage | null
  onAttach?: () => void
  onMic?: () => void
  micActive?: boolean
  onBrowser?: () => void
  /** Number of terminal commands the agent has run this turn. */
  terminals?: number
  running?: boolean
}

/** The controls row shared by the console and chat composers: permission, model, effort, usage. */
export function ComposerBar({
  models,
  selectedModel,
  onSelectModel,
  permission,
  onPermission,
  effort,
  onEffort,
  usage,
  onAttach,
  onMic,
  micActive,
  onBrowser,
  terminals = 0,
  running = false,
}: ComposerBarProps) {
  const permLabel = PERMISSIONS.find((p) => p.id === permission)?.t ?? 'Auto'
  const current = models.find((m) => m.ref === selectedModel)
  const modelLabel = current ? current.name : models.length ? 'Select model' : 'No model'
  const effortLabel = EFFORTS.find((e) => e.id === effort)?.t ?? 'High'
  const ctxPct = usage && usage.context > 0 ? Math.min(100, Math.round((usage.prompt / usage.context) * 100)) : 0
  const meterStyle = { background: `conic-gradient(var(--amber) ${ctxPct}%, rgba(255,255,255,.16) 0)` }

  return (
    <div className="belowbar">
      <div className="l">
        <Dropdown
          buttonClassName="ghost"
          up
          label={<><span className="sh">🛡</span> {permLabel} <span className="chev">▾</span></>}
        >
          <div className="mlabel">Permission level</div>
          {PERMISSIONS.map((p) => (
            <MenuItem key={p.id} title={p.t} desc={p.d} checked={permission === p.id} onSelect={() => onPermission(p.id)} />
          ))}
        </Dropdown>
        {terminals > 0 && (
          <span className={running ? 'termchip working' : 'termchip'} title={`${terminals} terminal command${terminals === 1 ? '' : 's'} run this turn`}>
            <span className="tc-ico">⊟</span> {terminals}
          </span>
        )}
        <button className="icobtn" aria-label="Attach a file" onClick={onAttach}>
          ＋
        </button>
        <button
          className={micActive ? 'icobtn mic-on' : 'icobtn'}
          aria-label={micActive ? 'Stop voice input' : 'Voice input'}
          aria-pressed={micActive}
          onClick={onMic}
        >
          🎤
        </button>
        {onBrowser && (
          <button className="icobtn" aria-label="Open in-app browser" title="In-app browser" onClick={onBrowser}>
            🌐
          </button>
        )}
      </div>

      <div className="r">
        <Dropdown
          buttonClassName="model"
          align="right"
          up
          label={<><span className="name">{modelLabel}</span> <span className="chev">▾</span></>}
        >
          {models.length === 0 ? (
            <div className="mnote">No models — add a provider in Settings › Models</div>
          ) : (
            <>
              <div className="mlabel">Available models</div>
              {models.map((m) => (
                <MenuItem
                  key={m.ref}
                  title={m.name}
                  desc={m.providerName}
                  checked={selectedModel === m.ref}
                  onSelect={() => onSelectModel(m.ref)}
                />
              ))}
            </>
          )}
        </Dropdown>

        <Dropdown
          buttonClassName="model"
          align="right"
          up
          label={<><span className="eff">{effortLabel}</span> <span className="chev">▾</span></>}
        >
          <div className="mlabel">Reasoning effort</div>
          {EFFORTS.map((e) => (
            <MenuItem key={e.id} title={e.t} checked={effort === e.id} onSelect={() => onEffort(e.id)} />
          ))}
        </Dropdown>

        <Dropdown
          buttonClassName="usagebtn"
          align="right"
          up
          ariaLabel="Context and usage"
          label={<span className="meter" style={meterStyle} />}
        >
          <div className="mlabel">Context window</div>
          {usage ? (
            <div style={{ padding: '4px 10px 10px', minWidth: 240 }}>
              {usage.context > 0 && (
                <>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--txt)', marginBottom: 6 }}>
                    {fmtTok(usage.prompt)} / {fmtTok(usage.context)}{' '}
                    <span style={{ color: 'var(--txt-3)' }}>({ctxPct}%)</span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 4,
                      background: 'rgba(255,255,255,.08)',
                      overflow: 'hidden',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ height: '100%', width: `${ctxPct}%`, background: 'var(--amber)' }} />
                  </div>
                </>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--txt-2)',
                }}
              >
                <span>in {fmtTok(usage.prompt)}</span>
                <span>out {fmtTok(usage.completion)}</span>
                <span>total {fmtTok(usage.total)}</span>
              </div>
              {usage.context === 0 && (
                <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 8 }}>
                  Set the provider's default context window to see % used.
                </div>
              )}
            </div>
          ) : (
            <div className="mnote">Live usage appears after the first response.</div>
          )}
        </Dropdown>
      </div>
    </div>
  )
}
