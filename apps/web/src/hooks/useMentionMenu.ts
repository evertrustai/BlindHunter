import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import type { Agent } from '../lib/api'
import type { MenuRow } from '../components/SlashMenu'

/** An "@partial" token being typed at the end of the text. */
const MENTION = /(^|\s)@([a-zA-Z0-9-]*)$/

/**
 * Autocomplete for @mentions: when the text ends in an "@partial" token, offers
 * matching top-level agents; selecting one inserts "@name " into the text. This
 * is a convenience — the server detects @mentions in the sent message regardless.
 */
export function useMentionMenu(text: string, setText: (t: string) => void, agents: Agent[]) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  const match = MENTION.exec(text)
  const partial = match ? match[2].toLowerCase() : null

  useEffect(() => {
    if (partial === null) setDismissed(false)
  }, [partial])

  const items = useMemo<MenuRow[]>(() => {
    if (partial === null) return []
    return agents
      .filter((a) => a.kind === 'agent' && a.name.includes(partial))
      .map((a) => ({ id: a.id, label: a.name, caption: a.description }))
  }, [partial, agents])

  const open = partial !== null && !dismissed && items.length > 0
  const activeIndexClamped = items.length ? Math.min(activeIndex, items.length - 1) : 0

  function apply(row: MenuRow) {
    const m = MENTION.exec(text)
    if (!m) return
    const atStart = text.length - (m[0].length - m[1].length) // index of the '@'
    setText(text.slice(0, atStart) + '@' + row.label + ' ')
    setDismissed(false)
    setActiveIndex(0)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
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
      apply(items[activeIndexClamped])
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setDismissed(true)
      return true
    }
    return false
  }

  return { open, items, activeIndex: activeIndexClamped, setActiveIndex, handleKeyDown, apply }
}
