import { useEffect, useRef, useState, type ReactNode } from 'react'
import { baseName } from '../lib/api'
import type { Group, Session } from '../lib/api'
import type { SettingsTabId } from '../lib/commands'
import { SessionRow } from './SessionRow'
import { ConfirmModal } from './Modal'

interface SidebarProps {
  sessions: Session[]
  groups: Group[]
  activeId?: string
  onNew: () => void
  onOpenSettings: (tab?: SettingsTabId) => void
  onOpenAgents: (kind: 'agent' | 'subagent') => void
  onOpen: (s: Session) => void
  onPin: (s: Session, pinned: boolean) => void
  onRename: (s: Session, title: string) => void
  onMove: (s: Session, groupId: string | null) => void
  onDelete: (s: Session) => void
  onCreateGroup: (name: string) => Promise<Group>
  onRenameGroup: (id: string, name: string) => void
  onDeleteGroup: (id: string) => void
  onCollapse: () => void
  onAddWorkspace: () => void
}

const SORTS = [
  { id: 'recent', label: 'Sort: recent first' },
  { id: 'name', label: 'Sort: name A–Z' },
  { id: 'oldest', label: 'Sort: oldest first' },
] as const

/** The label the row shows (session title, or workspace folder when unnamed). */
function sessionLabel(s: Session): string {
  return s.title && s.title !== 'New session' ? s.title : baseName(s.workspace) || 'New session'
}

/** Left rail: brand, new session, grouped/pinned recent sessions, settings. */
export function Sidebar(props: SidebarProps) {
  const { sessions, groups, activeId, onNew, onOpenSettings, onOpenAgents, onCollapse, onAddWorkspace } = props
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sortIdx, setSortIdx] = useState(0)
  const sort = SORTS[sortIdx]

  // Global shortcuts: Ctrl/Cmd+K opens search, Ctrl/Cmd+N starts a new session.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      } else if (k === 'n') {
        e.preventDefault()
        onNew()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNew])

  const q = query.trim().toLowerCase()
  const matched = q
    ? sessions.filter((s) => sessionLabel(s).toLowerCase().includes(q) || s.workspace.toLowerCase().includes(q))
    : sessions

  const pinned = matched.filter((s) => s.pinned)
  const unpinned = matched.filter((s) => !s.pinned)
  const groupIds = new Set(groups.map((g) => g.id))
  const ungrouped = [...unpinned.filter((s) => !s.groupId || !groupIds.has(s.groupId))].sort((a, b) => {
    if (sort.id === 'name') return sessionLabel(a).localeCompare(sessionLabel(b))
    const at = a.updatedAt ?? a.createdAt
    const bt = b.updatedAt ?? b.createdAt
    return sort.id === 'oldest' ? at - bt : bt - at
  })

  const row = (s: Session) => (
    <SessionRow
      key={s.id}
      session={s}
      groups={groups}
      active={s.id === activeId}
      onOpen={props.onOpen}
      onPin={props.onPin}
      onRename={props.onRename}
      onMove={props.onMove}
      onDelete={props.onDelete}
      onCreateGroup={props.onCreateGroup}
    />
  )

  return (
    <aside className="side">
      <div className="brand">
        <button className="logo" onClick={onNew}>
          <span className="wm-text">
            <span className="hl">B</span>LIND<span className="hl">H</span>UNTER
          </span>
        </button>
        <button className="icon-btn-plain" aria-label="Collapse sidebar" title="Collapse sidebar" onClick={onCollapse}>
          ⟨⟩
        </button>
      </div>

      <nav className="nav">
        <button className="nav-item primary" onClick={onNew}>
          <span className="ni-ico">⊕</span>
          <span className="ni-label">New session</span>
          <span className="kbd">Ctrl N</span>
        </button>
        <button
          className={searchOpen ? 'nav-item active' : 'nav-item'}
          onClick={() => {
            setSearchOpen((o) => !o)
            if (searchOpen) setQuery('')
          }}
        >
          <span className="ni-ico">⌕</span>
          <span className="ni-label">Search</span>
          <span className="kbd">Ctrl K</span>
        </button>
        <button className="nav-item" onClick={() => onOpenAgents('agent')}>
          <span className="ni-ico">{'⚡︎'}</span>
          <span className="ni-label">Automations</span>
        </button>
        <button className="nav-item" onClick={() => onOpenSettings('plugins')}>
          <span className="ni-ico">⊞</span>
          <span className="ni-label">Plugins</span>
        </button>
        <button className="nav-item" onClick={() => onOpenSettings('general')}>
          <span className="ni-ico">⚙</span>
          <span className="ni-label">Settings</span>
        </button>
      </nav>

      <div className="sec">
        Workspaces
        <span className="ico">
          <button aria-label="Sort sessions" title={sort.label} onClick={() => setSortIdx((i) => (i + 1) % SORTS.length)}>
            ⇅
          </button>
          <button aria-label="Add workspace" title="Open a folder as a new session" onClick={onAddWorkspace}>
            ＋
          </button>
        </span>
      </div>

      {searchOpen && (
        <input
          className="ws-search"
          autoFocus
          placeholder="Search sessions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('')
              setSearchOpen(false)
            }
          }}
        />
      )}

      <div className="ws-list">
        {sessions.length === 0 && <div className="ws-empty-hint">No sessions yet.</div>}
        {sessions.length > 0 && matched.length === 0 && <div className="ws-empty-hint">No sessions match “{query}”.</div>}

        {pinned.length > 0 && (
          <>
            <div className="group">Pinned</div>
            {pinned.map(row)}
          </>
        )}

        {groups.map((g) => {
          const gs = unpinned.filter((s) => s.groupId === g.id)
          if (gs.length === 0) return null
          return (
            <GroupSection
              key={g.id}
              group={g}
              count={gs.length}
              onRename={props.onRenameGroup}
              onDelete={props.onDeleteGroup}
            >
              {gs.map(row)}
            </GroupSection>
          )
        })}

        {ungrouped.length > 0 && (
          <>
            <div className="group">Recent</div>
            {ungrouped.map(row)}
          </>
        )}
      </div>
    </aside>
  )
}

