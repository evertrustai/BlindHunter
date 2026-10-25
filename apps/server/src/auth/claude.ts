import { randomBytes, createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { CLAUDE_OAUTH_FILE } from '../config/paths.js'

/**
 * "Connect with Claude": sign in with a Claude Pro/Max subscription so BlindHunter can
 * run inference on the user's plan instead of a pay-per-token API key.
 *
 * This uses the same browser-approval OAuth (authorization-code + PKCE) flow Claude Code
 * uses, reusing its public client id. It is UNOFFICIAL / reverse-engineered: Anthropic
 * can change it at any time, and it rides a gray area of their terms. The resulting
 * access token is sent to the Messages API as a Bearer token with the oauth beta header
 * (see providers/anthropic.ts).
 */

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e' // Claude Code's public OAuth client id
const AUTHORIZE_URL = 'https://claude.ai/oauth/authorize'
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token'
const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback'
// The scope set Claude Code's OAuth client is registered for — all three are required;
// requesting a mismatched subset is what makes the authorize page reject the request as
// "Invalid request format".
const SCOPES = 'org:create_api_key user:profile user:inference'
const DEFAULT_TTL_SEC = 28_800 // 8h, per observed tokens

/** A standard Anthropic API key (sk-ant-api…) authenticates with x-api-key; an OAuth
 *  subscription token (sk-ant-oat…, from `claude setup-token` etc.) uses a Bearer header. */
export function isClaudeApiKey(token: string): boolean {
  return /^sk-ant-api/i.test(token.trim())
}

/** The auth headers Anthropic expects for a given credential (API key vs OAuth token). */
export function anthropicAuthHeaders(token: string): Record<string, string> {
  return isClaudeApiKey(token)
    ? { 'x-api-key': token.trim() }
    : { authorization: `Bearer ${token.trim()}`, 'anthropic-beta': 'oauth-2025-04-20' }
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface ClaudeTokens {
  accessToken: string
  refreshToken?: string
  expiresAt: number // epoch ms
  scopes?: string
}

// Short-lived pending logins (PKCE verifier + state), keyed by an opaque id.
const pending = new Map<string, { verifier: string; state: string; createdAt: number }>()

let tokens: ClaudeTokens | null = null
let loaded = false

async function loadTokens(): Promise<void> {
  if (loaded) return
  try {
    tokens = JSON.parse(await fs.readFile(CLAUDE_OAUTH_FILE, 'utf8')) as ClaudeTokens
  } catch {
    tokens = null
  }
  loaded = true
}

async function saveTokens(next: ClaudeTokens | null): Promise<void> {
  tokens = next
  loaded = true
  await fs.mkdir(path.dirname(CLAUDE_OAUTH_FILE), { recursive: true })
  if (next) {
    // Owner-only (0600); the file lives under the already ACL-restricted ~/.blindhunter.
    await fs.writeFile(CLAUDE_OAUTH_FILE, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 })
  } else {
    await fs.rm(CLAUDE_OAUTH_FILE, { force: true })
  }
}

/** Begin a login: returns the authorize URL to open and an id to finish with. */
export function startLogin(): { url: string; pkceId: string } {
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const state = b64url(randomBytes(16))
  const pkceId = b64url(randomBytes(9))
  // Drop stale pending logins (>15 min).
  for (const [k, v] of pending) if (Date.now() - v.createdAt > 15 * 60_000) pending.delete(k)
  pending.set(pkceId, { verifier, state, createdAt: Date.now() })

  const u = new URL(AUTHORIZE_URL)
  u.searchParams.set('code', 'true')
  u.searchParams.set('client_id', CLIENT_ID)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('redirect_uri', REDIRECT_URI)
  u.searchParams.set('scope', SCOPES)
  u.searchParams.set('code_challenge', challenge)
  u.searchParams.set('code_challenge_method', 'S256')
  u.searchParams.set('state', state)
  return { url: u.toString(), pkceId }
}

/**
 * Store a Claude credential the user pasted in directly — an OAuth subscription token
 * (from `claude setup-token` or a tool's "Authorize" step) or a plain Anthropic API key.
 * This is the primary "Connect with Claude" path: no browser round-trip or code exchange,
 * the user just hands BlindHunter the key. We do a light check so a clearly-bad key is
 * caught now, but accept anything the check can't rule out (some tokens can chat yet can't
 * list models) and let the first real message report any remaining problem.
 */
export async function setKey(rawKey: string): Promise<{ ok: boolean; error?: string }> {
  const key = rawKey.trim()
  if (!key) return { ok: false, error: 'Paste your Claude key first.' }
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      headers: { 'anthropic-version': '2023-06-01', ...anthropicAuthHeaders(key) },
    })
    if (res.status === 401) return { ok: false, error: 'Claude rejected that key — check you copied the whole thing.' }
  } catch {
    /* network hiccup — accept and let a real request surface it */
  }
  // A pasted key has no refresh token, so treat it as long-lived (re-paste if it ever expires).
  await saveTokens({ accessToken: key, expiresAt: 0, scopes: 'pasted' })
  return { ok: true }
}

