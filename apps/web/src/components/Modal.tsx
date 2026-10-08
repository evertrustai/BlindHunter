import { useEffect, useRef, useState } from 'react'

interface PromptModalProps {
  title: string
  placeholder?: string
  initialValue?: string
  confirmLabel?: string
  onCancel: () => void
  onSubmit: (value: string) => void
}

/** Centered in-app modal with a single text input (replaces window.prompt). */
export function PromptModal({
  title,
  placeholder,
  initialValue = '',
  confirmLabel = 'Save',
  onCancel,
  onSubmit,
}: PromptModalProps) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  function submit() {
    const v = value.trim()
    if (v) onSubmit(v)
  }

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal" role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <input
          ref={inputRef}
          className="modal-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
        <div className="modal-actions">
          <button className="modal-btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="modal-btn primary" onClick={submit} disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

interface BypassModalProps {
  /** Workspace the bypass applies to; null when no folder is selected yet. */
  workspace: string | null
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Shown the first time a workspace is switched to Full access / Bypass. It spells
 * out that the agent will run destructive commands unattended, and — once accepted —
 * the caller records the workspace so it isn't asked again.
 */
export function BypassModal({ workspace, onCancel, onConfirm }: BypassModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div
        className="modal bypass-modal"
        role="dialog"
        aria-label="Bypass all permissions"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-title">
          <span className="bypass-warn">⚠</span> Bypass all permissions?
        </div>
        <div className="modal-msg">
          BlindHunter will read, edit, and execute files without asking — including
          potentially destructive commands. Only use this in isolated or disposable
          environments you have authorization to test.
        </div>
        {workspace && <div className="bypass-path">{workspace}</div>}
        {workspace && (
          <div className="bypass-note">You won't be asked again for this workspace.</div>
        )}
        <div className="modal-actions">
          <button className="modal-btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="modal-btn danger" onClick={onConfirm}>
            Bypass permissions
          </button>
        </div>
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** Centered in-app confirmation modal (replaces window.confirm). */
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal" role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {message && <div className="modal-msg">{message}</div>}
        <div className="modal-actions">
          <button className="modal-btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className={danger ? 'modal-btn danger' : 'modal-btn primary'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
