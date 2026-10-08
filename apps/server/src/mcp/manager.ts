import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { ExtraTool } from '../agent/types.js'
import { listMcpServers, getMcpServer, type McpServerConfig } from './store.js'

interface McpTool {
  name: string
  description?: string
  inputSchema?: unknown
}

interface Conn {
  status: 'connected' | 'error' | 'disabled'
  client?: Client
  tools: McpTool[]
  error?: string
}

const conns = new Map<string, Conn>()

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'srv'
}

/** Inherit the host env (so commands find their binaries), overlaid with any config env. */
function cleanEnv(extra?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') out[k] = v
  if (extra) for (const [k, v] of Object.entries(extra)) out[k] = v
  return out
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
  ])
}

async function connect(cfg: McpServerConfig): Promise<{ client: Client; tools: McpTool[] }> {
  const client = new Client({ name: 'blindhunter', version: '0.1.0' }, { capabilities: {} })
  let transport
  if (cfg.transport === 'stdio') {
    if (!cfg.command) throw new Error('stdio server needs a command')
    transport = new StdioClientTransport({ command: cfg.command, args: cfg.args ?? [], env: cleanEnv(cfg.env) })
  } else {
    if (!cfg.url) throw new Error(`${cfg.transport} server needs a url`)
    const url = new URL(cfg.url)
    transport = cfg.transport === 'sse' ? new SSEClientTransport(url) : new StreamableHTTPClientTransport(url)
  }
  await withTimeout(client.connect(transport), 45000, 'MCP connect')
  const res = (await withTimeout(client.listTools(), 20000, 'MCP listTools')) as { tools?: McpTool[] }
  return { client, tools: res.tools ?? [] }
}

export async function disconnectServer(id: string): Promise<void> {
  const c = conns.get(id)
  if (c?.client) {
    try {
      await c.client.close()
    } catch {
      /* ignore */
    }
  }
  conns.delete(id)
}

/** (Re)connect one server to match its current config. */
export async function syncServer(cfg: McpServerConfig): Promise<void> {
  await disconnectServer(cfg.id)
  if (!cfg.enabled) {
    conns.set(cfg.id, { status: 'disabled', tools: [] })
    return
  }
  try {
    const { client, tools } = await connect(cfg)
    conns.set(cfg.id, { status: 'connected', client, tools })
  } catch (e) {
    conns.set(cfg.id, { status: 'error', tools: [], error: e instanceof Error ? e.message : String(e) })
  }
}

/** Connect every configured server on startup (in parallel, non-fatal on failure). */
export async function initMcp(): Promise<void> {
  await Promise.all(listMcpServers().map((cfg) => syncServer(cfg)))
}

/** Per-server status for the UI. */
export function mcpStatuses(): { id: string; status: string; toolCount: number; error?: string; tools: string[] }[] {
  return listMcpServers().map((cfg) => {
    const c = conns.get(cfg.id)
    return {
      id: cfg.id,
      status: c?.status ?? (cfg.enabled ? 'connecting' : 'disabled'),
      toolCount: c?.tools.length ?? 0,
      error: c?.error,
      tools: c?.tools.map((t) => t.name) ?? [],
    }
  })
}

async function callMcpTool(client: Client, name: string, args: Record<string, unknown>): Promise<string> {
  const res = (await withTimeout(client.callTool({ name, arguments: args }), 120000, `MCP ${name}`)) as {
    content?: { type: string; text?: string }[]
    isError?: boolean
  }
  const text = (res.content ?? [])
    .map((b) => (b.type === 'text' ? (b.text ?? '') : `[${b.type} content]`))
    .join('\n')
    .trim()
  return (res.isError ? '[tool error] ' : '') + (text || '(no output)')
}

/** All connected servers' tools, as agent ExtraTools namespaced mcp_<server>_<tool>. */
export function mcpExtraTools(): ExtraTool[] {
  const out: ExtraTool[] = []
  const used = new Set<string>()
  for (const [id, c] of conns) {
    if (c.status !== 'connected' || !c.client) continue
    const client = c.client
    const serverSlug = slug(getMcpServer(id)?.name ?? id)
    for (const t of c.tools) {
      let name = `mcp_${serverSlug}_${slug(t.name)}`.slice(0, 60)
      while (used.has(name)) name = name.slice(0, 58) + '_' + out.length
      used.add(name)
      const realName = t.name
      out.push({
        schema: {
          type: 'function',
          function: {
            name,
            description: t.description || realName,
            parameters: t.inputSchema ?? { type: 'object', properties: {} },
          },
        },
        run: (args) => callMcpTool(client, realName, args),
      })
    }
  }
  return out
}
