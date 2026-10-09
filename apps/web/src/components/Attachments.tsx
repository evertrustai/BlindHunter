import type { Attachment } from '../hooks/useComposer'

/** Chips for files attached to the pending message. */
export function Attachments({ items, onRemove }: { items: Attachment[]; onRemove: (i: number) => void }) {
  if (items.length === 0) return null
  return (
    <div className="attach-row">
      {items.map((a, i) =>
        a.kind === 'image' ? (
          <span className="attach-chip img" key={`${a.name}-${i}`} title={a.name}>
            <img src={a.dataUrl} alt={a.name} />
            <button className="attach-x" aria-label={`Remove ${a.name}`} onClick={() => onRemove(i)}>
              ✕
            </button>
          </span>
        ) : (
          <span className="attach-chip" key={`${a.name}-${i}`}>
            📎 {a.name}
            <button className="attach-x" aria-label={`Remove ${a.name}`} onClick={() => onRemove(i)}>
              ✕
            </button>
          </span>
        ),
      )}
    </div>
  )
}
