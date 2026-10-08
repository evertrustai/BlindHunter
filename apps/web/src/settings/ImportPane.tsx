import { useEffect, useState } from 'react'
import { Toggle } from '../components/Toggle'
import { ConfirmModal } from '../components/Modal'
import { api } from '../lib/api'

const SOURCES = [
  { id: 'deepseek-harness', label: 'DeepSeek Harness' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'opencode', label: 'opencode' },
]

export function ImportPane({ onDataChanged }: { onDataChanged?: () => void }) {
  const [autosync, setAutosync] = useState<boolean | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState<{ source: string; label: string; count: number } | null>(null)

  useEffect(() => {
    void api
      .getSettings()
      .then((s) => setAutosync(s.importAutosync))
      .catch(() => setAutosync(false))
  }, [])

  async function toggleAutosync(on: boolean) {
    setAutosync(on)
    try {
      await api.updateSettings({ importAutosync: on })
    } catch {
      // ignore
    }
  }

  // Scan first (dry run), then confirm before creating sessions.
  async function startImport(source: string, label: string) {
    setBusy(source)
    setStatus((s) => ({ ...s, [source]: '' }))
    try {
      const res = await api.importFrom(source, true)
      const count = res.count ?? 0
      if (count === 0) setStatus((s) => ({ ...s, [source]: `No new ${label} projects found.` }))
      else setConfirm({ source, label, count })
    } catch {
      setStatus((s) => ({ ...s, [source]: 'Scan failed.' }))
    } finally {
      setBusy(null)
    }
  }

  async function doImport() {
    if (!confirm) return
    const { source, label } = confirm
    setConfirm(null)
    setBusy(source)
    try {
      const res = await api.importFrom(source, false)
      const n = res.imported ?? 0
      setStatus((s) => ({ ...s, [source]: `Imported ${n} project${n === 1 ? '' : 's'} into “${res.group ?? label}”.` }))
      onDataChanged?.()
    } catch {
      setStatus((s) => ({ ...s, [source]: 'Import failed.' }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="grouphdr">Import</div>
      <div className="setrow-d" style={{ padding: '0 0 6px' }}>
        Bring the projects you've worked on in other AI coding tools into BlindHunter.
      </div>

      <div className="grouphdr">Autosync</div>
      <div className="setrow">
        <div>
          <div className="setrow-t">Keep imports in sync</div>
          <div className="setrow-d">
            Remember connected sources so re-importing only pulls in new projects (imports never duplicate).
          </div>
        </div>
        <Toggle label="Keep imports in sync" checked={autosync ?? false} onChange={toggleAutosync} />
      </div>

      <div className="grouphdr">Import from another tool</div>
      {SOURCES.map((s) => (
        <div className="imp-row" key={s.id}>
          <span className="imp-ic">◧</span>
          <span className="imp-nm">
            {s.label}
            {status[s.id] && <span className="imp-status">{status[s.id]}</span>}
          </span>
          <button className="imp-btn" disabled={busy === s.id} onClick={() => startImport(s.id, s.label)}>
            {busy === s.id ? '…' : 'Import'}
          </button>
        </div>
      ))}

      {confirm && (
        <ConfirmModal
          title={`Import from ${confirm.label}?`}
          message={`Found ${confirm.count} project${confirm.count === 1 ? '' : 's'}. They'll be added as sessions in a “${confirm.label}” group so your Recent list stays tidy.`}
          confirmLabel="Import"
          danger={false}
          onCancel={() => setConfirm(null)}
          onConfirm={doImport}
        />
      )}
    </>
  )
}
