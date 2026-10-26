import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { CODEX_OAUTH_FILE } from '../config/paths.js'

/**
 * "Connect with ChatGPT (Codex)": sign in with a ChatGPT Plus/Pro subscription using
 * OpenAI's device-code flow, so BlindHunter can run inference on the user's plan (via the
 * Codex Responses backend — see providers/codex.ts).
 *
 * UNOFFICIAL / reverse-engineered: this reuses the Codex CLI's public client id and device
 * endpoints. Routing a subscription through a third-party app rides a gray area of OpenAI's
 * terms, and the backend may rate-limit or reject it. The device-code flow itself is an
 * official ChatGPT feature the user must enable in their ChatGPT security settings first.
 */

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann' // Codex CLI public client id
const USERCODE_URL = 'https://auth.openai.com/api/accounts/deviceauth/usercode'
const DEVICE_TOKEN_URL = 'https://auth.openai.com/api/accounts/deviceauth/token'
const OAUTH_TOKEN_URL = 'https://auth.openai.com/oauth/token'
const REDIRECT_URI = 'https://auth.openai.com/deviceauth/callback'
export const VERIFICATION_URI = 'https://auth.openai.com/codex/device'
// A CLI-ish User-Agent; auth.openai.com's edge answers 530 to clearly non-CLI clients.
const UA = 'codex_cli_rs/0.0.0'
const DEFAULT_TTL_SEC = 3600

export interface CodexTokens {
  accessToken: string
  refreshToken?: string
  idToken?: string
  accountId?: string
  expiresAt: number // epoch ms
}

// Short-lived pending device authorizations, keyed by an opaque id we hand the client.
const pending = new Map<string, { deviceAuthId: string; userCode: string; createdAt: number }>()

let tokens: CodexTokens | null = null
let loaded = false

async function loadTokens(): Promise<void> {
  if (loaded) return
  try {
    tokens = JSON.parse(await fs.readFile(CODEX_OAUTH_FILE, 'utf8')) as CodexTokens
  } catch {
    tokens = null
  }
  loaded = true
}

async function saveTokens(next: CodexTokens | null): Promise<void> {
  tokens = next
  loaded = true
  await fs.mkdir(path.dirname(CODEX_OAUTH_FILE), { recursive: true })
  if (next) await fs.writeFile(CODEX_OAUTH_FILE, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 })
  else await fs.rm(CODEX_OAUTH_FILE, { force: true })
}

/** Decode a JWT payload (no verification) to pull out the ChatGPT account id. */
function accountIdFromJwt(jwt?: string): string | undefined {
  if (!jwt) return undefined
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString('utf8')) as Record<string, unknown>
    const auth = payload['https://api.openai.com/auth'] as Record<string, unknown> | undefined
    const id =
      (auth?.['chatgpt_account_id'] as string | undefined) ??
      (payload['chatgpt_account_id'] as string | undefined) ??
      (auth?.['chatgpt_user_id'] as string | undefined)
    return typeof id === 'string' ? id : undefined
  } catch {
    return undefined
  }
}

const authHeaders = { 'content-type': 'application/json', 'user-agent': UA, accept: 'application/json' }

/** Step 1: request a user code. Returns the code to show + a poll id to finish with. */
export async function startDeviceAuth(): Promise<{
  ok: boolean
  error?: string
  pollId?: string
  userCode?: string
  verificationUri?: string
  interval?: number
}> {
  // Drop stale pending (>16 min).
  for (const [k, v] of pending) if (Date.now() - v.createdAt > 16 * 60_000) pending.delete(k)
  try {
    const res = await fetch(USERCODE_URL, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ client_id: CLIENT_ID }),
    })
    if (!res.ok) {
      return { ok: false, error: `OpenAI returned ${res.status} requesting a device code. ${(await res.text().catch(() => '')).slice(0, 160)}` }
    }
    const j = (await res.json()) as { device_auth_id?: string; user_code?: string; interval?: string | number }
    if (!j.device_auth_id || !j.user_code) return { ok: false, error: 'No device code was returned.' }
    const pollId = randomBytes(9).toString('base64url')
    pending.set(pollId, { deviceAuthId: j.device_auth_id, userCode: j.user_code, createdAt: Date.now() })
    return { ok: true, pollId, userCode: j.user_code, verificationUri: VERIFICATION_URI, interval: Number(j.interval) || 5 }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Step 2: poll until the user approves on the device page, then exchange for tokens. */
