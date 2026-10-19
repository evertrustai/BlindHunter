import { promises as fs } from 'node:fs'
import path from 'node:path'
import { USAGE_FILE } from '../config/paths.js'

/**
 * Per-day token usage, persisted to ~/.blindhunter/usage.json so the Settings
 * "Token activity" dashboard (heatmap + lifetime/peak/streaks/most-used-model)
 * survives restarts. Recording is additive and best-effort — it must never break
 * a run. Each API call's usage is summed into that calendar day's bucket (local
 * time), which matches how providers actually bill tokens.
 */

interface DayUsage {
  total: number
  prompt: number
  completion: number
  /** "providerId/modelId" -> tokens attributed to that model that day. */
  models: Record<string, number>
}

interface UsageData {
  days: Record<string, DayUsage> // key: "YYYY-MM-DD" (local date)
}

const data: UsageData = { days: {} }

/** Local calendar-date key, e.g. "2026-10-19". */
function dateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function loadUsageFromDisk(): Promise<void> {
  try {
    const raw = JSON.parse(await fs.readFile(USAGE_FILE, 'utf8')) as Partial<UsageData>
    if (raw && raw.days && typeof raw.days === 'object') data.days = raw.days
  } catch {
    /* no usage file yet */
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function persistSoon(): void {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    void (async () => {
      try {
        await fs.mkdir(path.dirname(USAGE_FILE), { recursive: true })
        await fs.writeFile(USAGE_FILE, JSON.stringify(data), 'utf8')
      } catch {
        /* best effort — a failed write must not break a chat */
      }
    })()
  }, 1500)
}

/** Record one API call's token usage against today. No-op for empty usage. */
export function recordUsage(model: string, prompt: number, completion: number, total: number): void {
  const p = prompt > 0 ? prompt : 0
  const c = completion > 0 ? completion : 0
  const t = total > 0 ? total : p + c
  if (t <= 0) return
  const key = dateKey()
  const day = (data.days[key] ??= { total: 0, prompt: 0, completion: 0, models: {} })
  day.total += t
  day.prompt += p
  day.completion += c
  if (model) day.models[model] = (day.models[model] ?? 0) + t
  persistSoon()
}

export interface UsageStats {
  /** Last N days, oldest first: one entry per calendar day (0 when inactive). */
  daily: { date: string; total: number }[]
  /** Totals across ALL recorded history (not just the window). */
  lifetime: number
  peak: number
  mostUsedModel: string | null
  longestStreak: number
  currentStreak: number
}

/** Whole-day difference between two "YYYY-MM-DD" keys (b - a). */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

function computeStreaks(activeSorted: string[]): { longest: number; current: number } {
  if (!activeSorted.length) return { longest: 0, current: 0 }
  let longest = 1
  let run = 1
  for (let i = 1; i < activeSorted.length; i++) {
    run = dayDiff(activeSorted[i - 1], activeSorted[i]) === 1 ? run + 1 : 1
    if (run > longest) longest = run
  }
  // Length of the run ending at the most recent active day.
  let endRun = 1
  for (let i = activeSorted.length - 1; i > 0; i--) {
    if (dayDiff(activeSorted[i - 1], activeSorted[i]) === 1) endRun++
    else break
  }
  // "Current" only counts if the streak reaches today.
  const last = activeSorted[activeSorted.length - 1]
  const current = last === dateKey() ? endRun : 0
  return { longest, current }
}

export function getUsageStats(windowDays = 365): UsageStats {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daily: { date: string; total: number }[] = []
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = dateKey(d)
    daily.push({ date: key, total: data.days[key]?.total ?? 0 })
  }

  let lifetime = 0
  let peak = 0
  const modelTotals: Record<string, number> = {}
  for (const du of Object.values(data.days)) {
    lifetime += du.total
    if (du.total > peak) peak = du.total
    for (const [m, t] of Object.entries(du.models)) modelTotals[m] = (modelTotals[m] ?? 0) + t
  }
  let mostUsedModel: string | null = null
  let best = 0
  for (const [m, t] of Object.entries(modelTotals)) {
    if (t > best) {
      best = t
      mostUsedModel = m
    }
  }

  const activeSorted = Object.keys(data.days)
    .filter((k) => (data.days[k]?.total ?? 0) > 0)
    .sort()
  const { longest, current } = computeStreaks(activeSorted)

  return { daily, lifetime, peak, mostUsedModel, longestStreak: longest, currentStreak: current }
}
