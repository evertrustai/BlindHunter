import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { SESSIONS_DIR, GROUPS_FILE } from '../config/paths.js'
import type { ChatMessage } from '../agent/types.js'

export interface Session {
  id: string
  title: string
  workspace: string
  model: string
  preset: string
  createdAt: number
  updatedAt: number
  pinned?: boolean
  groupId?: string | null
  /** The agent that has taken over this session (via @mention). */
  agentId?: string | null
  messages: ChatMessage[]
}

export type SessionSummary = Omit<Session, 'messages'> & { messageCount: number }

const sessions = new Map<string, Session>()

const DEFAULT_TITLE = 'New session'

/**
 * Build a short, human-readable session name from the first user prompt,
 * so "Recent" reads like the work ("Scan apple.com for open ports") instead
 * of a workspace folder shared across many sessions. Deterministic + offline.
 */
export function deriveTitle(text: string): string {
  let t = text
    .replace(/```[\s\S]*?```/g, ' ') // drop attachment/code blocks
    .replace(/^Attached file:.*$/gim, ' ') // drop attachment headers
    .replace(/[#*`>_~]/g, ' ') // strip markdown noise
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return ''
  const MAX = 46
  const words = t.split(' ')
  let title = words.length > 9 ? words.slice(0, 9).join(' ') : t
  if (title.length > MAX) title = title.slice(0, MAX).replace(/\s+\S*$/, '')
  const truncated = title.length < t.length
  title = title.charAt(0).toUpperCase() + title.slice(1)
  return truncated ? `${title}…` : title
}

/** Last path segment of a workspace, handling both / and \ separators. */
function basename(p: string): string {
  const parts = p.replace(/[/\\]+$/, '').split(/[/\\]/)
  return parts[parts.length - 1] ?? ''
}

/**
 * A session still "needs a name" if it has no title, the default, or a title
 * equal to its workspace folder — the latter was auto-set by an earlier build,
 * so it's machine-generated, not a name the user chose.
 */
export function isUnnamed(session: Session): boolean {
  const t = session.title
  return !t || t === DEFAULT_TITLE || t === basename(session.workspace)
}

/** Explicitly set a session's title (e.g. from LLM naming) and persist. */
export function setTitle(id: string, title: string): void {
  const s = sessions.get(id)
  if (!s || !title) return
  s.title = title
  persist(s)
}

/** Set a session's title from its first user message if it's still unnamed. */
function ensureTitle(session: Session, msgs: ChatMessage[]): void {
  if (!isUnnamed(session)) return
  const firstUser = msgs.find((m) => m.role === 'user')
  const title = firstUser ? deriveTitle(String(firstUser.content)) : ''
  if (title) session.title = title
}

/** Best-effort persist to ~/.blindhunter/sessions/<id>.json (fire-and-forget). */
function persist(session: Session): void {
  void (async () => {
    try {
      await fs.mkdir(SESSIONS_DIR, { recursive: true })
      await fs.writeFile(path.join(SESSIONS_DIR, `${session.id}.json`), JSON.stringify(session), 'utf8')
    } catch {
      /* best effort — a failed write shouldn't break a chat */
    }
  })()
}

/** Load persisted sessions on startup so "recent" survives restarts. */
export async function loadSessionsFromDisk(): Promise<void> {
  try {
    const files = await fs.readdir(SESSIONS_DIR)
    for (const f of files) {
      if (!f.endsWith('.json')) continue
      try {
        const s = JSON.parse(await fs.readFile(path.join(SESSIONS_DIR, f), 'utf8')) as Session
        if (typeof s.updatedAt !== 'number') s.updatedAt = s.createdAt
        // Backfill titles for sessions created before auto-naming existed.
        if (s.messages?.length && isUnnamed(s)) {
          ensureTitle(s, s.messages)
          persist(s)
        }
        sessions.set(s.id, s)
      } catch {
        /* skip a corrupt file */
      }
    }
  } catch {
    /* sessions dir doesn't exist yet */
  }
}

export function createSession(input: Partial<Session>): Session {
  const id = 'sess_' + randomBytes(5).toString('hex')
  const now = Date.now()
  const session: Session = {
    id,
    title: input.title ?? 'New session',
    workspace: input.workspace ?? process.cwd(),
    model: input.model ?? '',
    preset: input.preset ?? 'pentest',
    createdAt: now,
    updatedAt: now,
    messages: [],
  }
  sessions.set(id, session)
  persist(session)
  return session
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id)
}

/** Newest-first summaries for the sidebar. */
export function listSessions(): SessionSummary[] {
  return [...sessions.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ messages, ...rest }) => ({ ...rest, messageCount: messages.length }))
}

