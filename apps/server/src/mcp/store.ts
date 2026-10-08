import { promises as fs } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { MCP_FILE } from '../config/paths.js'

export type McpTransport = 'stdio' | 'sse' | 'http'

export interface McpServerConfig {
  id: string
  name: string
  transport: McpTransport
  /** stdio: the command + args to spawn. */
  command?: string
  args?: string[]
  env?: Record<string, string>
  /** sse / http: the server URL. */
  url?: string
  enabled: boolean
  createdAt: number
}

const servers = new Map<string, McpServerConfig>()

function persist(): void {
  void (async () => {
    try {
      await fs.writeFile(MCP_FILE, JSON.stringify([...servers.values()], null, 2), 'utf8')
    } catch {
      /* best effort */
    }
  })()
}

export async function loadMcpFromDisk(): Promise<void> {
  try {
    const arr = JSON.parse(await fs.readFile(MCP_FILE, 'utf8')) as McpServerConfig[]
    for (const s of arr) if (s?.id) servers.set(s.id, s)
  } catch {
    /* no mcp file yet */
  }
}

export function listMcpServers(): McpServerConfig[] {
  return [...servers.values()].sort((a, b) => a.createdAt - b.createdAt)
}

export function getMcpServer(id: string): McpServerConfig | undefined {
  return servers.get(id)
}

export function createMcpServer(input: Partial<McpServerConfig>): McpServerConfig {
  const transport: McpTransport = input.transport === 'sse' || input.transport === 'http' ? input.transport : 'stdio'
  const s: McpServerConfig = {
    id: 'mcp_' + randomBytes(4).toString('hex'),
    name: (input.name ?? '').trim().slice(0, 60) || 'MCP server',
    transport,
    command: input.command?.trim() || undefined,
    args: Array.isArray(input.args) ? input.args : undefined,
    env: input.env && typeof input.env === 'object' ? input.env : undefined,
    url: input.url?.trim() || undefined,
    enabled: input.enabled !== false,
    createdAt: Date.now(),
  }
  servers.set(s.id, s)
  persist()
  return s
}

export function updateMcpServer(id: string, patch: Partial<McpServerConfig>): McpServerConfig | undefined {
  const s = servers.get(id)
  if (!s) return undefined
  if (typeof patch.name === 'string' && patch.name.trim()) s.name = patch.name.trim().slice(0, 60)
  if (patch.transport === 'stdio' || patch.transport === 'sse' || patch.transport === 'http') s.transport = patch.transport
  if (patch.command !== undefined) s.command = patch.command?.trim() || undefined
  if (patch.args !== undefined) s.args = Array.isArray(patch.args) ? patch.args : undefined
  if (patch.env !== undefined) s.env = patch.env && typeof patch.env === 'object' ? patch.env : undefined
  if (patch.url !== undefined) s.url = patch.url?.trim() || undefined
  if (typeof patch.enabled === 'boolean') s.enabled = patch.enabled
  persist()
  return s
}

export function deleteMcpServer(id: string): boolean {
  const ok = servers.delete(id)
  if (ok) persist()
  return ok
}
