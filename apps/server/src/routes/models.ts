import type { FastifyInstance } from 'fastify'
import { loadSettings } from '../config/store.js'

export async function modelRoutes(app: FastifyInstance): Promise<void> {
  // All models across enabled providers, grouped-ready for the composer picker.
  app.get('/api/models', async () => {
    const settings = await loadSettings()
    return settings.providers
      .filter((p) => p.enabled)
      .flatMap((p) =>
        p.models.map((m) => ({
          ref: `${p.id}/${m.id}`,
          providerId: p.id,
          providerName: p.displayName,
          id: m.id,
          name: m.name ?? m.id,
          contextWindow: m.contextWindow ?? p.defaultContext,
        })),
      )
  })
}
