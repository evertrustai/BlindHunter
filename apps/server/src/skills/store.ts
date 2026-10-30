import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Pre-installed skill library. Skills are offensive-security playbooks (SKILL.md files)
 * bundled in the repo's /skills dir — so cloning BlindHunter ships them all, no install step.
 * Each skill has a /command; the agent gets an index of every command in its system prompt and
 * loads a skill's full playbook on demand via the use_skill tool (progressive disclosure, so
 * 200+ skills don't bloat every request).
 */

export interface Skill {
  command: string // invoked as /<command>
  name: string
  description: string
  dir: string // absolute path to the skill folder
  supporting: string[] // relative paths of extra files (references/scripts/playbooks/…)
}

/** Locate the bundled /skills dir, robust to where the server was started from. */
function skillsDir(): string {
  if (process.env.BLINDHUNTER_SKILLS_DIR) return process.env.BLINDHUNTER_SKILLS_DIR
  const here = path.dirname(fileURLToPath(import.meta.url)) // apps/server/src/skills
  const candidates = [
    path.resolve(here, '../../../../skills'), // repo root /skills (from src/skills)
    path.resolve(process.cwd(), 'skills'),
    path.resolve(process.cwd(), '../../skills'), // when cwd = apps/server
  ]
  return candidates.find((c) => existsSync(c)) ?? candidates[0]
}

let registry: Skill[] = []
let loaded = false

function collectFiles(dir: string, base: string, out: string[]): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) collectFiles(full, base, out)
    else if (e.name !== 'SKILL.md') out.push(path.relative(base, full).replace(/\\/g, '/'))
  }
}

function parseSkill(dir: string): Skill | null {
  const file = path.join(dir, 'SKILL.md')
  if (!existsSync(file)) return null
  const md = readFileSync(file, 'utf8')
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md)
  let name = path.basename(dir)
  let description = ''
  if (fm) {
    const nm = /\bname:\s*(.+)/.exec(fm[1])
    if (nm) name = nm[1].trim().replace(/^["']|["']$/g, '')
    // description may be inline, quoted, or a >/| block scalar spanning lines
    const dm = /\bdescription:\s*([\s\S]*?)(?:\n[A-Za-z_][\w-]*:\s|\s*$)/.exec(fm[1])
    if (dm) description = dm[1].trim().replace(/^[>|]\s*/, '').replace(/^["']|["']$/g, '').replace(/\s+/g, ' ')
  }
  // Some skills have no frontmatter description (or no frontmatter at all) — fall back to the
  // first real paragraph of the body so every skill still gets a meaningful one-liner.
  if (!description) {
    const body = fm ? md.slice(fm[0].length) : md
    const para = body
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('```') && !l.startsWith('>'))
    if (para) description = para.replace(/[*_`]/g, '').replace(/\s+/g, ' ')
  }
  const command = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  const supporting: string[] = []
  try {
    collectFiles(dir, dir, supporting)
  } catch {
    /* ignore */
  }
  return { command: command || path.basename(dir), name, description, dir, supporting }
}

export function loadSkills(): void {
  const base = skillsDir()
  registry = []
  loaded = true
  if (!existsSync(base)) return
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    try {
      if (!statSync(path.join(base, e.name, 'SKILL.md')).isFile()) continue
    } catch {
      continue
    }
    const s = parseSkill(path.join(base, e.name))
    if (s) registry.push(s)
  }
  // Dedupe by command, keep first; sort for a stable index.
  const seen = new Set<string>()
  registry = registry.filter((s) => (seen.has(s.command) ? false : (seen.add(s.command), true)))
  registry.sort((a, b) => a.command.localeCompare(b.command))
}

export function listSkills(): Skill[] {
  if (!loaded) loadSkills()
  return registry
}

export function getSkill(command: string): Skill | undefined {
  if (!loaded) loadSkills()
  const c = command.replace(/^\//, '').trim().toLowerCase()
  return registry.find((s) => s.command === c)
}

/** The full SKILL.md playbook for a command, with a note about its supporting files. */
export function skillBody(command: string): string | undefined {
  const s = getSkill(command)
  if (!s) return undefined
  let body = readFileSync(path.join(s.dir, 'SKILL.md'), 'utf8')
  if (s.supporting.length) {
    body += `\n\n---\nSupporting files for this skill (read them with your file tools, under ${s.dir}):\n${s.supporting
      .map((f) => `- ${f}`)
      .join('\n')}`
  }
  return body
}

/** The skills index injected into the system prompt: every command + a short description. */
export function skillsIndex(): string {
  const skills = listSkills()
  if (!skills.length) return ''
  const lines = skills.map((s) => `- /${s.command} — ${(s.description || s.name).slice(0, 110)}`)
  return (
    `## Installed skills (${skills.length})\n` +
    `These offensive-security playbooks are pre-installed. Each has a /command. When a task matches one, ` +
    `call the \`use_skill\` tool with that command (e.g. use_skill "${skills[0].command}") to load its full ` +
    `step-by-step playbook, then follow it. The user may also invoke a skill directly by typing its /command.\n\n` +
    lines.join('\n')
  )
}
