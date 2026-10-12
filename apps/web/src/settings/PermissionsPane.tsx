import { useEffect, useState } from 'react'
import { Toggle } from '../components/Toggle'
import { api } from '../lib/api'
import type { AppSettings } from '../lib/api'

export function PermissionsPane() {
  const [mode, setMode] = useState<AppSettings['defaultPermission'] | null>(null)
  const [maxSteps, setMaxSteps] = useState<string>('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void api
      .getSettings()
      .then((s) => {
        setMode(s.defaultPermission)
        setMaxSteps(String(s.maxSteps ?? 120))
      })
      .catch(() => setMode('auto'))
  }, [])

  function flashSaved() {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  async function set(next: AppSettings['defaultPermission']) {
    setMode(next)
    try {
      await api.updateSettings({ defaultPermission: next })
      flashSaved()
    } catch {
      // ignore
    }
  }

  async function saveMaxSteps() {
    const n = Math.max(1, Math.min(1000, Math.floor(Number(maxSteps) || 120)))
    setMaxSteps(String(n))
    try {
      await api.updateSettings({ maxSteps: n })
      flashSaved()
    } catch {
      // ignore
    }
  }

  if (!mode) return <div className="setrow-d" style={{ padding: '8px 2px' }}>Loading…</div>

  return (
    <>
      <div className="grouphdr">
        Permissions
        {saved && <span className="saved-tag">✓ Saved</span>}
      </div>
      <div className="setrow">
        <div>
          <div className="setrow-t">Default permissions</div>
          <div className="setrow-d">
            BlindHunter reads and edits files in the current workspace, and asks before touching anything outside it.
          </div>
        </div>
        {/* On = auto. Turning it on turns Full access off. */}
        <Toggle label="Default permissions" checked={mode !== 'bypass'} onChange={() => set('auto')} />
      </div>
      <div className="setrow">
        <div>
          <div className="setrow-t">Full access</div>
          <div className="setrow-d">
            Runs commands and edits any file on the host with network access, without asking. Significantly raises the
            risk of data loss or leaks.
          </div>
        </div>
        {/* On = bypass. Mutually exclusive with Default permissions. */}
        <Toggle label="Full access" checked={mode === 'bypass'} onChange={(on) => set(on ? 'bypass' : 'auto')} />
      </div>
      <div className="setrow-d" style={{ paddingTop: 12 }}>
        This sets the default for new sessions. The composer's Auto / Manual / Bypass picker overrides it per session.
      </div>

      <div className="grouphdr" style={{ marginTop: 22 }}>
        Autonomy
      </div>
      <div className="setrow">
        <div>
          <div className="setrow-t">Max steps per task</div>
          <div className="setrow-d">
            How many think → act → observe rounds the agent may run for a single task before it
            stops itself. This is a runaway safety limit, not a target — the agent normally
            finishes on its own well before reaching it. Raise it for very long autonomous
            hunts, or lower it to cap cost. (1–1000)
          </div>
        </div>
        <input
          type="number"
          min={1}
          max={1000}
          value={maxSteps}
          onChange={(e) => setMaxSteps(e.target.value)}
          onBlur={saveMaxSteps}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          style={{
            width: 84,
            padding: '7px 9px',
            background: 'var(--raised)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            color: 'var(--txt)',
            fontSize: 13,
            textAlign: 'right',
          }}
        />
      </div>
    </>
  )
}
