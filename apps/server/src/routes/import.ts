import type { FastifyInstance } from 'fastify'
import { homedir } from 'node:os'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { open, readdir } from 'node:fs/promises'
import { createSession, updateSession, createGroup, listSessions } from '../sessions/store.js'

const SOURCE_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  opencode: 'opencode',
  'deepseek-harness': 'DeepSeek Harness',
}

/** Read the first "cwd" value from the head of a session .jsonl (files can be large). */
async function firstCwd(file: string): Promise<string | null> {
  let fh
  try {
    fh = await open(file, 'r')
    const buf = Buffer.alloc(512 * 1024)
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0)
    const text = buf.toString('utf8', 0, bytesRead)
    const m = text.match(/"cwd":"((?:[^"\\]|\\.)*)"/)
    return m ? m[1].replace(/\\\\/g, '\\').replace(/\\"/g, '"') : null
  } catch {
    return null
  } finally {
    await fh?.close()
  }
}

/** Discover the real, still-existing project workspaces Claude Code has recorded. */
async function scanClaudeCode(): Promise<string[]> {
  const dir = path.join(homedir(), '.claude', 'projects')
  let folders: string[]
  try {
    folders = await readdir(dir)
  } catch {
    return []
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const folder of folders) {
    if (out.length >= 200) break
    const folderPath = path.join(dir, folder)
    let files: string[]
    try {
      files = await readdir(folderPath)
    } catch {
      continue
    }
    const jsonl = files.find((f) => f.endsWith('.jsonl'))
    if (!jsonl) continue
    const cwd = await firstCwd(path.join(folderPath, jsonl))
    if (!cwd) continue
    const norm = cwd.replace(/[\\/]+$/, '')
    const key = norm.toLowerCase()
    if (seen.has(key)) continue
    if (/[\\/]AppData[\\/]Local[\\/]Temp[\\/]/i.test(norm)) continue // skip scratchpads
    if (!existsSync(norm)) continue
    seen.add(key)
    out.push(norm)
  }
  return out
}

export async function importRoutes(app: FastifyInstance): Promise<void> {
  // dryRun=true reports how many items would import; otherwise performs the import.
  app.post('/api/import/:source', async (req) => {
    const { source } = req.params as { source: string }
    const { dryRun } = (req.body ?? {}) as { dryRun?: boolean }
    const label = SOURCE_LABELS[source] ?? source

    if (source === 'claude-code') {
      // Only import projects that don't already have a session (idempotent re-runs).
      const existing = new Set(listSessions().map((s) => s.workspace.replace(/[\\/]+$/, '').toLowerCase()))
      const fresh = (await scanClaudeCode()).filter((p) => !existing.has(p.toLowerCase()))
      if (dryRun) return { count: fresh.length }
      if (fresh.length === 0) return { imported: 0, message: 'No new Claude Code projects to import.' }
      const group = createGroup(label)
      for (const p of fresh) {
        const s = createSession({ workspace: p, title: path.basename(p) })
        updateSession(s.id, { groupId: group.id })
      }
      return { imported: fresh.length, group: group.name }
    }

    // opencode / DeepSeek Harness: no reliable on-disk format to read here yet.
    if (dryRun) return { count: 0 }
    return { imported: 0, message: `No ${label} data found on this machine.` }
  })
}
