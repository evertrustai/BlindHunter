import type { FastifyInstance } from 'fastify'
import { loadSettings, saveSettings } from '../config/store.js'
import type { Settings } from '../config/types.js'

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/settings', async () => loadSettings())

  app.patch('/api/settings', async (req) => {
    const current = await loadSettings()
    const next: Settings = { ...current, ...(req.body as Partial<Settings>) }
    await saveSettings(next)
    // Apply the log level live so Debug/Trace take effect without a restart.
    if (next.logLevel && next.logLevel !== current.logLevel) app.log.level = next.logLevel
    return next
  })
}
