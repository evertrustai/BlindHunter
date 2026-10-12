import type { FastifyInstance } from 'fastify'
import { loadSettings, updateSettings } from '../config/store.js'
import type { Settings } from '../config/types.js'

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/settings', async () => loadSettings())

  app.patch('/api/settings', async (req) => {
    const patch = req.body as Partial<Settings>
    // Serialized read-modify-write so a concurrent patch to another field isn't lost. (QA-15)
    const next = await updateSettings((current) => ({ ...current, ...patch }))
    // Apply the log level live so Debug/Trace take effect without a restart.
    if (next.logLevel && next.logLevel !== app.log.level) app.log.level = next.logLevel
    return next
  })
}
