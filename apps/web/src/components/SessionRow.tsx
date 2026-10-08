import { useEffect, useRef, useState } from 'react'
import { baseName } from '../lib/api'
import type { Group, Session } from '../lib/api'
import { ConfirmModal, PromptModal } from './Modal'

interface Props {
  session: Session
  groups: Group[]
  active: boolean
  onOpen: (s: Session) => void
  onPin: (s: Session, pinned: boolean) => void
  onRename: (s: Session, title: string) => void
  onMove: (s: Session, groupId: string | null) => void
  onDelete: (s: Session) => void
  onCreateGroup: (name: string) => Promise<Group>
}

/** One session row: click to open, ⋮ menu to pin / rename / move-to-group / delete. */
export function SessionRow({ session, groups, active, onOpen, onPin, onRename, onMove, onDelete, onCreateGroup }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [view, setView] = useState<'root' | 'move'>('root')
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(session.title)
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const named = Boolean(session.title && session.title !== 'New session')
  const label = named ? session.title : baseName(session.workspace) || 'New session'

  function openMenu(btn: HTMLElement) {
    const r = btn.getBoundingClientRect()
    const W = 180
    const H = 210
    const left = Math.max(8, r.right - W)
    const top = r.bottom + H > window.innerHeight ? Math.max(8, r.top - H) : r.bottom + 4
    setPos({ top, left })
    setView('root')
    setMenuOpen(true)
  }
  function closeMenu() {
    setMenuOpen(false)
    setView('root')
  }

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) closeMenu()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  function startRename() {
    closeMenu()
    setDraft(session.title === 'New session' ? '' : session.title)
    setRenaming(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }
  function commitRename() {
    const t = draft.trim()
    setRenaming(false)
    if (t && t !== session.title) onRename(session, t)
  }

  function openNewGroup() {
    closeMenu()
    setNewGroupOpen(true)
  }
  async function submitNewGroup(name: string) {
    setNewGroupOpen(false)
    const g = await onCreateGroup(name)
    onMove(session, g.id)
  }

  if (renaming) {
    return (
      <div className="ws renaming" ref={rowRef}>
        <span className="dot" />
        <input
          ref={inputRef}
          className="ws-rename"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setRenaming(false)
          }}
          onBlur={commitRename}
        />
      </div>
    )
  }

  return (
    <div
      className={active ? 'ws active' : 'ws'}
      ref={rowRef}
      title={`${named ? session.title + '\n' : ''}${session.workspace}`}
    >
      <button className="ws-open" onClick={() => onOpen(session)}>
        <span className={session.pinned ? 'dot pinned' : 'dot'} />
        <span className="ws-label">{label}</span>
      </button>
      <button
        className="ws-kebab"
        aria-label="Session options"
        onClick={(e) => (menuOpen ? closeMenu() : openMenu(e.currentTarget))}
      >
        ⋮
      </button>

      {menuOpen && (
        <div className="row-menu" role="menu" style={{ top: pos.top, left: pos.left }}>
          {view === 'root' ? (
            <>
              <button
                className="rmi"
                onClick={() => {
                  onPin(session, !session.pinned)
                  closeMenu()
                }}
              >
                <span>{session.pinned ? 'Unpin' : 'Pin'}</span>
                <span className="rmk">P</span>
              </button>
              <button className="rmi" onClick={startRename}>
                <span>Rename</span>
                <span className="rmk">R</span>
              </button>
              <button className="rmi" onClick={() => setView('move')}>
                <span>Move to group</span>
                <span className="rmk">›</span>
              </button>
              <div className="rm-sep" />
              <button
                className="rmi danger"
                onClick={() => {
                  closeMenu()
                  setConfirmDelete(true)
                }}
              >
                <span>Delete</span>
                <span className="rmk">D</span>
              </button>
            </>
          ) : (
            <>
              <button className="rmi back" onClick={() => setView('root')}>
                <span className="rmk">‹</span>
                <span>Move to group</span>
              </button>
              <div className="rm-sep" />
              {session.groupId && (
                <button
                  className="rmi"
                  onClick={() => {
                    onMove(session, null)
                    closeMenu()
                  }}
                >
                  <span>Ungroup</span>
                </button>
              )}
              {groups.map((g) => (
                <button
                  key={g.id}
                  className="rmi"
                  onClick={() => {
                    onMove(session, g.id)
                    closeMenu()
                  }}
                >
                  <span>{g.name}</span>
                  {session.groupId === g.id && <span className="rmk">✓</span>}
                </button>
              ))}
              <div className="rm-sep" />
              <button className="rmi" onClick={openNewGroup}>
                <span>＋ New group…</span>
              </button>
            </>
          )}
        </div>
      )}

      {newGroupOpen && (
        <PromptModal
          title="New group"
          placeholder="Group name"
          confirmLabel="Save"
          onCancel={() => setNewGroupOpen(false)}
          onSubmit={submitNewGroup}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete session?"
          message={`“${label}” will be permanently deleted. This can’t be undone.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false)
            onDelete(session)
          }}
        />
      )}
    </div>
  )
}
