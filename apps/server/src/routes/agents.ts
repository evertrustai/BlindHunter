import type { FastifyInstance } from 'fastify'
import { listAgents, createAgent, updateAgent, deleteAgent, type AgentKind } from '../agents/store.js'

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/agents', async () => listAgents())

  app.post('/api/agents', async (req, reply) => {
    const body = req.body as { name?: string; description?: string; systemPrompt?: string; kind?: AgentKind }
    if (!body.name?.trim() || !body.systemPrompt?.trim()) {
      reply.code(400)
      return { error: 'name and systemPrompt are required' }
    }
    return createAgent({
      name: body.name,
      description: body.description,
      systemPrompt: body.systemPrompt,
      kind: body.kind,
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
