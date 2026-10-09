import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react'

export interface Attachment {
  name: string
  kind: 'text' | 'image'
  /** Text files/pastes. */
  content?: string
  /** Images: a data URL (data:image/png;base64,…) sent to the model as vision input. */
  dataUrl?: string
}

const MAX_ATTACH_BYTES = 400_000
/** Pasted/attached images, as a data URL — capped so the request stays reasonable. */
const MAX_IMAGE_BYTES = 8_000_000

function readAsDataURL(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(f)
  })
}
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

  async function addImageFile(f: File, fallbackName?: string) {
    if (f.size > MAX_IMAGE_BYTES) return
    try {
      const dataUrl = await readAsDataURL(f)
      const ext = (f.type.split('/')[1] || 'png').replace('+xml', '')
      const name = f.name && f.name !== 'image.png' ? f.name : fallbackName || `pasted-${Date.now()}.${ext}`
      setAttachments((a) => [...a, { name, kind: 'image', dataUrl }])
    } catch {
      // unreadable — skip
    }
  }

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        await addImageFile(f)
      } else {
        if (f.size > MAX_ATTACH_BYTES) continue
        try {
          const content = await f.text()
          setAttachments((a) => [...a, { name: f.name, kind: 'text', content }])
        } catch {
          // binary / unreadable — skip
        }
      }
    }
    e.target.value = ''
  }

  /** Paste images/screenshots from the clipboard; text paste falls through to default. */
  async function onPaste(e: ClipboardEvent) {
    const items = Array.from(e.clipboardData?.items ?? [])
    const imageItems = items.filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
    if (imageItems.length === 0) return // plain text — let the textarea handle it
    e.preventDefault()
    for (const it of imageItems) {
      const f = it.getAsFile()
      if (f) await addImageFile(f)
    }
  }

  function removeAttachment(i: number) {
    setAttachments((a) => a.filter((_, j) => j !== i))
  }

  /** Data URLs of attached images, for sending to the model as vision input. */
  function imageUrls(): string[] {
    return attachments.filter((a) => a.kind === 'image' && a.dataUrl).map((a) => a.dataUrl as string)
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

  /** Build the final message (text attachments + text). Images go separately via imageUrls(). */
  function compose(): string {
    const parts: string[] = attachments
      .filter((a) => a.kind === 'text' && a.content)
      .map((a) => `Attached file: ${a.name}\n\`\`\`\n${(a.content ?? '').slice(0, 20000)}\n\`\`\``)
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
    onPaste,
    imageUrls,
    listening,
    toggleMic,
    compose,
    reset,
  }
}
