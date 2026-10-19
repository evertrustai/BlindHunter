import type { FastifyInstance } from 'fastify'
import { getUsageStats } from '../usage/store.js'

export async function usageRoutes(app: FastifyInstance): Promise<void> {
  // Aggregated token-usage stats for the Settings "Token activity" dashboard.
  app.get('/api/usage', async (req) => {
    const { days } = req.query as { days?: string }
    const n = Number(days)
    const windowDays = Number.isFinite(n) && n > 0 && n <= 366 ? Math.floor(n) : 365
    return getUsageStats(windowDays)
  })
}
