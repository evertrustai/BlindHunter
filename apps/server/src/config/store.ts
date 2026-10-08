import { promises as fs } from 'node:fs'
import { parse, stringify } from 'yaml'
import { HOME, SETTINGS_FILE, CREDENTIALS_FILE } from './paths.js'
import type { Settings, Credentials } from './types.js'

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'en',
  agentEnvironment: 'windows',
  terminalShell: 'powershell',
  defaultPermission: 'auto',
  importAutosync: false,
  logLevel: 'info',
  experimental: false,
  disabledTools: [],
  defaultModel: undefined,
  providers: [],
}

async function ensureHome(): Promise<void> {
  await fs.mkdir(HOME, { recursive: true })
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf8')
    return { ...DEFAULT_SETTINGS, ...(parse(raw) as Partial<Settings>) }
  } catch {
    return { ...DEFAULT_SETTINGS, providers: [] }
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await ensureHome()
  await fs.writeFile(SETTINGS_FILE, stringify(settings), 'utf8')
}

export async function loadCredentials(): Promise<Credentials> {
  try {
    return (parse(await fs.readFile(CREDENTIALS_FILE, 'utf8')) as Credentials) ?? {}
  } catch {
    return {}
  }
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  await ensureHome()
  // Owner-only permissions (0600). On Windows this mode is a no-op, but the file lives under
  // the user profile (~/.blindhunter), which is already ACL-restricted to the user by default.
  await fs.writeFile(CREDENTIALS_FILE, stringify(creds), { encoding: 'utf8', mode: 0o600 })
}
