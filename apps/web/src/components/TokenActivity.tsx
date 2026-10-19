import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { UsageStats } from '../lib/api'

type View = 'daily' | 'weekly' | 'cumulative'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CELL = 12 // px, must match .tok-cell size in CSS
const GAP = 3 // px, must match .tok-grid gap in CSS
const STEP = CELL + GAP

function trimZero(x: number): string {
  return x.toFixed(1).replace(/\.0$/, '')
}
function fmtTokens(n: number): string {
  if (!n || n <= 0) return '0'
  if (n >= 1e9) return `${trimZero(n / 1e9)}B`
  if (n >= 1e6) return `${trimZero(n / 1e6)}M`
  if (n >= 1e3) return `${trimZero(n / 1e3)}K`
  return String(Math.round(n))
}
function shortModel(ref: string | null): string {
  if (!ref) return '—'
  const parts = ref.split('/')
  return parts[parts.length - 1] || ref
}
function dayWord(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`
}
/** Parse a "YYYY-MM-DD" key as a LOCAL date (avoids UTC off-by-one). */
function localDate(key: string): Date {
  return new Date(`${key}T00:00:00`)
}

/** Per-day value under the selected view. */
function viewValues(daily: { date: string; total: number }[], view: View, startWeekday: number): number[] {
  const totals = daily.map((d) => d.total)
  if (view === 'daily') return totals
  if (view === 'cumulative') {
    let acc = 0
    return totals.map((t) => (acc += t))
  }
  // weekly: every day in a column shares that column's (calendar-week) total
  const weekSums: number[] = []
  daily.forEach((d, i) => {
    const col = Math.floor((startWeekday + i) / 7)
    weekSums[col] = (weekSums[col] ?? 0) + d.total
  })
  return daily.map((_, i) => weekSums[Math.floor((startWeekday + i) / 7)])
}

/** Map a value to one of 5 intensity levels (0 = empty), log-scaled for skew. */
function levelOf(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0
  const frac = Math.log(value + 1) / Math.log(max + 1)
  return Math.min(4, Math.max(1, Math.ceil(frac * 4)))
}

interface Cell {
  date: string
  value: number
  level: number
}

function buildGrid(daily: { date: string; total: number }[], view: View) {
  if (!daily.length) return { cells: [] as (Cell | null)[], weeks: 0, months: [] as { col: number; label: string }[] }
  const startWeekday = localDate(daily[0].date).getDay() // 0 = Sunday
  const vals = viewValues(daily, view, startWeekday)
  const max = vals.reduce((m, v) => (v > m ? v : m), 0)

  const cells: (Cell | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null) // lead-in so day 0 lands on its weekday
  daily.forEach((d, i) => cells.push({ date: d.date, value: vals[i], level: levelOf(vals[i], max) }))
  while (cells.length % 7 !== 0) cells.push(null)

  const months: { col: number; label: string }[] = []
  let lastMonth = -1
  daily.forEach((d, i) => {
    const mo = localDate(d.date).getMonth()
    if (mo !== lastMonth) {
      months.push({ col: Math.floor((startWeekday + i) / 7), label: MONTHS[mo] })
      lastMonth = mo
    }
  })
  return { cells, weeks: cells.length / 7, months }
}

function Stat({ value, label, title }: { value: string; label: string; title?: string }) {
  return (
    <div className="tok-stat">
      <div className="tok-stat-v" title={title}>
        {value}
      </div>
      <div className="tok-stat-l">{label}</div>
    </div>
  )
}

/** Settings dashboard: a 365-day token-usage heatmap plus lifetime/peak/streak stats. */
export function TokenActivity() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [view, setView] = useState<View>('daily')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void api.getUsage().then(setStats).catch(() => setStats(null))
  }, [])

  const grid = useMemo(() => buildGrid(stats?.daily ?? [], view), [stats, view])

  // Show the most recent weeks (where current activity is) by default.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [grid])

  if (!stats) return null

  return (
    <div className="tok-wrap">
      <div className="tok-heat">
        <div className="tok-heat-head">
          <span className="tok-heat-title">Token activity</span>
          <div className="tok-views">
            {(['daily', 'weekly', 'cumulative'] as View[]).map((v) => (
              <button key={v} className={v === view ? 'tok-view on' : 'tok-view'} onClick={() => setView(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="tok-scroll" ref={scrollRef}>
          <div className="tok-grid">
            {grid.cells.map((c, i) =>
              c ? (
                <span
                  key={i}
                  className="tok-cell"
                  data-lvl={c.level}
                  title={`${c.date} · ${fmtTokens(c.value)} tokens`}
                />
              ) : (
                <span key={i} className="tok-cell" data-lvl={0} />
              ),
            )}
          </div>
          <div className="tok-months" style={{ width: grid.weeks * STEP }}>
            {grid.months.map((m, i) => (
              <span key={i} className="tok-month" style={{ left: m.col * STEP }}>
                {m.label}
              </span>
            ))}
          </div>
        </div>
        {stats.lifetime === 0 && (
          <div className="tok-empty">No token usage recorded yet — this fills in as you run the agent.</div>
        )}
      </div>

      <div className="tok-stats">
        <Stat value={fmtTokens(stats.lifetime)} label="Lifetime tokens" />
        <Stat value={fmtTokens(stats.peak)} label="Peak tokens" />
        <Stat value={shortModel(stats.mostUsedModel)} label="Most used model" title={stats.mostUsedModel ?? undefined} />
        <Stat value={dayWord(stats.longestStreak)} label="Longest streak" />
        <Stat value={dayWord(stats.currentStreak)} label="Current streak" />
      </div>
    </div>
  )
}
