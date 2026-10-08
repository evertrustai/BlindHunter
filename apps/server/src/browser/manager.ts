import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'
import { loadSettings } from '../config/store.js'

/** A console line captured from a page. */
export interface ConsoleLine {
  type: string
  text: string
  at: number
}
/** A network response captured from a page (useful as PoC evidence). */
export interface NetLine {
  method: string
  url: string
  status: number
  resourceType: string
  at: number
}
export interface TabInfo {
  id: string
  url: string
  title: string
  active: boolean
  loading: boolean
}

interface Tab {
  id: string
  page: Page
  loading: boolean
  console: ConsoleLine[]
  requests: NetLine[]
}

let browser: Browser | null = null
let context: BrowserContext | null = null
let launching: Promise<BrowserContext> | null = null
const tabs = new Map<string, Tab>()
let activeId: string | null = null
let seq = 0

/** Installed Chromium-family browsers to try first, so no binary has to be downloaded. */
const CHANNELS = ['chrome', 'msedge'] as const

/** Launch (once) an installed Chrome/Edge, or fall back to a bundled Chromium build. */
async function ensureContext(): Promise<BrowserContext> {
  if (context) return context
  if (launching) return launching
  launching = (async () => {
    let lastErr: unknown
    for (const channel of CHANNELS) {
      try {
        browser = await chromium.launch({ channel, headless: true })
        break
      } catch (e) {
        lastErr = e
      }
    }
    if (!browser) {
      try {
        browser = await chromium.launch({ headless: true })
      } catch (e) {
        launching = null
        const detail = lastErr instanceof Error ? lastErr.message : e instanceof Error ? e.message : String(e)
        throw new Error(
          `Could not launch a browser. Install Google Chrome or Microsoft Edge, or run "playwright install chromium". (${detail})`,
        )
      }
    }
    // TLS certs are validated by default; accepting invalid ones (for Burp/self-signed
    // interception) is an explicit opt-in, since it otherwise exposes every navigation to MITM.
    const insecure = await loadSettings()
      .then((s) => s.browserInsecureCerts === true)
      .catch(() => false)
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: insecure,
    })
    browser.on('disconnected', () => {
      browser = null
      context = null
      tabs.clear()
      activeId = null
    })
    launching = null
    return context
  })()
  return launching
}

function normalizeUrl(u: string): string {
  const s = u.trim()
  if (!s) return 'about:blank'
  if (/^[a-z]+:\/\//i.test(s) || s === 'about:blank') return s
  if (/^(localhost|127\.0\.0\.1|\[?::1\]?|0\.0\.0\.0)(:|\/|$)/i.test(s)) return `http://${s}`
  return `https://${s}`
}

function attach(tab: Tab): void {
  tab.page.on('console', (msg) => {
    tab.console.push({ type: msg.type(), text: msg.text(), at: Date.now() })
    if (tab.console.length > 300) tab.console.shift()
  })
  tab.page.on('response', (res) => {
    try {
      tab.requests.push({
        method: res.request().method(),
        url: res.url(),
        status: res.status(),
        resourceType: res.request().resourceType(),
        at: Date.now(),
      })
      if (tab.requests.length > 800) tab.requests.shift()
    } catch {
      // response detached — ignore
    }
  })
  tab.page.on('close', () => {
    tabs.delete(tab.id)
    if (activeId === tab.id) activeId = tabs.keys().next().value ?? null
  })
}

function get(id?: string): Tab {
  const key = id ?? activeId
  const tab = key ? tabs.get(key) : null
  if (!tab) throw new Error('no such tab')
  return tab
}

/** Create a new tab (optionally navigating to a URL) and make it active. */
export async function newTab(url?: string): Promise<TabInfo> {
  const ctx = await ensureContext()
  const page = await ctx.newPage()
  const id = `tab-${++seq}`
  const tab: Tab = { id, page, loading: false, console: [], requests: [] }
  attach(tab)
  tabs.set(id, tab)
  activeId = id
  if (url && url !== 'about:blank') await go(id, url)
  return info(tab)
}

/** Ensure at least one tab exists and return its id — used by the agent tools. */
export async function ensureActiveTab(): Promise<string> {
  await ensureContext()
  if (activeId && tabs.has(activeId)) return activeId
  const t = await newTab()
  return t.id
}

function info(tab: Tab): TabInfo {
  return {
    id: tab.id,
    url: tab.page.url(),
    title: '',
    active: tab.id === activeId,
    loading: tab.loading,
  }
}

export async function listTabs(): Promise<TabInfo[]> {
  const out: TabInfo[] = []
  for (const tab of tabs.values()) {
    let title = ''
    try {
      title = await tab.page.title()
    } catch {
      // page navigating — leave blank
    }
    out.push({ ...info(tab), title })
  }
  return out
}

export function setActive(id: string): void {
  if (tabs.has(id)) activeId = id
}

export async function closeTab(id: string): Promise<void> {
  const tab = tabs.get(id)
  if (!tab) return
  await tab.page.close().catch(() => {})
  tabs.delete(id)
  if (activeId === id) activeId = tabs.keys().next().value ?? null
}

/** Navigate a tab: a URL, or one of the actions back / forward / reload. */
export async function go(id: string, target: string): Promise<TabInfo> {
  const tab = get(id)
  tab.loading = true
  try {
    if (target === 'back') await tab.page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 })
    else if (target === 'forward') await tab.page.goForward({ waitUntil: 'domcontentloaded', timeout: 30000 })
    else if (target === 'reload') await tab.page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
    else await tab.page.goto(normalizeUrl(target), { waitUntil: 'domcontentloaded', timeout: 30000 })
  } finally {
    tab.loading = false
  }
  return { ...info(tab), title: await tab.page.title().catch(() => '') }
}

