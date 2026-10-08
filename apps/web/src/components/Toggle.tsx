import { useState } from 'react'

/** A switch. Controlled when `checked` is passed, otherwise uncontrolled. */
export function Toggle({
  defaultOn = false,
  label,
  checked,
  onChange,
  disabled,
}: {
  defaultOn?: boolean
  label?: string
  checked?: boolean
  onChange?: (on: boolean) => void
  disabled?: boolean
}) {
  const [internal, setInternal] = useState(defaultOn)
  const on = checked ?? internal
  function toggle() {
    if (disabled) return
    const next = !on
    if (checked === undefined) setInternal(next)
    onChange?.(next)
  }
  return (
    <button
      type="button"
      className={on ? 'tgl on' : 'tgl'}
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={toggle}
    />
  )
}
