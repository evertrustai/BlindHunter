import type { FastifyInstance } from 'fastify'
import { listSkills, skillBody } from '../skills/store.js'

/** Pre-installed skills: list them (for the UI + composer) and fetch one's full playbook. */
export async function skillsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/skills', async () =>
    listSkills().map((s) => ({ command: s.command, name: s.name, description: s.description })),
  )

  app.get('/api/skills/:command', async (req, reply) => {
    const { command } = req.params as { command: string }
    const body = skillBody(command)
    if (!body) {
      reply.code(404)
      return { error: 'skill not found' }
    }
    return { command, body }
  })
}
