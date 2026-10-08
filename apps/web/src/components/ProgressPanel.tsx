import { useState } from 'react'
import type { PlanStep } from '../lib/api'

/** Compact task tracker — a small pill showing the current step; expands to the full plan. */
export function ProgressPanel({ steps, running, cmdCount, elapsed }: {
  steps: PlanStep[]
  running: boolean
  cmdCount: number
  elapsed: string
}) {
  const [open, setOpen] = useState(false)
  const done = steps.filter((s) => s.status === 'completed').length
  const hasFooter = cmdCount > 0 || running

  if (steps.length === 0 && !hasFooter) return null

  const allDone = steps.length > 0 && done === steps.length
  // The compact bar shows the active step, or a short status when there's no plan.
  const current = steps.find((s) => s.status === 'in_progress') ?? steps.find((s) => s.status === 'pending')
  const label = current
    ? current.title
    : allDone
      ? 'All steps complete'
      : running
        ? `Working${cmdCount > 0 ? ` · ${cmdCount} run` : ''} · ${elapsed}`
        : 'Idle'

  return (
    <div className={open ? 'progress open' : 'progress'}>
      <button className="progress-bar" onClick={() => setOpen((o) => !o)} title={label}>
        <span className="pb-ico">{allDone ? '✓' : '→'}</span>
        <span className="pb-label">{label}</span>
        {steps.length > 0 && (
          <span className="pb-count">
            {done}/{steps.length}
          </span>
        )}
        <span className="pb-caret">{open ? '▾' : '▸'}</span>
      </button>

      {open && (steps.length > 0 || hasFooter) && (
        <div className="progress-body">
          {steps.length > 0 && (
            <div className="progress-steps">
              {steps.map((s, i) => (
                <div className={`progress-step ${s.status}`} key={i}>
                  <span className="ps-ico">
                    {s.status === 'completed' ? '✓' : s.status === 'in_progress' ? '→' : '○'}
                  </span>
                  <span className="ps-title">{s.title}</span>
                </div>
              ))}
            </div>
          )}
          {hasFooter && (
            <div className="progress-foot">
              <span>Terminals</span>
              <span className="pf-meta">
                {elapsed}
                {cmdCount > 0 && ` · ${cmdCount} run`}
                {running && ' · working'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
