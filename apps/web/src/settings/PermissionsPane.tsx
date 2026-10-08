import { useEffect, useState } from 'react'
import { Toggle } from '../components/Toggle'
import { api } from '../lib/api'
import type { AppSettings } from '../lib/api'

export function PermissionsPane() {
  const [mode, setMode] = useState<AppSettings['defaultPermission'] | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void api
      .getSettings()
      .then((s) => setMode(s.defaultPermission))
      .catch(() => setMode('auto'))
  }, [])

  async function set(next: AppSettings['defaultPermission']) {
    setMode(next)
    try {
      await api.updateSettings({ defaultPermission: next })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
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
    </>
  )
}