export function addMessages(id: string, msgs: ChatMessage[]): void {
  const session = sessions.get(id)
  if (!session) return
  ensureTitle(session, session.messages.length === 0 ? msgs : session.messages)
  session.messages.push(...msgs)
  session.updatedAt = Date.now()
  persist(session)
}

/** Patch mutable session fields (rename / pin / move to group) and persist. */
export function updateSession(
  id: string,
  patch: { title?: string; pinned?: boolean; groupId?: string | null; agentId?: string | null },
): Session | undefined {
  const session = sessions.get(id)
  if (!session) return undefined
  if (typeof patch.title === 'string' && patch.title.trim()) session.title = patch.title.trim().slice(0, 80)
  if (typeof patch.pinned === 'boolean') session.pinned = patch.pinned
  if (patch.groupId !== undefined) session.groupId = patch.groupId
  if (patch.agentId !== undefined) session.agentId = patch.agentId
  persist(session)
  return session
}

/** Set the active agent on a session (from an @mention) without bumping updatedAt. */
export function setSessionAgent(id: string, agentId: string | null): void {
  const session = sessions.get(id)
  if (!session) return
  session.agentId = agentId
  persist(session)
}

/** Permanently delete a session (memory + disk file). */
export async function deleteSession(id: string): Promise<boolean> {
  const existed = sessions.delete(id)
  try {
    await fs.rm(path.join(SESSIONS_DIR, `${id}.json`), { force: true })
  } catch {
    /* best effort */
  }
  return existed
}

/* ---------- groups ---------- */

export interface Group {
  id: string
  name: string
  createdAt: number
}

const groups = new Map<string, Group>()

function persistGroups(): void {
  void (async () => {
    try {
      await fs.mkdir(path.dirname(GROUPS_FILE), { recursive: true })
      await fs.writeFile(GROUPS_FILE, JSON.stringify([...groups.values()]), 'utf8')
    } catch {
      /* best effort */
    }
  })()
}

/** Load persisted groups on startup. */
export async function loadGroupsFromDisk(): Promise<void> {
  try {
    const arr = JSON.parse(await fs.readFile(GROUPS_FILE, 'utf8')) as Group[]
    for (const g of arr) if (g?.id) groups.set(g.id, g)
  } catch {
    /* no groups file yet */
  }
}

export function listGroups(): Group[] {
  return [...groups.values()].sort((a, b) => a.createdAt - b.createdAt)
}

/** Create a group (reusing one with the same name, case-insensitive). */
export function createGroup(name: string): Group {
  const clean = name.trim().slice(0, 40)
  const existing = [...groups.values()].find((g) => g.name.toLowerCase() === clean.toLowerCase())
  if (existing) return existing
  const group: Group = { id: 'grp_' + randomBytes(4).toString('hex'), name: clean, createdAt: Date.now() }
  groups.set(group.id, group)
  persistGroups()
  return group
}

export function renameGroup(id: string, name: string): Group | undefined {
  const g = groups.get(id)
  if (!g || !name.trim()) return undefined
  g.name = name.trim().slice(0, 40)
  persistGroups()
  return g
}

/** Delete a group and un-group any sessions that referenced it. */
export function deleteGroup(id: string): boolean {
  const existed = groups.delete(id)
  if (existed) {
    persistGroups()
    for (const s of sessions.values()) {
      if (s.groupId === id) {
        s.groupId = null
        persist(s)
      }
    }
  }
  return existed
}
