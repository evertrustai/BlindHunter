import { promises as fs } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { AGENTS_FILE } from '../config/paths.js'
import { DEFAULT_PERSONA } from '../agent/prompt.js'

export type AgentKind = 'agent' | 'subagent'

export interface Agent {
  id: string
  /** @mention handle / spawn name — a slug (lowercase, letters/digits/hyphens). */
  name: string
  description: string
  systemPrompt: string
  kind: AgentKind
  builtin?: boolean
  createdAt: number
}

/** The always-present default. It's a top-level agent (@mentionable), never deletable. */
const BUILTIN: Agent = {
  id: 'builtin-pentest',
  name: 'pentest',
  description: 'End-to-end offensive-security operator — the built-in default.',
  systemPrompt: DEFAULT_PERSONA,
  kind: 'agent',
  builtin: true,
  createdAt: 0,
}

const agents = new Map<string, Agent>()

/** Normalize a display name into a safe @mention handle. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function persist(): void {
  void (async () => {
    try {
      // Only user-created agents are persisted; the built-in is seeded in memory.
      const arr = [...agents.values()].filter((a) => !a.builtin)
      await fs.writeFile(AGENTS_FILE, JSON.stringify(arr, null, 2), 'utf8')
    } catch {
      /* best effort */
    }
  })()
}

export async function loadAgentsFromDisk(): Promise<void> {
  agents.set(BUILTIN.id, BUILTIN)
  try {
    const arr = JSON.parse(await fs.readFile(AGENTS_FILE, 'utf8')) as Agent[]
    for (const a of arr) if (a?.id && a.id !== BUILTIN.id) agents.set(a.id, a)
  } catch {
    /* no agents file yet */
  }
}

export function listAgents(): Agent[] {
  return [...agents.values()].sort((a, b) => {
    if (a.builtin !== b.builtin) return a.builtin ? -1 : 1
    return a.createdAt - b.createdAt
  })
}

export function getAgent(id: string): Agent | undefined {
  return agents.get(id)
}

/** Resolve an @mention / spawn handle (case-insensitive) to a top-level agent or subagent. */
export function findByName(name: string, kind?: AgentKind): Agent | undefined {
  const n = slugify(name)
  return [...agents.values()].find((a) => a.name === n && (!kind || a.kind === kind))
}

export function listSubagents(): Agent[] {
  return listAgents().filter((a) => a.kind === 'subagent')
}

/** Ensure a name is unique by appending -2, -3, … if needed. */
function uniqueName(base: string, exceptId?: string): string {
  const slug = slugify(base) || 'agent'
  let name = slug
  let n = 2
  while ([...agents.values()].some((a) => a.name === name && a.id !== exceptId)) {
    name = `${slug}-${n++}`
  }
  return name
}

export function createAgent(input: {
  name: string
  description?: string
  systemPrompt: string
  kind?: AgentKind
}): Agent {
  const agent: Agent = {
    id: 'agt_' + randomBytes(4).toString('hex'),
    name: uniqueName(input.name),
    description: (input.description ?? '').trim().slice(0, 200),
    systemPrompt: input.systemPrompt.trim(),
    kind: input.kind === 'subagent' ? 'subagent' : 'agent',
    createdAt: Date.now(),
  }
  agents.set(agent.id, agent)
  persist()
  return agent
}

export function updateAgent(
  id: string,
  patch: { name?: string; description?: string; systemPrompt?: string; kind?: AgentKind },
): Agent | undefined {
  const a = agents.get(id)
  if (!a || a.builtin) return undefined // built-in is read-only
  if (typeof patch.name === 'string' && patch.name.trim()) a.name = uniqueName(patch.name, id)
  if (typeof patch.description === 'string') a.description = patch.description.trim().slice(0, 200)
  if (typeof patch.systemPrompt === 'string' && patch.systemPrompt.trim()) a.systemPrompt = patch.systemPrompt.trim()
  if (patch.kind === 'agent' || patch.kind === 'subagent') a.kind = patch.kind
  persist()
  return a
}

export function deleteAgent(id: string): boolean {
  const a = agents.get(id)
  if (!a || a.builtin) return false
  const ok = agents.delete(id)
  if (ok) persist()
  return ok
}
