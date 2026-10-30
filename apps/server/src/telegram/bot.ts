import { statSync } from 'node:fs'
import { loadSettings, loadCredentials, updateSettings } from '../config/store.js'
import {
  getUpdates,
  sendMessage,
  editMessageText,
  answerCallbackQuery,
  getFile,
  downloadFile,
  chunk,
  type TgUpdate,
  type InlineKeyboard,
} from './api.js'
import { transcribe, transcriptionConfigured } from './transcribe.js'
import {
  runTelegramTurn,
  resetChatSession,
  stopChat,
  chatIsRunning,
  listRecentSessions,
  setChatSession,
  getChatSessionId,
  listEnabledModels,
  currentTelegramModel,
  currentTelegramWorkspace,
  listRecentWorkspaces,
} from './run.js'

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
        else if (u.callback_query) void handleCallback(token, u.callback_query)
      }
    } catch {
      if (!running) break
      await new Promise((r) => setTimeout(r, 3000)) // backoff on network/409/etc.
    }
  }
}

const HELP =
  "BlindHunter bot — send a prompt (text or 🎙️ voice) and I'll run it on your machine.\n\n" +
  '/model — show or switch the model\n' +
  '/workspace — show or switch the working folder\n' +
  '/sessions — list & open any session (web or bot)\n' +
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
  const hasVoice = Boolean(msg.voice || msg.audio)
  if (!text && !hasVoice) return

  // --- Commands (text only; a voice note is never a command). ---
  if (text === '/start' || text === '/help') return void sendMessage(token, chatId, HELP)
  if (text === '/sessions' || text === '/list') {
    const active = getChatSessionId(chatId)
    const sessions = listRecentSessions(12)
    if (!sessions.length) return void sendMessage(token, chatId, 'No sessions yet — send a prompt to start one.')
    const keyboard: InlineKeyboard = {
      inline_keyboard: sessions.map((s) => [
        {
          text: `${s.id === active ? '✅ ' : ''}${s.running ? '🟡 ' : ''}${s.title}`.slice(0, 60),
          callback_data: `open:${s.id}`,
        },
      ]),
    }
    return void sendMessage(token, chatId, '📂 Your sessions — tap one to continue it (🟡 = running):', keyboard)
  }
  if (text === '/model' || text === '/models') return void (await sendModelPicker(token, chatId))
  if (text === '/workspace' || text === '/workspaces' || text.startsWith('/workspace ')) {
    return void (await handleWorkspace(token, chatId, text.slice('/workspace'.length).trim()))
  }
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

  // --- Resolve the prompt: typed text, or a transcribed voice/audio message. ---
  let prompt = text
  if (!prompt && hasVoice) {
    const transcribed = await transcribeVoice(token, chatId, msg.voice ?? msg.audio!)
    if (!transcribed) return // the helper already told the owner what went wrong
    prompt = transcribed
  }
  if (!prompt) return

  let workingId: number | undefined
  try {
    workingId = (await sendMessage(token, chatId, '🔎 Working…')).message_id
  } catch {
    /* if we can't even send, nothing more to do */
  }
  let lastEdit = 0
  await runTelegramTurn(chatId, prompt, {
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

/** Handle an inline-keyboard button tap (currently: opening a session from /sessions). */
async function handleCallback(token: string, cq: NonNullable<TgUpdate['callback_query']>): Promise<void> {
  const chatId = cq.message?.chat.id
  const fromId = cq.from?.id
  const data = cq.data ?? ''
  if (!chatId || !fromId) return void answerCallbackQuery(token, cq.id)

  // Only the paired owner may switch sessions.
  const tg = (await loadSettings()).telegram
  if (!tg?.ownerId || fromId !== tg.ownerId) return void answerCallbackQuery(token, cq.id)

  if (data.startsWith('open:')) {
    const sessionId = data.slice(5)
    const r = setChatSession(chatId, sessionId)
    if (!r.ok) return void answerCallbackQuery(token, cq.id, 'That session no longer exists.')
    await answerCallbackQuery(token, cq.id, 'Switched')
    let out = `📂 Now on: ${r.title}\nSend a message to continue this session.`
    if (r.preview) out += `\n\n— last reply —\n${r.preview}${r.preview.length >= 350 ? '…' : ''}`
    for (const part of chunk(out)) await sendMessage(token, chatId, part)
    return
  }

  if (data.startsWith('model:')) {
    const models = await listEnabledModels()
    const picked = models[Number(data.slice(6))]
    if (!picked) return void answerCallbackQuery(token, cq.id, 'That model is gone.')
    await updateSettings((s) => {
      if (!s.telegram) s.telegram = { enabled: true }
      s.telegram.defaultModel = picked.ref
      return s
    })
    await answerCallbackQuery(token, cq.id, 'Model switched')
    if (cq.message) await editMessageText(token, chatId, cq.message.message_id, `✅ Model: ${picked.label}`)
    return
  }

  if (data.startsWith('ws:')) {
    const picked = listRecentWorkspaces(8)[Number(data.slice(3))]
    if (!picked) return void answerCallbackQuery(token, cq.id, 'That folder is gone.')
    await setWorkspace(chatId, picked)
    await answerCallbackQuery(token, cq.id, 'Folder switched')
    if (cq.message)
      await editMessageText(token, chatId, cq.message.message_id, `✅ Workspace: ${picked}\nStarted a fresh session here.`)
    return
  }

  await answerCallbackQuery(token, cq.id)
}

/** Reply with the current model and an inline keyboard of every enabled model to switch to. */
async function sendModelPicker(token: string, chatId: number): Promise<void> {
  const current = await currentTelegramModel()
  const models = await listEnabledModels()
  if (!models.length) {
    return void sendMessage(token, chatId, 'No models are enabled. Add a provider in BlindHunter → Settings → Models.')
  }
  const keyboard: InlineKeyboard = {
    inline_keyboard: models.slice(0, 40).map((m, i) => [
      { text: `${m.ref === current?.ref ? '✅ ' : ''}${m.label}`.slice(0, 60), callback_data: `model:${i}` },
    ]),
  }
  const head = current ? `🧠 Current model: ${current.label}` : '🧠 No model selected'
  await sendMessage(token, chatId, `${head}\n\nTap one to switch:`, keyboard)
}

/** `/workspace` with no arg shows the current folder + recent picks; with a path, sets it. */
async function handleWorkspace(token: string, chatId: number, arg: string): Promise<void> {
  if (arg) {
    try {
      if (!statSync(arg).isDirectory()) return void sendMessage(token, chatId, `⚠️ Not a folder: ${arg}`)
    } catch {
      return void sendMessage(token, chatId, `⚠️ That folder doesn't exist: ${arg}`)
    }
    await setWorkspace(chatId, arg)
    return void sendMessage(token, chatId, `✅ Workspace: ${arg}\nStarted a fresh session here.`)
  }
  const current = await currentTelegramWorkspace()
  const recent = listRecentWorkspaces(8).filter((w) => w !== current)
  const keyboard: InlineKeyboard | undefined = recent.length
    ? { inline_keyboard: recent.map((w, i) => [{ text: w.slice(0, 60), callback_data: `ws:${i}` }]) }
    : undefined
  const tip = '\n\nTo set a custom folder, send:\n/workspace C:\\path\\to\\folder'
  await sendMessage(
    token,
    chatId,
    `📁 Current workspace: ${current}${recent.length ? '\n\nTap a recent folder to switch:' : ''}${tip}`,
    keyboard,
  )
}

/** Set the Telegram workspace and reset the chat's session so the next prompt runs in it. */
async function setWorkspace(chatId: number, folder: string): Promise<void> {
  await updateSettings((s) => {
    if (!s.telegram) s.telegram = { enabled: true }
    s.telegram.defaultWorkspace = folder
    return s
  })
  // The current session's folder is fixed at creation, so start fresh in the new one.
  resetChatSession(chatId)
}

/** Download + transcribe a voice/audio message, echoing what was heard. Returns '' on failure. */
async function transcribeVoice(
  token: string,
  chatId: number,
  media: NonNullable<TgUpdate['message']>['voice'],
): Promise<string> {
  if (!media) return ''
  if (!transcriptionConfigured((await loadSettings()).telegram?.transcription)) {
    await sendMessage(
      token,
      chatId,
      '🎙️ I heard a voice message, but speech-to-text isn\u2019t set up yet. In BlindHunter open Settings → Integrations → Voice and add a transcription endpoint.',
    )
    return ''
  }
  let statusId: number | undefined
  try {
    statusId = (await sendMessage(token, chatId, '🎙️ Transcribing…')).message_id
  } catch {
    /* non-fatal */
  }
  try {
    const file = await getFile(token, media.file_id)
    if (!file.file_path) throw new Error('could not fetch the audio file')
    const buf = await downloadFile(token, file.file_path)
    const name = file.file_path.split('/').pop() || 'audio.ogg'
    const text = await transcribe(buf, name, media.mime_type || 'audio/ogg')
    if (!text) {
      if (statusId) await editMessageText(token, chatId, statusId, "🤔 I couldn't make out any speech in that.")
      return ''
    }
    if (statusId) await editMessageText(token, chatId, statusId, `🗣️ Heard: “${text}”`)
    return text
  } catch (e) {
    const msg = `⚠️ Voice transcription failed: ${e instanceof Error ? e.message : String(e)}`
    if (statusId) await editMessageText(token, chatId, statusId, msg)
    else await sendMessage(token, chatId, msg)
    return ''
  }
}
