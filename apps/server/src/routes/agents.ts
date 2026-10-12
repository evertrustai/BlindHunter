import type { FastifyInstance } from 'fastify'
import { listAgents, createAgent, updateAgent, deleteAgent, type AgentKind } from '../agents/store.js'

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/agents', async () => listAgents())

  app.post('/api/agents', async (req, reply) => {
    const body = (req.body ?? {}) as { name?: unknown; description?: unknown; systemPrompt?: unknown; kind?: unknown }
    // Validate types at runtime — a numeric/malformed name must be a clean 400, not a
    // 500 from calling .trim() on a non-string. (QA-25)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt.trim() : ''
    if (!name || !systemPrompt) {
      reply.code(400)
      return { error: 'name and systemPrompt are required and must be strings' }
    }
    return createAgent({
      name,
      description: typeof body.description === 'string' ? body.description : undefined,
      systemPrompt,
      kind: body.kind === 'subagent' ? 'subagent' : body.kind === 'agent' ? 'agent' : undefined,
    })
  })

  app.patch('/api/agents/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as { name?: string; description?: string; systemPrompt?: string; kind?: AgentKind }
    const updated = updateAgent(id, body)
    if (!updated) {
      reply.code(404)
      return { error: 'agent not found or is read-only' }
    }
    return updated
  })

  app.delete('/api/agents/:id', async (req) => {
    const { id } = req.params as { id: string }
    return { ok: deleteAgent(id) }
  })
}
