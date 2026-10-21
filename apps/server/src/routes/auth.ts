import type { FastifyInstance } from 'fastify'
import { startLogin, completeLogin, status, disconnect, listModels } from '../auth/claude.js'
import { updateSettings, loadSettings } from '../config/store.js'
import type { Provider, ProviderModel } from '../config/types.js'

/** The synthetic provider that represents a connected Claude Pro/Max subscription. */
const CLAUDE_PROVIDER_ID = 'claude-subscription'
const FALLBACK_MODELS: ProviderModel[] = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', contextWindow: 200000 },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', contextWindow: 200000 },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', contextWindow: 200000 },
]

/** Create/update the Claude subscription provider from the models the account can use. */
async function upsertClaudeProvider(): Promise<Provider> {
  const fetched = await listModels()
  const models: ProviderModel[] = fetched.length
    ? fetched.map((m) => ({ id: m.id, name: m.name ?? m.id, contextWindow: 200000 }))
    : FALLBACK_MODELS
  const prov: Provider = {
    id: CLAUDE_PROVIDER_ID,
    displayName: 'Claude (subscription)',
    baseUrl: 'https://api.anthropic.com',
    protocol: 'anthropic',
    defaultContext: 200000,
    models,
    enabled: true,
  }
  await updateSettings((s) => {
    const idx = s.providers.findIndex((p) => p.id === CLAUDE_PROVIDER_ID)
    if (idx >= 0) s.providers[idx] = prov
    else s.providers.push(prov)
    return s
  })
  return prov
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Begin a Claude sign-in: returns the URL to approve in the browser + an id to finish with.
  app.post('/api/auth/claude/start', async () => startLogin())

  // Finish the sign-in with the pasted code; registers the subscription as a provider.
  app.post('/api/auth/claude/complete', async (req, reply) => {
    const { pkceId, code } = req.body as { pkceId?: string; code?: string }
    if (!pkceId || !code) {
      reply.code(400)
      return { ok: false, error: 'pkceId and code are required' }
    }
    const r = await completeLogin(pkceId, code)
    if (!r.ok) {
      reply.code(400)
      return r
    }
    const prov = await upsertClaudeProvider()
    return { ok: true, models: prov.models }
  })

  app.get('/api/auth/claude/status', async () => {
    const st = await status()
    if (!st.connected) return st
    const settings = await loadSettings()
    return { ...st, models: settings.providers.find((p) => p.id === CLAUDE_PROVIDER_ID)?.models ?? [] }
  })

  // Re-fetch the model list for an already-connected subscription.
  app.post('/api/auth/claude/refresh-models', async (_req, reply) => {
    const st = await status()
    if (!st.connected) {
      reply.code(400)
      return { error: 'Not connected.' }
    }
    const prov = await upsertClaudeProvider()
    return { models: prov.models }
  })

  app.post('/api/auth/claude/disconnect', async () => {
    await disconnect()
    await updateSettings((s) => {
      s.providers = s.providers.filter((p) => p.id !== CLAUDE_PROVIDER_ID)
      return s
    })
    return { ok: true }
  })
}
