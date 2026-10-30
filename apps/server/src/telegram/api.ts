/** Minimal Telegram Bot API client over plain HTTPS — no SDK dependency. */

const BASE = 'https://api.telegram.org'

export interface TgUpdate {
  update_id: number
  message?: {
    message_id: number
    text?: string
    chat: { id: number; type: string }
    from?: { id: number; username?: string; first_name?: string }
    /** Voice note (OGG/Opus). */
    voice?: TgAudio
    /** Uploaded/forwarded audio file. */
    audio?: TgAudio
  }
  callback_query?: {
    id: string
    data?: string
    from?: { id: number }
    message?: { message_id: number; chat: { id: number } }
  }
}

/** A voice note or audio file attached to a message. */
export interface TgAudio {
  file_id: string
  duration?: number
  mime_type?: string
  file_size?: number
  file_name?: string
}

/** An inline-keyboard button grid for reply_markup. */
export type InlineKeyboard = { inline_keyboard: { text: string; callback_data: string }[][] }

async function call<T>(token: string, method: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params ?? {}),
    signal,
  })
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string }
  if (!j.ok) throw new Error(j.description || `Telegram ${method} failed (${res.status})`)
  return j.result as T
}

/** Validate a token and return the bot's identity. */
export function getMe(token: string): Promise<{ id: number; username?: string; first_name?: string }> {
  return call(token, 'getMe')
}

/** Long-poll for updates since `offset`. Resolves after `timeout`s or when an update arrives. */
export function getUpdates(token: string, offset: number, timeout: number, signal?: AbortSignal): Promise<TgUpdate[]> {
  return call<TgUpdate[]>(token, 'getUpdates', { offset, timeout, allowed_updates: ['message', 'callback_query'] }, signal)
}

export function sendMessage(
  token: string,
  chatId: number,
  text: string,
  replyMarkup?: InlineKeyboard,
): Promise<{ message_id: number }> {
  return call(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

/** Acknowledge a button tap (removes the loading spinner on the client). */
export function answerCallbackQuery(token: string, callbackQueryId: string, text?: string): Promise<unknown> {
  return call(token, 'answerCallbackQuery', { callback_query_id: callbackQueryId, ...(text ? { text } : {}) }).catch(
    () => undefined,
  )
}

export function editMessageText(token: string, chatId: number, messageId: number, text: string): Promise<unknown> {
  return call(token, 'editMessageText', { chat_id: chatId, message_id: messageId, text, disable_web_page_preview: true }).catch(
    () => undefined, // editing can fail (unchanged text / too old) — not fatal
  )
}

/** Resolve a file_id to a downloadable file_path (valid ~1h). */
export function getFile(token: string, fileId: string): Promise<{ file_path?: string; file_size?: number }> {
  return call(token, 'getFile', { file_id: fileId })
}

/** Download a file by the file_path returned from getFile. */
export async function downloadFile(token: string, filePath: string, signal?: AbortSignal): Promise<Buffer> {
  const res = await fetch(`${BASE}/file/bot${token}/${filePath}`, { signal })
  if (!res.ok) throw new Error(`Telegram file download failed (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

/** Telegram caps messages at 4096 chars; split on boundaries so long output still sends. */
export function chunk(text: string, max = 4000): string[] {
  if (text.length <= max) return [text]
  const parts: string[] = []
  let rest = text
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max)
    if (cut < max * 0.5) cut = max
    parts.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  if (rest) parts.push(rest)
  return parts
}
