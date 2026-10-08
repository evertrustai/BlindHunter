import { useEffect, useRef, useState } from 'react'
import { api, baseName } from '../lib/api'
import type { DirEntry } from '../lib/api'

/**
 * Workspace folder chooser. Primary path is an in-app directory browser (works on any OS,
 * no zenity/kdialog needed — important on minimal Linux like Kali); a "Browse…" button also
 * tries the host OS native dialog where one is available.
 */
export function WorkspacePicker({
  workspace,
  onPick,
}: {
  workspace: string | null
  onPick: (path: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState('')
  const [parent, setParent] = useState<string | null>(null)
  const [dirs, setDirs] = useState<DirEntry[]>([])
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  async function load(path?: string) {
    setBusy(true)
    setErr('')
    try {
      const r = await api.listDir(path)
      setCur(r.path)
      setParent(r.parent)
      setTyped(r.path)
      setDirs(r.entries.filter((e) => e.type === 'dir'))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open that folder')
    } finally {
      setBusy(false)
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) void load(workspace ?? undefined)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function nativeBrowse() {
    try {
      const { path } = await api.pickFolder()
      if (path) {
        onPick(path)
        setOpen(false)
      }
    } catch {
      setErr('No native file dialog on this system — browse or paste a path above.')
    }
  }

  function useCurrent() {
    if (cur) {
      onPick(cur)
      setOpen(false)
    }
  }

  const label = busy && !open ? 'Opening…' : workspace ? baseName(workspace) : 'Open folder'

  return (
    <div className="pill wspick" ref={ref}>
      <button type="button" onClick={toggle} title={workspace ?? 'Choose a workspace folder'}>
        <span className="lead">▤</span> {label} <span className="chev">▾</span>
      </button>

      {open && (
        <div className="wspick-pop">
          <div className="wspick-path">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void load(typed)
              }}
              placeholder="Type or paste a folder path"
              spellCheck={false}
              autoFocus
            />
            <button className="wspick-go" title="Go to this path" onClick={() => void load(typed)}>
              →
            </button>
          </div>

          {err && <div className="wspick-err">{err}</div>}

          <div className="wspick-list">
            {parent && (
              <button className="wspick-row up" onClick={() => void load(parent)}>
                ↑ ..
              </button>
            )}
            {busy ? (
              <div className="wspick-note">Loading…</div>
            ) : dirs.length === 0 ? (
              <div className="wspick-note">No sub-folders here</div>
            ) : (
              dirs.map((d) => (
                <button key={d.path} className="wspick-row" title={d.path} onClick={() => void load(d.path)}>
                  <span className="wspick-ico">📁</span> {d.name}
                </button>
              ))
            )}
          </div>

          <div className="wspick-foot">
            <button className="wspick-native" onClick={nativeBrowse} title="Use the OS folder dialog (if available)">
              Browse…
            </button>
            <button className="wspick-use" onClick={useCurrent} disabled={!cur}>
              Use this folder
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
