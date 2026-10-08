import { useEffect, useState } from 'react'
import { GeneralPane } from '../settings/GeneralPane'
import { ModelsPane } from '../settings/ModelsPane'
import { PermissionsPane } from '../settings/PermissionsPane'
import { ImportPane } from '../settings/ImportPane'
import { PluginsPane } from '../settings/PluginsPane'
import { DeveloperPane } from '../settings/DeveloperPane'
import { AboutPane } from '../settings/AboutPane'
import type { SettingsTabId } from '../lib/commands'

const TABS: { id: SettingsTabId; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: '◐' },
  { id: 'models', label: 'Models', icon: '▤' },
  { id: 'permissions', label: 'Permissions', icon: '🛡' },
  { id: 'import', label: 'Import', icon: '⤓' },
  { id: 'plugins', label: 'Plugins', icon: '⧉' },
  { id: 'developer', label: 'Developer', icon: '⌘' },
  { id: 'about', label: 'About', icon: 'ⓘ' },
]

interface SettingsViewProps {
  onClose: () => void
  onDataChanged?: () => void
  /** Jump straight to a tab (e.g. opened via a "/" command) — defaults to General. */
  initialTab?: SettingsTabId
}

export function SettingsView({ onClose, onDataChanged, initialTab }: SettingsViewProps) {
  const [tab, setTab] = useState<SettingsTabId>(initialTab ?? 'general')

  // Re-sync if the caller opens Settings again on a different tab (e.g. another "/" command).
  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  return (
    <div>
      <div className="set-head">
        <div className="set-title">Settings</div>
        <div className="set-head-r">
          <button className="set-close" aria-label="Close settings" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>
      <div className="set-body">
        <nav className="set-nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'sn active' : 'sn'} onClick={() => setTab(t.id)}>
              <span className="lead">{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>
        <div className="set-content">
          {tab === 'general' && <GeneralPane />}
          {tab === 'models' && <ModelsPane />}
          {tab === 'permissions' && <PermissionsPane />}
          {tab === 'import' && <ImportPane onDataChanged={onDataChanged} />}
          {tab === 'plugins' && <PluginsPane />}
          {tab === 'developer' && <DeveloperPane />}
          {tab === 'about' && <AboutPane />}
        </div>
      </div>
    </div>
  )
}
