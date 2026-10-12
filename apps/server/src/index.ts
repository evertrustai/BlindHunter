import { buildApp } from './app.js'
import { shutdown as shutdownBrowser } from './browser/manager.js'

const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '127.0.0.1'

const app = await buildApp()
try {
  await app.listen({ port: PORT, host: HOST })
  app.log.info(`BlindHunter server listening on http://${HOST}:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

// One coordinated shutdown path: close the HTTP server and the browser, then exit — so
// the port is actually released and a restart can rebind it instead of hitting
// EADDRINUSE. A hard cap guarantees exit even if a long SSE stream holds a socket. (QA-27/QA-99)
let shuttingDown = false
async function gracefulExit(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  app.log.info(`received ${signal} — shutting down`)
  const force = setTimeout(() => process.exit(0), 3000)
  force.unref()
  try {
    await shutdownBrowser()
  } catch {
    /* ignore */
  }
  try {
    await app.close()
  } catch {
    /* ignore */
  }
  clearTimeout(force)
  process.exit(0)
}
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => void gracefulExit(sig))
}
