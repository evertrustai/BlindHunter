import { useEffect, useRef, useState, type ChangeEvent } from 'react'

export interface Attachment {
  name: string
  content: string
}

const MAX_ATTACH_BYTES = 400_000
/** Matches the textarea's CSS max-height (chat.css) — beyond this it scrolls instead of growing. */
const MAX_TEXTAREA_HEIGHT = 200

/** Minimal shape of the Web Speech API SpeechRecognition instance we use. */
interface SpeechRec {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: (e: unknown) => void
  onend: () => void
  onerror: (e: unknown) => void
  start: () => void
  stop: () => void
}

/**
 * Composer input state: text, file attachments, and voice dictation.
 * Attachments are read as text and prepended to the message on send.
 */
export function useComposer() {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [listening, setListening] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const recRef = useRef<SpeechRec | null>(null)
  // Voice dictation bookkeeping: text present when the mic started, the
  // accumulated finalized speech, and whether the user turned it off.
  const baseTextRef = useRef('')
  const finalRef = useRef('')
  const manualStopRef = useRef(false)

  // Grow the box to fit the typed text (up to the CSS max-height, then it scrolls)
  // instead of leaving the textarea a fixed height and scrolling inside it.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    if (!text) {
      // Nothing to measure — let CSS (min-height / rows=1) define the resting
      // height rather than trusting scrollHeight, which can read stale/wrong
      // on an empty textarea right after mount (before layout has settled).
      el.style.height = ''
      return
    }
    const resize = () => {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
    }
    resize()
    // scrollHeight can read stale on the very first measurement after a fresh
    // mount (before fonts/layout fully settle) — a corrective pass once the
    // browser has completed a real layout/paint cycle self-heals that.
    const raf = requestAnimationFrame(resize)
    return () => cancelAnimationFrame(raf)
  }, [text])

  function triggerAttach() {
    fileRef.current?.click()
  }

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    for (const f of files) {
      if (f.size > MAX_ATTACH_BYTES) continue
      try {
        const content = await f.text()
        setAttachments((a) => [...a, { name: f.name, content }])
      } catch {
        // binary / unreadable — skip
      }
    }
    e.target.value = ''
  }

  function removeAttachment(i: number) {
    setAttachments((a) => a.filter((_, j) => j !== i))
  }

  function toggleMic() {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as { new (): SpeechRec } | undefined
    if (!SR) {
      alert('Voice input needs Chrome or Edge (Web Speech API).')
      return
    }
    // Already listening → user is turning the mic off manually.
    if (listening) {
      manualStopRef.current = true
      recRef.current?.stop()
      return
    }

    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = true // stream partial words as they're spoken
    rec.continuous = true // keep listening across pauses until turned off
    manualStopRef.current = false
    baseTextRef.current = text
    finalRef.current = ''

    // Rebuild the box live from: text-at-start + finalized speech + current interim.
    rec.onresult = (e: unknown) => {
      const ev = e as {
        resultIndex: number
        results: ArrayLike<{ isFinal: boolean } & ArrayLike<{ transcript: string }>>
      }
      let interim = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        const chunk = r[0]?.transcript ?? ''
        if (r.isFinal) finalRef.current += chunk
        else interim += chunk
      }
      const base = baseTextRef.current
      const sep = base && !/\s$/.test(base) ? ' ' : ''
      setText(base + sep + finalRef.current + interim)
    }

    rec.onerror = (e: unknown) => {
      const err = (e as { error?: string }).error
      // Permission/hardware failures are fatal — stop and tell the user why.
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        manualStopRef.current = true
        setListening(false)
        alert('Microphone access is blocked. Click the mic/lock icon in the address bar, allow the mic, then try again.')
      } else if (err === 'audio-capture') {
        manualStopRef.current = true
        setListening(false)
        alert('No microphone was found. Check that a mic is connected and enabled.')
      }
      // Transient errors (no-speech, aborted, network) fall through to onend, which restarts.
    }

    // Chrome ends the session on silence/timeout even in continuous mode; resume
    // unless the user turned it off. A short delay avoids an InvalidStateError
    // race from restarting before the previous session has fully released.
    rec.onend = () => {
      if (manualStopRef.current) {
        setListening(false)
        return
      }
      setTimeout(() => {
        if (manualStopRef.current) return
        try {
          rec.start()
        } catch {
          setListening(false)
          manualStopRef.current = true
        }
      }, 250)
    }

    recRef.current = rec
    setListening(true)
    rec.start()
  }

  /** Build the final message (attachments + text), then a caller resets. */
  function compose(): string {
    const parts: string[] = attachments.map(
      (a) => `Attached file: ${a.name}\n\`\`\`\n${a.content.slice(0, 20000)}\n\`\`\``,
    )
    const t = text.trim()
    if (t) parts.push(t)
    return parts.join('\n\n')
  }

  function reset() {
    setText('')
    setAttachments([])
    // If the mic is still on, dictate into a fresh box next.
    baseTextRef.current = ''
    finalRef.current = ''
  }

  return {
    text,
    setText,
    attachments,
    removeAttachment,
    triggerAttach,
    fileRef,
    textareaRef,
    onFiles,
    listening,
    toggleMic,
    compose,
    reset,
  }
}
