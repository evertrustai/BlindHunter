import { useEffect, useRef, useState, type ReactNode } from 'react'

interface DropdownProps {
  /** Trigger button content. */
  label: ReactNode
  children: ReactNode
  /** Extra class for the trigger button (e.g. "ghost", "model", "usagebtn"). */
  buttonClassName?: string
  align?: 'left' | 'right'
  up?: boolean
  wide?: boolean
  ariaLabel?: string
}

/** A pill trigger + floating menu. Closes on outside click, Escape, or item click. */
export function Dropdown({
  label,
  children,
  buttonClassName,
  align = 'left',
  up = false,
  wide = false,
  ariaLabel,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const menuClass = ['menu', up && 'up', align === 'right' && 'right', wide && 'wide']
    .filter(Boolean)
    .join(' ')

  return (
    <div className="pill" ref={ref}>
      <button
        type="button"
        className={buttonClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <div className={menuClass} role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

interface MenuItemProps {
  title: ReactNode
  desc?: ReactNode
  checked?: boolean
  onSelect?: () => void
}

/** A selectable menu row with an optional checkmark. */
export function MenuItem({ title, desc, checked, onSelect }: MenuItemProps) {
  return (
    <button type="button" className="mi" role="menuitemradio" aria-checked={checked} onClick={onSelect}>
      <span className="body">
        <span className="t">{title}</span>
        {desc && <span className="d">{desc}</span>}
      </span>
      <span className={checked ? 'ck' : 'ck hidden'} aria-hidden="true">
        ✔
      </span>
    </button>
  )
}
