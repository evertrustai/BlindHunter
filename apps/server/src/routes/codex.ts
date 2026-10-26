import type { FastifyInstance } from 'fastify'
import { startDeviceAuth, pollDeviceAuth, status, disconnect } from '../auth/codex.js'
import { updateSettings, loadSettings } from '../config/store.js'
import type { Provider, ProviderModel } from '../config/types.js'

/** The synthetic provider that represents a connected ChatGPT (Codex) subscription. */
const CODEX_PROVIDER_ID = 'chatgpt-subscription'
// The Codex backend has no public model-list endpoint, so offer a known set the user can pick.
const CODEX_MODELS: ProviderModel[] = [
  { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', contextWindow: 272000 },
  { id: 'gpt-5.1-codex-max', name: 'GPT-5.1 Codex Max', contextWindow: 272000 },
  { id: 'gpt-5.1', name: 'GPT-5.1', contextWindow: 272000 },
  { id: 'gpt-5-codex', name: 'GPT-5 Codex', contextWindow: 272000 },
  { id: 'gpt-5', name: 'GPT-5', contextWindow: 272000 },
]

async function upsertCodexProvider(): Promise<Provider> {
  const prov: Provider = {
    id: CODEX_PROVIDER_ID,
    displayName: 'ChatGPT (subscription)',
    baseUrl: 'https://chatgpt.com/backend-api/codex',
    protocol: 'codex',
    defaultContext: 272000,
    models: CODEX_MODELS,
    enabled: true,
  }
  await updateSettings((s) => {
    const idx = s.providers.findIndex((p) => p.id === CODEX_PROVIDER_ID)
    if (idx >= 0) s.providers[idx] = prov
    else s.providers.push(prov)
    return s
  })
  return prov
}

export async function codexRoutes(app: FastifyInstance): Promise<void> {
  // Step 1: request a device code to show the user.
  app.post('/api/auth/codex/start', async (_req, reply) => {
    const r = await startDeviceAuth()
    if (!r.ok) {
      reply.code(400)
      return r
    }
    return r
  })

  // Step 2: poll until the user approves; on success, register the provider.
  app.post('/api/auth/codex/poll', async (req, reply) => {
    const { pollId } = req.body as { pollId?: string }
    if (!pollId) {
      reply.code(400)
      return { status: 'error', error: 'pollId is required' }
    }
    const r = await pollDeviceAuth(pollId)
    if (r.status === 'connected') {
      const prov = await upsertCodexProvider()
      return { status: 'connected', models: prov.models }
    }
    return r
  })

  app.get('/api/auth/codex/status', async () => {
    const st = await status()
    if (!st.connected) return st
    const settings = await loadSettings()
    return { ...st, models: settings.providers.find((p) => p.id === CODEX_PROVIDER_ID)?.models ?? [] }
  })

  app.post('/api/auth/codex/disconnect', async () => {
    await disconnect()
    await updateSettings((s) => {
      s.providers = s.providers.filter((p) => p.id !== CODEX_PROVIDER_ID)
      return s
    })
    return { ok: true }
  })
}
