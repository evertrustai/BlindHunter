import { useEffect, useState } from 'react'
import { Toggle } from '../components/Toggle'
import { api } from '../lib/api'
import type { AppSettings } from '../lib/api'

export function DeveloperPane() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [home, setHome] = useState('~/.blindhunter')
  const [saved, setSaved] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    void api.getSettings().then(setSettings).catch(() => setSettings(null))
    void api
      .getSystemInfo()
      .then((i) => setHome(i.home))
      .catch(() => {})
  }, [])

  async function patch(field: keyof AppSettings, value: string | boolean) {
    setSettings((s) => (s ? { ...s, [field]: value } : s))
    try {
      await api.updateSettings({ [field]: value } as Partial<AppSettings>)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
    } catch {
      // ignore
    }
  }

  async function open(target: 'config-file' | 'config-dir') {
    setNote('')
    try {
      const r = await api.openConfig(target)
      if (r.error) setNote(r.error)
    } catch {
      setNote('Could not open — is the server running locally?')
    }
  }

  if (!settings) return <div className="setrow-d" style={{ padding: '8px 2px' }}>Loading…</div>

  return (
    <>
      <div className="grouphdr">
        Configuration
        {saved && <span className="saved-tag">✓ Saved</span>}
      </div>
      <div className="setrow">
        <div>
          <div className="setrow-t">Configuration file</div>
          <div className="setrow-d">Edit BlindHunter's raw config on disk — providers, presets, and settings.</div>
        </div>
        <button className="prov-lnk" onClick={() => open('config-file')}>
          ⌗ Open
        </button>
      </div>
      <div className="setrow">
        <div>
          <div className="setrow-t">Config directory</div>
          <div className="setrow-d">Where config and preset files live.</div>
        </div>
        <button className="prov-lnk" onClick={() => open('config-dir')} title={home}>
          ▤ {home}
        </button>
      </div>
      {note && <div className="setrow-d" style={{ color: 'var(--danger)' }}>{note}</div>}

      <div className="grouphdr">Agent presets</div>
      <div className="setrow">
        <div>
          <div className="setrow-t">Manage agent presets</div>
          <div className="setrow-d">
            Preset files (tools, prompt, capabilities) live in the config directory. Opens the folder.
          </div>
        </div>
        <button className="prov-lnk" onClick={() => open('config-dir')}>
          Manage
        </button>
      </div>

      <div className="grouphdr">Advanced</div>
      <div className="setrow">
        <div>
          <div className="setrow-t">Log level</div>
          <div className="setrow-d">Verbosity of agent and server logs (applied live).</div>
        </div>
        <select
          className="ctl"
          aria-label="Log level"
          value={settings.logLevel}
          onChange={(e) => void patch('logLevel', e.target.value)}
        >
          <option value="info">Info</option>
          <option value="debug">Debug</option>
          <option value="trace">Trace</option>
        </select>
      </div>
      <div className="setrow">
        <div>
          <div className="setrow-t">Experimental features</div>
          <div className="setrow-d">Enable in-progress capabilities. May be unstable.</div>
        </div>
        <Toggle
          label="Experimental features"
          checked={settings.experimental}
          onChange={(on) => void patch('experimental', on)}
        />
      </div>
      <div className="setrow">
        <div>
          <div className="setrow-t">Accept insecure HTTPS certs (in-app browser)</div>
          <div className="setrow-d">
            Let the browser load self-signed / invalid certs for proxy interception (Burp). Off is
            safer — on exposes browsing to MITM. Reopen the browser panel after changing.
          </div>
        </div>
        <Toggle
          label="Accept insecure HTTPS certs"
          checked={settings.browserInsecureCerts === true}
          onChange={(on) => void patch('browserInsecureCerts', on)}
        />
      </div>
    </>
  )
}
