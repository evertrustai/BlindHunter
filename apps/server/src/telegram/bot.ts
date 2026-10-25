import { loadSettings, loadCredentials, updateSettings } from '../config/store.js'
import { getUpdates, sendMessage, editMessageText, chunk, type TgUpdate } from './api.js'
import { runTelegramTurn, resetChatSession, stopChat, chatIsRunning } from './run.js'

/**
 * Telegram bot runner. Uses long polling (getUpdates) so it works from a localhost /
 * home-network install with no public URL. The bot obeys only its paired owner: until
 * an owner is bound, only a message containing the pairing code (shown in BlindHunter)
 * claims ownership; afterwards every non-owner message is ignored. (See Settings UI.)
 */

const TOKEN_KEY = 'telegram'

let running = false
let loopAbort: AbortController | null = null
let offset = 0

export async function startBot(): Promise<void> {
  if (running) return
  const settings = await loadSettings()
  if (!settings.telegram?.enabled) return
  const token = (await loadCredentials())[TOKEN_KEY]
  if (!token) return
  running = true
  void pollLoop(token)
}

export function stopBot(): void {
  running = false
  loopAbort?.abort()
  loopAbort = null
}

export async function restartBot(): Promise<void> {
  stopBot()
  // Let the in-flight getUpdates unwind so Telegram doesn't 409 on the next poll.
  await new Promise((r) => setTimeout(r, 600))
  await startBot()
}

async function pollLoop(token: string): Promise<void> {
  while (running) {
    loopAbort = new AbortController()
    try {
      const updates = await getUpdates(token, offset, 30, loopAbort.signal)
      for (const u of updates) {
        offset = u.update_id + 1
        if (u.message) void handleMessage(token, u.message)
      }
    } catch {
      if (!running) break
      await new Promise((r) => setTimeout(r, 3000)) // backoff on network/409/etc.
    }
  }
}

const HELP =
  "BlindHunter bot — send a prompt or task and I'll run it on your machine.\n\n" +
  '/new — start a fresh session\n' +
  '/stop — stop the current task\n' +
  '/help — show this message'

async function handleMessage(token: string, msg: NonNullable<TgUpdate['message']>): Promise<void> {
  const text = (msg.text ?? '').trim()
  const chatId = msg.chat.id
  const fromId = msg.from?.id
  if (!fromId) return

  const tg = (await loadSettings()).telegram
  if (!tg) return

  // --- Unpaired: only the correct pairing code binds the owner. ---
  if (!tg.ownerId) {
    if (text && tg.pairingCode && text.replace(/\s/g, '') === tg.pairingCode) {
      await updateSettings((s) => {
        if (s.telegram) {
          s.telegram.ownerId = fromId
          s.telegram.pairingCode = undefined
        }
        return s
      })
      await sendMessage(
        token,
        chatId,
        "✅ Paired — you're now the owner of this bot. Send me a prompt and I'll run it in BlindHunter. (/help)",
      )
    } else {
      await sendMessage(
        token,
        chatId,
        '🔒 This BlindHunter bot is waiting to be claimed. In BlindHunter open Settings → Integrations and send me the pairing code shown there.',
      )
    }
    return
  }

  // --- Paired: ignore everyone except the owner. ---
  if (fromId !== tg.ownerId) return
  if (!text) return

  if (text === '/start' || text === '/help') return void sendMessage(token, chatId, HELP)
  if (text === '/new') {
    resetChatSession(chatId)
    return void sendMessage(token, chatId, '🆕 Started a fresh session.')
  }
  if (text === '/stop') {
    return void sendMessage(token, chatId, stopChat(chatId) ? '🛑 Stopped.' : 'Nothing is running.')
  }
  if (text.startsWith('/')) return void sendMessage(token, chatId, 'Unknown command. /help for options.')

  if (chatIsRunning(chatId)) {
    return void sendMessage(token, chatId, '⏳ Still working on the previous task — send /stop to cancel it first.')
  }

  let workingId: number | undefined
  try {
    workingId = (await sendMessage(token, chatId, '🔎 Working…')).message_id
  } catch {
    /* if we can't even send, nothing more to do */
  }
  let lastEdit = 0
  await runTelegramTurn(chatId, text, {
    onProgress: (status) => {
      const now = Date.now()
      if (workingId && now - lastEdit > 1200) {
        lastEdit = now
        void editMessageText(token, chatId, workingId, `🔎 ${status}`)
      }
    },
    onFinal: (answer) => {
      if (workingId) void editMessageText(token, chatId, workingId, '✅ Done')
      for (const part of chunk(answer)) void sendMessage(token, chatId, part)
    },
    onError: (message) => {
      if (workingId) void editMessageText(token, chatId, workingId, '⚠️ Error')
      void sendMessage(token, chatId, `⚠️ ${message}`)
    },
  })
}