/** Finish a login by exchanging the pasted code (format "code" or "code#state") for tokens. */
export async function completeLogin(pkceId: string, rawCode: string): Promise<{ ok: boolean; error?: string }> {
  const p = pending.get(pkceId)
  if (!p) return { ok: false, error: 'This sign-in expired — start again.' }
  pending.delete(pkceId)
  const [code, stateInCode] = rawCode.trim().split('#')
  if (!code) return { ok: false, error: 'No code found. Paste the full code you were given.' }
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        state: stateInCode || p.state,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_verifier: p.verifier,
      }),
    })
    if (!res.ok) {
      return { ok: false, error: `Token exchange failed (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}` }
    }
    const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string }
    if (!j.access_token) return { ok: false, error: 'No access token was returned.' }
    await saveTokens({
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      expiresAt: Date.now() + (j.expires_in ?? DEFAULT_TTL_SEC) * 1000,
      scopes: j.scope,
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function refresh(): Promise<boolean> {
  if (!tokens?.refreshToken) return false
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken, client_id: CLIENT_ID }),
    })
    if (!res.ok) return false
    const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string }
    if (!j.access_token) return false
    await saveTokens({
      accessToken: j.access_token,
      refreshToken: j.refresh_token ?? tokens.refreshToken,
      expiresAt: Date.now() + (j.expires_in ?? DEFAULT_TTL_SEC) * 1000,
      scopes: j.scope ?? tokens.scopes,
    })
    return true
  } catch {
    return false
  }
}

/** A valid access token, refreshed if it's near expiry. Null if not connected. */
export async function getValidToken(): Promise<string | null> {
  await loadTokens()
  if (!tokens) return null
  // Only refresh an OAuth token (one that came with a refresh token); a pasted key has none.
  if (tokens.refreshToken && Date.now() > tokens.expiresAt - 60_000) await refresh()
  return tokens?.accessToken ?? null
}

export async function status(): Promise<{ connected: boolean; expiresAt?: number; scopes?: string }> {
  await loadTokens()
  return tokens ? { connected: true, expiresAt: tokens.expiresAt, scopes: tokens.scopes } : { connected: false }
}

export async function disconnect(): Promise<void> {
  await saveTokens(null)
}

/** Models the connected subscription can use, from Anthropic's /v1/models (best effort). */
export async function listModels(): Promise<{ id: string; name?: string }[]> {
  const token = await getValidToken()
  if (!token) return []
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: { 'anthropic-version': '2023-06-01', ...anthropicAuthHeaders(token) },
    })
    if (!res.ok) return []
    const j = (await res.json()) as { data?: { id: string; display_name?: string }[] }
    return (j.data ?? []).map((m) => ({ id: m.id, name: m.display_name }))
  } catch {
    return []
  }
}
