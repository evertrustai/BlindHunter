/**
 * Coordinates human-in-the-loop tool approvals. The agent loop awaits
 * `requestApproval(callId)`; the HTTP approve route resolves it.
 */
const pending = new Map<string, (approved: boolean) => void>()

export function requestApproval(id: string, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false)
      return
    }
    pending.set(id, resolve)
    signal?.addEventListener(
      'abort',
      () => {
        if (pending.delete(id)) resolve(false)
      },
      { once: true },
    )
  })
}

/** Resolve a pending approval. Returns false if there was nothing waiting on it. */
export function resolveApproval(id: string, approved: boolean): boolean {
  const resolve = pending.get(id)
  if (!resolve) return false
  pending.delete(id)
  resolve(approved)
  return true
}
