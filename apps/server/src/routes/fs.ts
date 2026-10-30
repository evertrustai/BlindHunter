import type { FastifyInstance } from 'fastify'
import os from 'node:os'
import path from 'node:path'
import { createReadStream } from 'node:fs'
import { listDir, readForView, assertOutsideConfig, isImagePath, mimeFor } from '../tools/fs.js'
import { pickFolderDialog } from '../tools/dialog.js'

/** Resolve a viewer path: absolute as-is, else joined onto the session workspace (cwd). */
function resolveViewPath(p: string, cwd?: string): string {
  return path.isAbsolute(p) ? p : path.join(cwd && cwd.length ? cwd : os.homedir(), p)
}

export async function fsRoutes(app: FastifyInstance): Promise<void> {
  // Open the host OS native folder chooser and return the chosen absolute path.
  app.post('/api/fs/pick-folder', async (_req, reply) => {
    try {
      const picked = await pickFolderDialog()
      return { path: picked }
    } catch (e) {
      reply.code(500)
      return { path: null, error: e instanceof Error ? e.message : String(e) }
    }
  })

  // Read a file for the viewer panel (text content + metadata, or an image/binary marker).
  app.get('/api/fs/read', async (req, reply) => {
    const { path: p, cwd } = req.query as { path?: string; cwd?: string }
    if (!p) {
      reply.code(400)
      return { error: 'path is required' }
    }
    const abs = resolveViewPath(p, cwd)
    try {
      assertOutsideConfig(abs)
      return await readForView(abs)
    } catch (e) {
      reply.code(400)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })

  // Stream a file's raw bytes — used by the viewer to render images (screenshots etc.).
  app.get('/api/fs/raw', async (req, reply) => {
    const { path: p, cwd } = req.query as { path?: string; cwd?: string }
    if (!p) {
      reply.code(400)
      return { error: 'path is required' }
    }
    const abs = resolveViewPath(p, cwd)
    try {
      assertOutsideConfig(abs)
      reply.header('cache-control', 'no-store')
      if (isImagePath(abs)) reply.type(mimeFor(abs))
      return reply.send(createReadStream(abs))
    } catch (e) {
      reply.code(404)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })

  // Server-side directory browser — powers the workspace folder picker.
  app.get('/api/fs/list', async (req, reply) => {
    const q = (req.query as { path?: string }).path
    const dir = q && q.length ? q : os.homedir()
    try {
      const entries = await listDir(dir)
      const parent = path.dirname(dir)
      return { path: dir, parent: parent !== dir ? parent : null, entries }
    } catch (e) {
      reply.code(400)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })
}
