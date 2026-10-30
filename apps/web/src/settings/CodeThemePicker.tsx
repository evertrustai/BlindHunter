import { useMemo, useState, type CSSProperties } from 'react'
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import { LIGHT_THEMES, DARK_THEMES, themeStyle, getCodeTheme, DEFAULT_LIGHT, DEFAULT_DARK, type CodeTheme } from '../lib/codeThemes'
import { applyCodeTheme, CODE_THEME_LIGHT_KEY, CODE_THEME_DARK_KEY } from '../lib/appearance'

hljs.registerLanguage('typescript', typescript)

/** Preview rows: a tiny diff so each theme shows context + an added + a removed line. */
const ROWS: { ln: number; type: 'ctx' | 'del' | 'add'; code: string }[] = [
  { ln: 1, type: 'ctx', code: 'function greet(name: string) {' },
  { ln: 2, type: 'del', code: '  return "Hello, " + name;' },
  { ln: 2, type: 'add', code: '  return `Hello, ${name}!`;' },
  { ln: 3, type: 'ctx', code: '}' },
]

function hl(code: string): string {
  try {
    return hljs.highlight(code, { language: 'typescript', ignoreIllegals: true }).value
  } catch {
    return code
  }
}

function readLS(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function saveLS(k: string, v: string): void {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* storage unavailable */
  }
}

/** The theme preview: a small syntax-highlighted diff rendered in the given theme. */
function Preview({ theme }: { theme: CodeTheme }) {
  const rows = useMemo(() => ROWS.map((r) => ({ ...r, html: hl(r.code) })), [])
  return (
    <div className="ctp-preview" style={themeStyle(theme) as CSSProperties}>
      {rows.map((r, i) => (
        <div key={i} className={`ctp-row ${r.type}`}>
          <span className="ctp-mark" />
          <span className="ctp-ln">{r.ln}</span>
          <code className="ctp-ln-code" dangerouslySetInnerHTML={{ __html: r.html }} />
        </div>
      ))}
    </div>
  )
}

/** "Code appearance" — a Light and a Dark dropdown, each with a live theme preview. */
export function CodeThemePicker() {
  const [light, setLight] = useState(() => readLS(CODE_THEME_LIGHT_KEY) ?? DEFAULT_LIGHT)
  const [dark, setDark] = useState(() => readLS(CODE_THEME_DARK_KEY) ?? DEFAULT_DARK)

  function pick(mode: 'light' | 'dark', id: string) {
    if (mode === 'light') {
      setLight(id)
      saveLS(CODE_THEME_LIGHT_KEY, id)
    } else {
      setDark(id)
      saveLS(CODE_THEME_DARK_KEY, id)
    }
    // Updates the live viewer immediately if the picked mode matches the current app mode.
    applyCodeTheme()
  }

  return (
    <>
      <div className="grouphdr">Code appearance</div>
      <div className="setrow-d" style={{ margin: '-2px 0 12px' }}>
        Syntax theme for the file viewer. Pick one for light mode and one for dark — the matching one is used
        automatically with your app theme.
      </div>
      <div className="ctp-cols">
        <div className="ctp-col">
          <div className="ctp-sub">Light mode</div>
          <select className="ctl ctp-sel" aria-label="Light code theme" value={light} onChange={(e) => pick('light', e.target.value)}>
            {LIGHT_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Preview theme={getCodeTheme(light)} />
        </div>
        <div className="ctp-col">
          <div className="ctp-sub">Dark mode</div>
          <select className="ctl ctp-sel" aria-label="Dark code theme" value={dark} onChange={(e) => pick('dark', e.target.value)}>
            {DARK_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Preview theme={getCodeTheme(dark)} />
        </div>
      </div>
    </>
  )
}
