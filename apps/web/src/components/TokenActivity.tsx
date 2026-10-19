import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { UsageStats } from '../lib/api'
import { useT } from '../lib/i18n'

type View = 'daily' | 'weekly' | 'cumulative'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
  const t = useT()
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [view, setView] = useState<View>('daily')

  useEffect(() => {
    void api.getUsage().then(setStats).catch(() => setStats(null))
  }, [])

  const grid = useMemo(() => buildGrid(stats?.daily ?? [], view), [stats, view])

  if (!stats) return null

  const dayWord = (n: number) => `${n} ${t(n === 1 ? 'day' : 'days')}`

  return (
    <div className="tok-wrap">
      <div className="tok-heat">
        <div className="tok-heat-head">
          <span className="tok-heat-title">{t('Token activity')}</span>
          <div className="tok-views">
            {(['daily', 'weekly', 'cumulative'] as View[]).map((v) => (
              <button key={v} className={v === view ? 'tok-view on' : 'tok-view'} onClick={() => setView(v)}>
                {t(v.charAt(0).toUpperCase() + v.slice(1))}
              </button>
            ))}
          </div>
        </div>
        <div className="tok-plot">
          <div className="tok-grid" style={{ gridTemplateColumns: `repeat(${grid.weeks}, 1fr)` }}>
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
          <div className="tok-months">
            {grid.months.map((m, i) => (
              <span key={i} className="tok-month" style={{ left: `${(m.col / grid.weeks) * 100}%` }}>
                {m.label}
              </span>
            ))}
          </div>
        </div>
        <div className="tok-legend" title="Darker = more tokens used that day">
          <span className="tok-legend-l">{t('Less')}</span>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <span key={lvl} className="tok-cell tok-legend-cell" data-lvl={lvl} />
          ))}
          <span className="tok-legend-l">{t('More')}</span>
        </div>
        {stats.lifetime === 0 && (
          <div className="tok-empty">No token usage recorded yet — this fills in as you run the agent.</div>
        )}
      </div>

      <div className="tok-stats">
        <Stat value={fmtTokens(stats.lifetime)} label={t('Lifetime tokens')} />
        <Stat value={fmtTokens(stats.peak)} label={t('Peak tokens')} />
        <Stat value={shortModel(stats.mostUsedModel)} label={t('Most used model')} title={stats.mostUsedModel ?? undefined} />
        <Stat value={dayWord(stats.longestStreak)} label={t('Longest streak')} />
        <Stat value={dayWord(stats.currentStreak)} label={t('Current streak')} />
      </div>
    </div>
  )
}
