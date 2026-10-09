import type { AgentEvent } from './types.js'

/**
 * Per-session background agent runs. A run is driven to completion on the server,
 * independent of any client connection — so navigating to another session, or
 * closing the tab, does NOT stop the work. Clients subscribe to receive the run's
 * events (buffered + live); unsubscribing never stops the run. Only an explicit
 * stop (the Stop button → stopRun) aborts it.
 */

interface ActiveRun {
  events: AgentEvent[]
  subscribers: Set<(e: AgentEvent) => void>
  abort: AbortController
  done: boolean
}

const runs = new Map<string, ActiveRun>()

export function isRunning(sessionId: string): boolean {
  const r = runs.get(sessionId)
  return Boolean(r && !r.done)
}

/** Explicit, user-initiated stop. Returns true if a live run was aborted. */
export function stopRun(sessionId: string): boolean {
  const r = runs.get(sessionId)
  if (r && !r.done) {
    r.abort.abort()
    return true
  }
  return false
}

interface RunHooks {
  /** Called for every event (for persistence bookkeeping). */
  onEvent?: (e: AgentEvent) => void
  /** Called once after the run finishes (to persist the transcript). */
  onComplete?: () => void | Promise<void>
}

/**
 * Start a background run for a session. The generator is driven to completion even
 * with no subscribers; events are buffered so a client that connects (or reconnects)
 * later replays everything so far and then streams live. A new run for a session
 * replaces (stops) any previous one.
 */
export function startRun(
  sessionId: string,
  make: (signal: AbortSignal) => AsyncGenerator<AgentEvent>,
  hooks: RunHooks = {},
): void {
  stopRun(sessionId)
  const abort = new AbortController()
  const run: ActiveRun = { events: [], subscribers: new Set(), abort, done: false }
  runs.set(sessionId, run)

  const emit = (e: AgentEvent) => {
    run.events.push(e)
    try {
      hooks.onEvent?.(e)
    } catch {
      /* bookkeeping must not break the run */
    }
    for (const sub of [...run.subscribers]) {
      try {
        sub(e)
      } catch {
        /* a dead subscriber must not break the run */
      }
    }
  }

  void (async () => {
    try {
      for await (const ev of make(abort.signal)) emit(ev)
    } catch (e) {
      emit({ type: 'error', message: e instanceof Error ? e.message : String(e) })
    }
    try {
      await hooks.onComplete?.()
    } catch {
      /* ignore persistence errors */
    }
    emit({ type: 'end' })
    run.done = true
    // Keep the buffer briefly so a client returning right after completion still
    // sees the result via replay; then drop it to free memory.
    setTimeout(() => {
      if (runs.get(sessionId) === run) runs.delete(sessionId)
    }, 120_000)
  })()
}

/**
 * Subscribe to a session's run: first replays every buffered event, then streams
 * live ones. Returns an unsubscribe function, or null if there's no run. Calling
 * unsubscribe removes the listener but does NOT stop the run.
 */
export function subscribe(sessionId: string, cb: (e: AgentEvent) => void): (() => void) | null {
  const run = runs.get(sessionId)
  if (!run) return null
  for (const ev of run.events) {
    try {
      cb(ev)
    } catch {
      /* ignore */
    }
  }
  if (run.done) return () => {}
  run.subscribers.add(cb)
  return () => {
    run.subscribers.delete(cb)
  }
}
