/** Apply the theme + language to the document so settings take effect app-wide. */
import { setLang } from './i18n'
import { getCodeTheme, DEFAULT_LIGHT, DEFAULT_DARK } from './codeThemes'

const RTL_LANGS = ['ar', 'he', 'fa', 'ur']

export const CODE_THEME_LIGHT_KEY = 'bh.codeThemeLight'
export const CODE_THEME_DARK_KEY = 'bh.codeThemeDark'

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** The code-theme id selected for the current (or given) light/dark mode. */
export function currentCodeThemeId(dark = document.documentElement.getAttribute('data-theme') !== 'light'): string {
  return readLS(dark ? CODE_THEME_DARK_KEY : CODE_THEME_LIGHT_KEY) ?? (dark ? DEFAULT_DARK : DEFAULT_LIGHT)
}

/** Push the active code theme's palette onto :root so the viewer + code blocks pick it up. */
export function applyCodeTheme(): void {
  const theme = getCodeTheme(currentCodeThemeId())
  const root = document.documentElement.style
  for (const [k, v] of Object.entries(theme.vars)) root.setProperty(`--${k}`, v)
}

export function applyTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
  // The code theme is per-mode, so re-apply whenever light/dark changes.
  applyCodeTheme()
}

export function applyLanguage(code: string): void {
  const lang = code || 'en'
  document.documentElement.lang = lang
  document.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr'
  // Switch the UI translation layer and re-render all subscribed components.
  setLang(lang)
}
