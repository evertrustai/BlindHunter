import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { filterCommands, type SlashCommand } from '../lib/commands'

/** Only the leading "/" plus a bare command token — no space yet (still composing it). */
const SLASH_TRIGGER = /^\/[\w:-]*$/

/**
 * Drives the "/" command palette: whether it's open, the filtered list, which
 * row is active, and keyboard navigation. `commands` is the caller's own
 * (already-filtered-to-what-applies) list; selection itself is left to the caller.
 */
export function useSlashMenu(text: string, commands: SlashCommand[]) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  const rawOpen = SLASH_TRIGGER.test(text)
  const query = rawOpen ? text.slice(1) : ''

  // Leaving slash-mode clears a prior Escape-dismissal, so the next "/" reopens it.
  useEffect(() => {
    if (!rawOpen) setDismissed(false)
  }, [rawOpen])

  const items = useMemo(() => (rawOpen ? filterCommands(commands, query) : []), [rawOpen, query, commands])
  const open = rawOpen && !dismissed && items.length > 0
  const activeIndexClamped = items.length ? Math.min(activeIndex, items.length - 1) : 0

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, onSelect: (cmd: SlashCommand) => void): boolean {
    if (!open) return false
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % items.length)
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + items.length) % items.length)
      return true
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      onSelect(items[activeIndexClamped])
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setDismissed(true)
      return true
    }
    return false
  }

  return { open, items, activeIndex: activeIndexClamped, setActiveIndex, handleKeyDown }
}
