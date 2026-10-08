/** Apply the theme + language to the document so settings take effect app-wide. */

const RTL_LANGS = ['ar', 'he', 'fa', 'ur']

export function applyTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
}

export function applyLanguage(code: string): void {
  const lang = code || 'en'
  document.documentElement.lang = lang
  document.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr'
}
