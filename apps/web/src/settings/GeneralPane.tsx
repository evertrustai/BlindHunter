import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { AppSettings } from '../lib/api'
import { applyLanguage, applyTheme } from '../lib/appearance'
import { useT } from '../lib/i18n'
import { TokenActivity } from '../components/TokenActivity'

const LANGS: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'hi', label: 'हिन्दी' },
]

export function GeneralPane() {
  const t = useT()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void api.getSettings().then(setSettings).catch(() => setSettings(null))
  }, [])

  // Persist one field, update local state, and flash a "Saved" note.
  async function patch(field: keyof AppSettings, value: string) {
    setSettings((s) => (s ? { ...s, [field]: value } : s))
    try {
      await api.updateSettings({ [field]: value } as Partial<AppSettings>)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
    } catch {
      // ignore — the select still shows the attempted value
    }
  }

  if (!settings) {
    return <div className="setrow-d" style={{ padding: '8px 2px' }}>Loading settings…</div>
  }

  return (
    <>
      <TokenActivity />

      <div className="grouphdr">
        {t('Appearance')}
        {saved && <span className="saved-tag">✓ {t('Saved')}</span>}
      </div>
      <div className="setrow">
        <div>
          <div className="setrow-t">{t('Language')}</div>
          <div className="setrow-d">{t('Interface language and text direction (RTL for Arabic).')}</div>
        </div>
        <select
          className="ctl"
          aria-label="Language"
          value={settings.language}
          onChange={(e) => {
            applyLanguage(e.target.value)
            void patch('language', e.target.value)
          }}
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div className="setrow">
        <div>
          <div className="setrow-t">{t('Theme')}</div>
          <div className="setrow-d">{t('Light or dark appearance.')}</div>
        </div>
        <select
          className="ctl"
          aria-label="Theme"
          value={settings.theme}
          onChange={(e) => {
            applyTheme(e.target.value)
            void patch('theme', e.target.value)
          }}
        >
          <option value="dark">{t('Dark')}</option>
          <option value="light">{t('Light')}</option>
        </select>
      </div>

      <div className="grouphdr">{t('Agent environment')}</div>
      <div className="setrow">
        <div>
          <div className="setrow-t">{t('Where the agent runs')}</div>
          <div className="setrow-d">{t('Windows native, or inside WSL (Linux).')}</div>
        </div>
        <select
          className="ctl"
          aria-label="Agent environment"
          value={settings.agentEnvironment}
          onChange={(e) => void patch('agentEnvironment', e.target.value)}
        >
          <option value="windows">{t('Windows native')}</option>
          <option value="wsl">WSL</option>
        </select>
      </div>

      <div className="grouphdr">{t('Integrated terminal')}</div>
      <div className="setrow">
        <div>
          <div className="setrow-t">{t('Terminal shell')}</div>
          <div className="setrow-d">{t('Which shell the agent runs bash commands in.')}</div>
        </div>
        <select
          className="ctl"
          aria-label="Integrated terminal shell"
          value={settings.terminalShell}
          onChange={(e) => void patch('terminalShell', e.target.value)}
          disabled={settings.agentEnvironment === 'wsl'}
        >
          <option value="powershell">PowerShell</option>
          <option value="gitbash">Git Bash</option>
          <option value="wsl">WSL</option>
        </select>
      </div>
    </>
  )
}
