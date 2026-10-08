export interface MenuRow {
  id: string
  label: string
  caption: string
}

interface Props {
  items: MenuRow[]
  activeIndex: number
  prefix?: string
  onHover: (i: number) => void
  onSelect: (row: MenuRow) => void
}

/** A floating command / mention palette above the composer box. */
export function SlashMenu({ items, activeIndex, prefix = '/', onHover, onSelect }: Props) {
  if (items.length === 0) return null
  return (
    <div className="slash-menu" role="listbox">
      {items.map((c, i) => (
        <button
          key={c.id}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          className={i === activeIndex ? 'slash-item active' : 'slash-item'}
          onMouseEnter={() => onHover(i)}
          onMouseDown={(e) => {
            e.preventDefault() // keep focus in the textarea
            onSelect(c)
          }}
        >
          <span className="si-label">
            {prefix}
            {c.label}
          </span>
          <span className="si-cap">{c.caption}</span>
        </button>
      ))}
    </div>
  )
}
