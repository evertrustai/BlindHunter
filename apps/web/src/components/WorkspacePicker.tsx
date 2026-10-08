import { useState } from 'react'
import { api, baseName } from '../lib/api'

/** Opens the host OS native folder chooser (via the server) and reports the chosen path. */
export function WorkspacePicker({
  workspace,
  onPick,
}: {
  workspace: string | null
  onPick: (path: string) => void
}) {
  const [busy, setBusy] = useState(false)

  async function open() {
    if (busy) return
    setBusy(true)
    try {
      const { path } = await api.pickFolder()
      if (path) onPick(path)
    } catch {
      // dialog unavailable (e.g. remote server) — ignore
    } finally {
      setBusy(false)
    }
  }

  const label = busy ? 'Opening…' : workspace ? baseName(workspace) : 'Open folder'

  return (
    <div className="pill">
      <button type="button" onClick={open} disabled={busy} title={workspace ?? 'Choose a workspace folder'}>
        <span className="lead">▤</span> {label} <span className="chev">▾</span>
      </button>
    </div>
  )
}
