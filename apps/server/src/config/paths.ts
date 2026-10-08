import os from 'node:os'
import path from 'node:path'

/** All BlindHunter runtime state lives under one home dir (config, credentials, sessions). */
export const HOME = process.env.BLINDHUNTER_HOME ?? path.join(os.homedir(), '.blindhunter')
export const SETTINGS_FILE = path.join(HOME, 'settings.yaml')
export const CREDENTIALS_FILE = path.join(HOME, 'credentials.yaml')
export const SESSIONS_DIR = path.join(HOME, 'sessions')
export const GROUPS_FILE = path.join(HOME, 'groups.json')
export const AGENTS_FILE = path.join(HOME, 'agents.json')
export const MCP_FILE = path.join(HOME, 'mcp.json')