export async function pollDeviceAuth(pollId: string): Promise<{ status: 'pending' | 'connected' | 'error'; error?: string }> {
  const p = pending.get(pollId)
  if (!p) return { status: 'error', error: 'This sign-in expired — start again.' }
  if (Date.now() - p.createdAt > 16 * 60_000) {
    pending.delete(pollId)
    return { status: 'error', error: 'The code expired — start again.' }
  }
  let dev: { authorization_code?: string; code_verifier?: string }
  try {
    const res = await fetch(DEVICE_TOKEN_URL, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ device_auth_id: p.deviceAuthId, user_code: p.userCode }),
    })
    if (!res.ok) return { status: 'pending' } // 403/404 while the user hasn't approved yet
    dev = (await res.json()) as { authorization_code?: string; code_verifier?: string }
  } catch {
    return { status: 'pending' }
  }
  if (!dev.authorization_code || !dev.code_verifier) return { status: 'pending' }

  // Exchange the authorization code for tokens.
  try {
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code: dev.authorization_code,
      code_verifier: dev.code_verifier,
      redirect_uri: REDIRECT_URI,
    })
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA, accept: 'application/json' },
      body: form.toString(),
    })
    if (!res.ok) {
      return { status: 'error', error: `Token exchange failed (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}` }
    }
    const j = (await res.json()) as { access_token?: string; refresh_token?: string; id_token?: string; expires_in?: number }
    if (!j.access_token) return { status: 'error', error: 'No access token was returned.' }
    pending.delete(pollId)
    await saveTokens({
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      idToken: j.id_token,
      accountId: accountIdFromJwt(j.id_token) ?? accountIdFromJwt(j.access_token),
      expiresAt: Date.now() + (j.expires_in ?? DEFAULT_TTL_SEC) * 1000,
    })
    return { status: 'connected' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function refresh(): Promise<boolean> {
  if (!tokens?.refreshToken) return false
  try {
    const form = new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, refresh_token: tokens.refreshToken })
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA, accept: 'application/json' },
      body: form.toString(),
    })
    if (!res.ok) return false
    const j = (await res.json()) as { access_token?: string; refresh_token?: string; id_token?: string; expires_in?: number }
    if (!j.access_token) return false
    await saveTokens({
      accessToken: j.access_token,
      refreshToken: j.refresh_token ?? tokens.refreshToken,
      idToken: j.id_token ?? tokens.idToken,
      accountId: accountIdFromJwt(j.id_token) ?? tokens.accountId,
      expiresAt: Date.now() + (j.expires_in ?? DEFAULT_TTL_SEC) * 1000,
    })
    return true
  } catch {
    return false
  }
}

/** A valid access token, refreshed if near expiry. Null if not connected. */
export async function getValidToken(): Promise<string | null> {
  await loadTokens()
  if (!tokens) return null
  if (tokens.refreshToken && Date.now() > tokens.expiresAt - 60_000) await refresh()
  return tokens?.accessToken ?? null
}

export async function getAccountId(): Promise<string | undefined> {
  await loadTokens()
  return tokens?.accountId
}

export async function status(): Promise<{ connected: boolean; expiresAt?: number; accountId?: string }> {
  await loadTokens()
  return tokens ? { connected: true, expiresAt: tokens.expiresAt, accountId: tokens.accountId } : { connected: false }
}

export async function disconnect(): Promise<void> {
  await saveTokens(null)
}

/**
 * The Codex models this account can actually use. A ChatGPT Go plan returns an empty list
 * (Codex needs Plus/Pro), so the caller can tell the user their plan doesn't include it.
 */
export async function listModels(): Promise<{ id: string; name?: string }[]> {
  const token = await getValidToken()
  if (!token) return []
  const accountId = await getAccountId()
  try {
    const res = await fetch(`https://chatgpt.com/backend-api/codex/models?client_version=0.48.0`, {
      headers: {
        authorization: `Bearer ${token}`,
        originator: 'codex_cli_rs',
        'user-agent': UA,
        accept: 'application/json',
        ...(accountId ? { 'chatgpt-account-id': accountId } : {}),
      },
    })
    if (!res.ok) return []
    const j = (await res.json()) as { models?: unknown[] }
    return (j.models ?? []).map((m) => {
      if (typeof m === 'string') return { id: m }
      const o = m as { slug?: string; id?: string; title?: string; display_name?: string }
      const id = o.slug ?? o.id ?? ''
      return { id, name: o.title ?? o.display_name ?? id }
    }).filter((m) => m.id)
  } catch {
    return []
  }
}
