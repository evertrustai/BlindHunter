import type { FastifyInstance } from 'fastify'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { HOME, SETTINGS_FILE } from '../config/paths.js'
import { loadSettings } from '../config/store.js'
import { TOOL_SCHEMAS } from '../tools/registry.js'

/**
 * Open a file or folder in the host OS. On Windows a config file (.yaml) usually
 * has no default association, so text files open in Notepad; folders in Explorer.
 */
function openInOS(target: string, kind: 'file' | 'dir'): void {
  if (process.platform === 'win32') {
    if (kind === 'dir') spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref()
    else spawn('notepad.exe', [target], { detached: true, stdio: 'ignore' }).unref()
  } else if (process.platform === 'darwin') {
    spawn('open', [target], { detached: true, stdio: 'ignore' }).unref()
  } else {
    spawn('xdg-open', [target], { detached: true, stdio: 'ignore' }).unref()
  }
}

const VERSION = '0.1.0.1'
const REPO = 'evertrustai/BlindHunter'

function versionParts(v: string): number[] {
  return v.replace(/^v/i, '').split(/[.\-+]/).map((n) => parseInt(n, 10) || 0)
}
function isNewer(latest: string, current: string): boolean {
  const a = versionParts(latest)
  const b = versionParts(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

export async function systemRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/system/info', async () => ({ home: HOME, settingsFile: SETTINGS_FILE, platform: process.platform }))

  // Check GitHub for a newer release than the running build.
  app.get('/api/system/check-update', async () => {
    const repoUrl = `https://github.com/${REPO}`
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { 'user-agent': 'blindhunter', accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(10000),
      })
      if (res.status === 404) {
        return { current: VERSION, latest: null, updateAvailable: false, url: repoUrl, state: 'no-releases' }
      }
      if (!res.ok) {
        return { current: VERSION, latest: null, updateAvailable: false, url: repoUrl, state: 'error', error: `GitHub ${res.status}` }
      }
      const j = (await res.json()) as { tag_name?: string; html_url?: string }
      const latest = (j.tag_name ?? '').replace(/^v/i, '')
      const url = j.html_url || `${repoUrl}/releases`
      const updateAvailable = latest ? isNewer(latest, VERSION) : false
      return { current: VERSION, latest, updateAvailable, url, state: updateAvailable ? 'update' : 'latest' }
    } catch (e) {
      return { current: VERSION, latest: null, updateAvailable: false, url: repoUrl, state: 'error', error: e instanceof Error ? e.message : String(e) }
    }
  })

  // Open the config file or config directory in the OS. Only these fixed targets.
  app.post('/api/system/open', async (req, reply) => {
    const { target } = req.body as { target?: string }
    const p = target === 'config-file' ? SETTINGS_FILE : target === 'config-dir' ? HOME : null
    if (!p) {
      reply.code(400)
      return { error: 'unknown target' }
    }
    if (!existsSync(p)) {
      reply.code(404)
      return { error: `not found: ${p}` }
    }
    try {
      openInOS(p, target === 'config-file' ? 'file' : 'dir')
      return { ok: true, path: p }
    } catch (e) {
      reply.code(500)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })

  // The agent's tool inventory, with each tool's enabled state.
  app.get('/api/plugins', async () => {
    const settings = await loadSettings()
    const disabled = new Set(settings.disabledTools ?? [])
    const tools = TOOL_SCHEMAS.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      enabled: !disabled.has(t.function.name),
    }))
    return { tools }
  })
}
