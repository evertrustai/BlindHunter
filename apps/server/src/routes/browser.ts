import type { FastifyInstance } from 'fastify'
import * as browser from '../browser/manager.js'

/** REST surface for the in-app browser panel (the agent uses the tools in the registry). */
export async function browserRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/browser/tabs', async () => ({ tabs: await browser.listTabs() }))

  app.post('/api/browser/tabs', async (req, reply) => {
    const { url } = (req.body ?? {}) as { url?: string }
    try {
      return await browser.newTab(url)
    } catch (e) {
      reply.code(500)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })

  app.post('/api/browser/tabs/:id/activate', async (req) => {
    const { id } = req.params as { id: string }
    browser.setActive(id)
    return { ok: true }
  })

  app.delete('/api/browser/tabs/:id', async (req) => {
    const { id } = req.params as { id: string }
    await browser.closeTab(id)
    return { ok: true }
  })

  app.post('/api/browser/tabs/:id/navigate', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { target } = req.body as { target: string }
    try {
      return await browser.go(id, target)
    } catch (e) {
      reply.code(400)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })

  app.get('/api/browser/tabs/:id/screenshot', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const png = await browser.screenshot(id)
      reply.header('cache-control', 'no-store')
      reply.type('image/png')
      return reply.send(png)
    } catch (e) {
      reply.code(404)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })

  app.post('/api/browser/tabs/:id/click', async (req) => {
    const { id } = req.params as { id: string }
    const { x, y } = req.body as { x: number; y: number }
    await browser.click(id, x, y)
    return { ok: true }
  })

  app.post('/api/browser/tabs/:id/type', async (req) => {
    const { id } = req.params as { id: string }
    const { text } = req.body as { text: string }
    await browser.typeText(id, text)
    return { ok: true }
  })

  app.post('/api/browser/tabs/:id/key', async (req) => {
    const { id } = req.params as { id: string }
    const { key } = req.body as { key: string }
    await browser.pressKey(id, key)
    return { ok: true }
  })

  app.post('/api/browser/tabs/:id/scroll', async (req) => {
    const { id } = req.params as { id: string }
    const { dx, dy } = req.body as { dx: number; dy: number }
    await browser.scroll(id, dx ?? 0, dy ?? 0)
    return { ok: true }
  })
}
