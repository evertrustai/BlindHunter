import { useMemo, useState, type CSSProperties } from 'react'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import { LIGHT_THEMES, DARK_THEMES, themeStyle, DEFAULT_LIGHT, DEFAULT_DARK, type CodeTheme } from '../lib/codeThemes'
import { applyCodeTheme, CODE_THEME_LIGHT_KEY, CODE_THEME_DARK_KEY } from '../lib/appearance'

hljs.registerLanguage('javascript', javascript)

const SAMPLE = `// fetch a user by id
async function getUser(id) {
  const res = await fetch(\`/api/users/\${id}\`)
  if (!res.ok) return null
  return res.json()
}`

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

/** "Code appearance" — pick a syntax theme for light mode and one for dark, with live previews. */
export function CodeThemePicker() {
  const sampleHtml = useMemo(() => {
    try {
      return hljs.highlight(SAMPLE, { language: 'javascript' }).value
    } catch {
      return SAMPLE
    }
  }, [])
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

  const group = (label: string, themes: CodeTheme[], selected: string, mode: 'light' | 'dark') => (
    <>
      <div className="ctp-sub">{label}</div>
      <div className="ctp-grid">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === selected ? 'ctp-card on' : 'ctp-card'}
            style={themeStyle(t) as CSSProperties}
            onClick={() => pick(mode, t.id)}
            title={t.name}
          >
            <pre className="ctp-code hljs">
              <code dangerouslySetInnerHTML={{ __html: sampleHtml }} />
            </pre>
            <div className="ctp-name">
              <span className="ctp-nm">{t.name}</span>
              {t.id === selected && <span className="ctp-check">✓</span>}
            </div>
          </button>
        ))}
      </div>
    </>
  )

  return (
    <>
      <div className="grouphdr">Code appearance</div>
      <div className="setrow-d" style={{ margin: '-2px 0 12px' }}>
        Syntax theme for the file viewer. Choose one for light mode and one for dark — the matching one is used
        automatically with your app theme.
      </div>
      {group('Light mode', LIGHT_THEMES, light, 'light')}
      <div style={{ height: 16 }} />
      {group('Dark mode', DARK_THEMES, dark, 'dark')}
    </>
  )
}
