import type { FastifyInstance } from 'fastify'
import { randomInt } from 'node:crypto'
import { loadSettings, updateSettings, loadCredentials, saveCredentials } from '../config/store.js'
import { getMe } from '../telegram/api.js'
import { startBot, stopBot, restartBot } from '../telegram/bot.js'
import { STT_KEY } from '../telegram/transcribe.js'

const TOKEN_KEY = 'telegram'
const newCode = () => String(randomInt(100000, 1000000))

export async function telegramRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/telegram/status', async () => {
    const settings = await loadSettings()
    const creds = await loadCredentials()
    const tg = settings.telegram
    return {
      enabled: Boolean(tg?.enabled),
      hasToken: Boolean(creds[TOKEN_KEY]),
      botUsername: tg?.botUsername,
      paired: Boolean(tg?.ownerId),
      ownerId: tg?.ownerId,
      // Only expose the pairing code while still unpaired.
      pairingCode: tg?.ownerId ? undefined : tg?.pairingCode,
      defaultModel: tg?.defaultModel,
      defaultWorkspace: tg?.defaultWorkspace,
      // Voice speech-to-text config (the API key itself is never returned).
      transcription: tg?.transcription,
      hasSttKey: Boolean(creds[STT_KEY]),
    }
  })

  // Validate + store the bot token, start the bot, and hand back a pairing code.
  app.post('/api/telegram/connect', async (req, reply) => {
    const { token } = req.body as { token?: string }
    if (!token?.trim()) {
      reply.code(400)
      return { error: 'Bot token is required.' }
    }
    let me: { username?: string }
    try {
      me = await getMe(token.trim())
    } catch (e) {
      reply.code(400)
      return { error: `That token didn't work: ${e instanceof Error ? e.message : String(e)}` }
    }
    const creds = await loadCredentials()
    creds[TOKEN_KEY] = token.trim()
    await saveCredentials(creds)
    const pairingCode = newCode()
    await updateSettings((s) => {
      s.telegram = {
        enabled: true,
        botUsername: me.username,
        pairingCode,
        ownerId: undefined,
        defaultModel: s.telegram?.defaultModel,
        defaultWorkspace: s.telegram?.defaultWorkspace,
      }
      return s
    })
    await restartBot()
    return { ok: true, botUsername: me.username, pairingCode }
  })

  // Re-pair: forget the current owner and issue a fresh code.
  app.post('/api/telegram/repair', async (_req, reply) => {
    const settings = await loadSettings()
    if (!settings.telegram?.enabled) {
      reply.code(400)
      return { error: 'Not connected.' }
    }
    const pairingCode = newCode()
    await updateSettings((s) => {
      if (s.telegram) {
        s.telegram.ownerId = undefined
        s.telegram.pairingCode = pairingCode
      }
      return s
    })
    await restartBot()
    return { pairingCode }
  })

  app.patch('/api/telegram/settings', async (req) => {
    const { defaultModel, defaultWorkspace, transcription, sttKey } = req.body as {
      defaultModel?: string
      defaultWorkspace?: string
      transcription?: { baseUrl?: string; model?: string }
      sttKey?: string
    }
    await updateSettings((s) => {
      if (!s.telegram) s.telegram = { enabled: false }
      if (defaultModel !== undefined) s.telegram.defaultModel = defaultModel
      if (defaultWorkspace !== undefined) s.telegram.defaultWorkspace = defaultWorkspace
      if (transcription !== undefined) s.telegram.transcription = transcription
      return s
    })
    // The STT API key lives in the credentials vault, never in settings.
    if (sttKey !== undefined) {
      const creds = await loadCredentials()
      if (sttKey.trim()) creds[STT_KEY] = sttKey.trim()
      else delete creds[STT_KEY]
      await saveCredentials(creds)
    }
    return { ok: true }
  })

  app.post('/api/telegram/disconnect', async () => {
    stopBot()
    const creds = await loadCredentials()
    delete creds[TOKEN_KEY]
    await saveCredentials(creds)
    await updateSettings((s) => {
      s.telegram = { enabled: false }
      return s
    })
    return { ok: true }
  })

  // Start the bot on boot if it was left enabled.
  void startBot()
}
