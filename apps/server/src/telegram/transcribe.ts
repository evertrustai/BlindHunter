import { loadSettings, loadCredentials } from '../config/store.js'

/** Credentials-vault key for the (optional) speech-to-text API key. */
export const STT_KEY = 'telegram_stt'

/** True when a transcription endpoint + model are configured. */
export function transcriptionConfigured(t?: { baseUrl?: string; model?: string }): boolean {
  return Boolean(t?.baseUrl?.trim() && t?.model?.trim())
}

/**
 * Transcribe an audio buffer to text via an OpenAI-compatible /audio/transcriptions endpoint.
 * The endpoint can be a local whisper server (fully offline) or a cloud one — the user's choice,
 * set in Settings › Integrations. Throws with a human-readable message on any failure.
 */
export async function transcribe(audio: Buffer, filename: string, mime: string): Promise<string> {
  const settings = await loadSettings()
  const t = settings.telegram?.transcription
  if (!transcriptionConfigured(t)) {
    throw new Error('Voice transcription is not set up — add a speech-to-text endpoint in Settings → Integrations → Voice.')
  }
  const base = t!.baseUrl!.trim().replace(/\/+$/, '')
  const key = (await loadCredentials())[STT_KEY]

  const form = new FormData()
  // Node 24 ships global FormData/Blob/fetch; Buffer is a Uint8Array, so Blob accepts it.
  form.append('file', new Blob([audio], { type: mime || 'audio/ogg' }), filename)
  form.append('model', t!.model!.trim())
  form.append('response_format', 'json')

  let res: Response
  try {
    res = await fetch(`${base}/audio/transcriptions`, {
      method: 'POST',
      headers: key ? { authorization: `Bearer ${key}` } : {},
      body: form,
    })
  } catch (e) {
    throw new Error(`Could not reach the transcription endpoint: ${e instanceof Error ? e.message : String(e)}`)
  }
  const body = (await res.json().catch(() => ({}))) as { text?: string; error?: { message?: string } | string }
  if (!res.ok) {
    const msg = typeof body.error === 'string' ? body.error : body.error?.message
    throw new Error(msg || `Transcription failed (${res.status})`)
  }
  return (body.text ?? '').trim()
}
