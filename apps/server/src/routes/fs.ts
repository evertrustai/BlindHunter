import type { FastifyInstance } from 'fastify'
import os from 'node:os'
import path from 'node:path'
import { listDir } from '../tools/fs.js'
import { pickFolderDialog } from '../tools/dialog.js'

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