export async function screenshot(id?: string): Promise<Buffer> {
  const tab = get(id)
  return tab.page.screenshot({ type: 'png' })
}

export async function click(id: string | undefined, x: number, y: number): Promise<void> {
  await get(id).page.mouse.click(x, y)
}
export async function typeText(id: string | undefined, text: string): Promise<void> {
  await get(id).page.keyboard.type(text)
}
export async function pressKey(id: string | undefined, key: string): Promise<void> {
  await get(id).page.keyboard.press(key)
}
export async function scroll(id: string | undefined, dx: number, dy: number): Promise<void> {
  await get(id).page.mouse.wheel(dx, dy)
}

// Run in the page (browser) context — kept as strings so the Node-only server tsconfig
// doesn't need the DOM lib. Playwright evaluates the expression in Chromium.
const READ_TEXT_JS = `(() => document.body ? document.body.innerText : '')()`
const INTERACTIVES_JS = `(() => {
  const sel = 'a,button,input,textarea,select,[role=button],[onclick]';
  const els = Array.from(document.querySelectorAll(sel));
  return els.slice(0, 160).map((el) => ({
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute('type') || '',
    name: el.getAttribute('name') || el.id || '',
    text: (el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').trim().slice(0, 70),
    href: el.getAttribute('href') || '',
  }));
})()`

/** Visible text of the page body, trimmed for the model. */
export async function readText(id?: string, max = 8000): Promise<string> {
  const tab = get(id)
  const text = ((await tab.page.evaluate(READ_TEXT_JS).catch(() => '')) as string) || ''
  return text.replace(/\n{3,}/g, '\n\n').trim().slice(0, max)
}

/** Interactive elements (links, buttons, inputs) the agent can act on. */
export async function interactives(id?: string): Promise<
  { tag: string; type: string; name: string; text: string; href: string }[]
> {
  const tab = get(id)
  return (await tab.page.evaluate(INTERACTIVES_JS).catch(() => [])) as {
    tag: string
    type: string
    name: string
    text: string
    href: string
  }[]
}

/** Click by CSS selector or by visible text. Returns the resulting url/title. */
export async function clickTarget(id: string | undefined, opts: { selector?: string; text?: string }): Promise<TabInfo> {
  const tab = get(id)
  if (opts.selector) await tab.page.click(opts.selector, { timeout: 8000 })
  else if (opts.text) await tab.page.getByText(opts.text, { exact: false }).first().click({ timeout: 8000 })
  else throw new Error('click needs a selector or text')
  await tab.page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {})
  return { ...info(tab), title: await tab.page.title().catch(() => '') }
}

export async function fillField(id: string | undefined, selector: string, value: string): Promise<void> {
  await get(id).page.fill(selector, value, { timeout: 8000 })
}

export async function evaluate(id: string | undefined, expression: string): Promise<unknown> {
  return get(id).page.evaluate(`(async()=>{return (${expression})})()`)
}

export function consoleLines(id?: string, n = 60): ConsoleLine[] {
  return get(id).console.slice(-n)
}
export function netLines(id?: string, n = 80): NetLine[] {
  return get(id).requests.slice(-n)
}

export function currentUrl(id?: string): string {
  return get(id).page.url()
}

/** Close the whole browser (on shutdown). */
export async function shutdown(): Promise<void> {
  await browser?.close().catch(() => {})
  browser = null
  context = null
  tabs.clear()
  activeId = null
}

for (const sig of ['SIGINT', 'SIGTERM', 'beforeExit'] as const) {
  process.once(sig, () => {
    void shutdown()
  })
}
