import type { FastifyInstance } from 'fastify'
import {
  listMcpServers,
  getMcpServer,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
  type McpServerConfig,
} from '../mcp/store.js'
import { syncServer, disconnectServer, mcpStatuses } from '../mcp/manager.js'

/** Merge each server's config with its live connection status. */
function withStatus() {
  const status = new Map(mcpStatuses().map((s) => [s.id, s]))
  return listMcpServers().map((cfg) => ({ ...cfg, ...(status.get(cfg.id) ?? { status: 'unknown', toolCount: 0, tools: [] }) }))
}

export async function mcpRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/mcp', async () => withStatus())

  app.post('/api/mcp', async (req, reply) => {
    const body = req.body as Partial<McpServerConfig>
    if (!body.name?.trim()) {
      reply.code(400)
      return { error: 'name is required' }
    }
    if (body.transport === 'stdio' ? !body.command?.trim() : !body.url?.trim()) {
      reply.code(400)
      return { error: body.transport === 'stdio' ? 'command is required' : 'url is required' }
    }
    const server = createMcpServer(body)
    await syncServer(server) // connect immediately so tools show up
    return withStatus().find((s) => s.id === server.id)
  })

  app.patch('/api/mcp/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const updated = updateMcpServer(id, req.body as Partial<McpServerConfig>)
    if (!updated) {
      reply.code(404)
      return { error: 'server not found' }
    }
    await syncServer(updated) // reconnect with the new config / enabled state
    return withStatus().find((s) => s.id === id)
  })

  app.delete('/api/mcp/:id', async (req) => {
    const { id } = req.params as { id: string }
    await disconnectServer(id)
    return { ok: deleteMcpServer(id) }
  })

  // Retry connecting a server (e.g. after starting Burp).
  app.post('/api/mcp/:id/reconnect', async (req, reply) => {
    const { id } = req.params as { id: string }
    const cfg = getMcpServer(id)
    if (!cfg) {
      reply.code(404)
      return { error: 'server not found' }
    }
    await syncServer(cfg)
    return withStatus().find((s) => s.id === id)
  })
}
