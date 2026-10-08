import type { FastifyInstance } from 'fastify'
import { loadSettings, saveSettings, loadCredentials, saveCredentials } from '../config/store.js'
import type { Provider } from '../config/types.js'

export async function providerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/providers', async () => {
    const settings = await loadSettings()
    const creds = await loadCredentials()
    return settings.providers.map((p) => ({ ...p, hasKey: Boolean(creds[p.id]) }))
  })

  app.post('/api/providers', async (req) => {
    const { apiKey, ...provider } = req.body as Provider & { apiKey?: string }
    const settings = await loadSettings()
    const idx = settings.providers.findIndex((p) => p.id === provider.id)
    if (idx >= 0) settings.providers[idx] = provider
    else settings.providers.push(provider)
    await saveSettings(settings)
    if (apiKey) {
      const creds = await loadCredentials()
      creds[provider.id] = apiKey
      await saveCredentials(creds)
    }
    return { ok: true }
  })

  // Fetch the model list from a provider's /models endpoint (for the "Fetch available models" button).
  app.post('/api/providers/fetch-models', async (req, reply) => {
    const { baseUrl, apiKey, headers, providerId } = req.body as {
      baseUrl?: string
      apiKey?: string
      headers?: Record<string, string>
      providerId?: string
    }
    if (!baseUrl) {
      reply.code(400)
      return { error: 'A Base URL is required.' }
    }
    // Only ever send a STORED key to the provider's own configured base URL — never to an
    // arbitrary host supplied in the request (that would exfiltrate the key). A caller
    // testing a new/other URL must pass its apiKey explicitly in the body.
    let key = apiKey
    if (!key && providerId) {
      const norm = (u: string) => u.replace(/\/+$/, '').toLowerCase()
      const stored = (await loadSettings()).providers.find((p) => p.id === providerId)
      if (stored && norm(stored.baseUrl) === norm(baseUrl)) {
        key = (await loadCredentials())[providerId]
      }
    }

    const url = baseUrl.replace(/\/+$/, '') + '/models'
    try {
      const res = await fetch(url, {
        headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...(headers ?? {}) },
      })
      if (!res.ok) {
        reply.code(res.status === 401 ? 401 : 400)
        return { error: `Models endpoint returned ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` }
      }
      const body = (await res.json()) as {
        data?: { id: string; grade?: string; vision?: boolean }[]
      }
      const models = (body.data ?? []).map((m) => ({ id: m.id, grade: m.grade, vision: m.vision }))
      return { models }
    } catch (e) {
      reply.code(502)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })

  app.delete('/api/providers/:id', async (req) => {
    const { id } = req.params as { id: string }
    const settings = await loadSettings()
    settings.providers = settings.providers.filter((p) => p.id !== id)
    await saveSettings(settings)
    const creds = await loadCredentials()
    delete creds[id]
    await saveCredentials(creds)
    return { ok: true }
  })
}
