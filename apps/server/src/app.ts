import Fastify from 'fastify'
import cors from '@fastify/cors'
import { providerRoutes } from './routes/providers.js'
import { modelRoutes } from './routes/models.js'
import { fsRoutes } from './routes/fs.js'
import { sessionRoutes } from './routes/sessions.js'
import { settingsRoutes } from './routes/settings.js'
import { importRoutes } from './routes/import.js'
import { agentRoutes } from './routes/agents.js'
import { mcpRoutes } from './routes/mcp.js'
import { browserRoutes } from './routes/browser.js'
import { loadSessionsFromDisk, loadGroupsFromDisk } from './sessions/store.js'
import { loadAgentsFromDisk } from './agents/store.js'
import { loadMcpFromDisk } from './mcp/store.js'
import { initMcp } from './mcp/manager.js'
import { loadSettings } from './config/store.js'
import { systemRoutes } from './routes/system.js'

/* ---------------------------------------------------------------------------
 * Local-server hardening.
 *
 * BlindHunter runs unauthenticated on 127.0.0.1 and can run shell commands and
 * read the filesystem. Without these guards, any web page the user visits could
 * reach the API (cross-origin, or via DNS-rebinding where a hostile domain is
 * re-pointed at 127.0.0.1). We therefore:
 *   1. reject any request whose Host header isn't a loopback name, and
 *   2. only allow CORS from loopback origins.
 * Advanced users who intentionally expose the server can add hostnames via the
 * BLINDHUNTER_ALLOWED_HOSTS env var (comma-separated).
 * ------------------------------------------------------------------------- */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const EXTRA_HOSTS = new Set(
  (process.env.BLINDHUNTER_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
)
function hostnameOf(host: string): string {
  const h = host.trim().toLowerCase()
  if (h.startsWith('[')) return h.slice(1, h.indexOf(']')) // "[::1]:8787" -> "::1"
  return h.split(':')[0]
}
function isAllowedName(name: string): boolean {
  return LOOPBACK_HOSTS.has(name) || EXTRA_HOSTS.has(name)
}
function hostAllowed(host?: string): boolean {
  return Boolean(host) && isAllowedName(hostnameOf(host as string))
}
function originAllowed(origin: string): boolean {
  try {
    return isAllowedName(new URL(origin).hostname.toLowerCase())
  } catch {
    return false
  }
}

export async function buildApp() {
  const initial = await loadSettings()
  const app = Fastify({ logger: { level: initial.logLevel ?? 'info' } })

  await loadGroupsFromDisk()
  await loadAgentsFromDisk()
  await loadMcpFromDisk()
  await loadSessionsFromDisk()
  await app.register(cors, {
    // Same-origin and non-browser clients send no Origin header — allow those;
    // otherwise only loopback origins may read responses.
    origin: (origin, cb) => cb(null, !origin || originAllowed(origin)),
  })
  // DNS-rebinding guard: drop anything not addressed to a loopback host.
  app.addHook('onRequest', async (req, reply) => {
    if (!hostAllowed(req.headers.host)) {
      return reply.code(403).type('application/json').send({ error: 'forbidden: host not allowed' })
    }
  })
  // Connect configured MCP servers in the background so startup isn't blocked.
  void initMcp()

  app.get('/api/health', async () => ({ ok: true, name: 'blindhunter', version: '0.1.0.1' }))

  await providerRoutes(app)
  await modelRoutes(app)
  await fsRoutes(app)
  await sessionRoutes(app)
  await settingsRoutes(app)
  await importRoutes(app)
  await agentRoutes(app)
  await mcpRoutes(app)
  await browserRoutes(app)
  await systemRoutes(app)

  return app
}