interface GroupSectionProps {
  group: Group
  count: number
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  children: ReactNode
}

/** A collapsible-free group header with its own rename / delete menu. */
function GroupSection({ group, count, onRename, onDelete, children }: GroupSectionProps) {
  const [menu, setMenu] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(group.name)
  const [confirmDel, setConfirmDel] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menu])

  function openMenu(btn: HTMLElement) {
    const r = btn.getBoundingClientRect()
    const left = Math.max(8, r.right - 170)
    const top = r.bottom + 100 > window.innerHeight ? Math.max(8, r.top - 100) : r.bottom + 4
    setPos({ top, left })
    setMenu(true)
  }

  function commit() {
    setRenaming(false)
    const t = draft.trim()
    if (t && t !== group.name) onRename(group.id, t)
  }

  return (
    <>
      <div className="group grouphead" ref={ref}>
        {renaming ? (
          <input
            className="grp-rename"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setRenaming(false)
            }}
          />
        ) : (
          <>
            <span className="grp-name">{group.name}</span>
            <span className="grp-count">{count}</span>
            <button
              className="grp-kebab"
              aria-label="Group options"
              onClick={(e) => (menu ? setMenu(false) : openMenu(e.currentTarget))}
            >
              ⋮
            </button>
          </>
        )}
        {menu && (
          <div className="row-menu" role="menu" style={{ top: pos.top, left: pos.left }}>
            <button
              className="rmi"
              onClick={() => {
                setMenu(false)
                setDraft(group.name)
                setRenaming(true)
              }}
            >
              <span>Rename group</span>
            </button>
            <div className="rm-sep" />
            <button
              className="rmi danger"
              onClick={() => {
                setMenu(false)
                setConfirmDel(true)
              }}
            >
              <span>Delete group</span>
            </button>
          </div>
        )}
      </div>
      {children}
      {confirmDel && (
        <ConfirmModal
          title="Delete group?"
          message={`“${group.name}” will be removed. Its sessions move back to Recent.`}
          confirmLabel="Delete group"
          onCancel={() => setConfirmDel(false)}
          onConfirm={() => {
            setConfirmDel(false)
            onDelete(group.id)
          }}
        />
      )}
    </>
  )
}
