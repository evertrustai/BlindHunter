import { buildApp } from './app.js'

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
