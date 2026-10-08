import path from 'node:path'
import { mkdir, writeFile as fsWriteFile } from 'node:fs/promises'
import type { ToolSchema } from '../providers/openai.js'
import * as fsTools from './fs.js'
import * as browser from '../browser/manager.js'
import { HOME } from '../config/paths.js'
import { runShell, type ShellKind } from './shell.js'

/**
 * The agent's file tools must never read or write BlindHunter's own config directory
 * (~/.blindhunter/ holds credentials.yaml, settings, and session transcripts). A
 * malicious model/provider otherwise reads stored API keys straight into its context.
 */
function assertOutsideConfig(p: string): void {
  const rel = path.relative(HOME, path.resolve(p))
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new Error('access denied: the BlindHunter config directory is off-limits to tools')
  }
}

/** OpenAI-style tool schemas advertised to the model. */
export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    type: 'function',
    function: {
      name: 'bash',
      description: 'Run a shell command in the workspace and return its stdout, stderr, and exit code.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'The command to run.' } },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 text file. Path may be absolute or relative to the workspace.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write a UTF-8 text file, creating parent directories as needed.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Replace the first occurrence of old_string with new_string in a file.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' } },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List the entries in a directory.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_navigate',
      description:
        'Open a URL in the shared in-app browser (creates a tab if none). Returns the final URL, page title, and the visible text.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'URL to open (https:// assumed if no scheme).' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_read',
      description:
        'Read the current browser page: visible text plus the list of interactive elements (links, buttons, inputs) you can click or fill.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_click',
      description: 'Click an element on the current page by CSS selector or by its visible text.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector to click.' },
          text: { type: 'string', description: 'Visible text to click (used if no selector).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_fill',
      description: 'Fill a form field (input/textarea/select) identified by a CSS selector.',
      parameters: {
        type: 'object',
        properties: { selector: { type: 'string' }, value: { type: 'string' } },
        required: ['selector', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_press',
      description: 'Press a keyboard key on the current page, e.g. "Enter", "Tab", "Escape".',
      parameters: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_screenshot',
      description: 'Capture a PNG screenshot of the current page, saved into the workspace, and return its path.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_network',
      description: 'List the most recent network responses (method, status, URL) seen on the current page — useful as PoC evidence.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_console',
      description: 'List the most recent browser console messages on the current page.',
      parameters: { type: 'object', properties: {} },
    },
  },
]

const MAX_OUTPUT = 20000

/** Execute a tool call. `cwd` is the session workspace; relative paths resolve against it. */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  cwd: string,
  shell?: ShellKind,
): Promise<string> {
  const resolvePath = (p: unknown): string => {
    const s = String(p ?? '')
    return path.isAbsolute(s) ? s : path.join(cwd, s)
  }

  switch (name) {
    case 'bash': {
      const r = await runShell(String(args.command ?? ''), cwd, shell)
      const body = `exit ${r.code}\n${r.stdout}${r.stderr ? `\n[stderr]\n${r.stderr}` : ''}`
      return body.slice(0, MAX_OUTPUT)
    }
    case 'read_file': {
      const p = resolvePath(args.path)
      assertOutsideConfig(p)
      return (await fsTools.readFile(p)).slice(0, 40000)
    }
    case 'write_file': {
      const p = resolvePath(args.path)
      assertOutsideConfig(p)
      await fsTools.writeFile(p, String(args.content ?? ''))
      return `wrote ${args.path}`
    }
    case 'edit_file': {
      const p = resolvePath(args.path)
      assertOutsideConfig(p)
      await fsTools.editFile(p, String(args.old_string ?? ''), String(args.new_string ?? ''))
      return `edited ${args.path}`
    }
    case 'list_dir': {
      assertOutsideConfig(resolvePath(args.path))
      const entries = await fsTools.listDir(resolvePath(args.path))
      const text = entries.map((e) => `${e.type === 'dir' ? '[dir] ' : '[file]'} ${e.name}`).join('\n')
      return (text || '(empty)').slice(0, MAX_OUTPUT)
    }
    case 'browser_navigate': {
      const id = await browser.ensureActiveTab()
      const nav = await browser.go(id, String(args.url ?? ''))
      const text = await browser.readText(id, 4000)
      return `${nav.title || '(untitled)'}\n${nav.url}\n\n${text}`.slice(0, MAX_OUTPUT)
    }
    case 'browser_read': {
      const id = await browser.ensureActiveTab()
      const text = await browser.readText(id)
      const els = await browser.interactives(id)
      const list = els
        .map((e) => {
          const label = e.text || e.name || e.href
          const t = e.type ? `${e.tag}:${e.type}` : e.tag
          return `- [${t}] ${label}${e.name ? ` (name=${e.name})` : ''}${e.href ? ` -> ${e.href}` : ''}`
        })
        .join('\n')
      return `URL: ${browser.currentUrl(id)}\n\n${text}\n\n--- interactive elements ---\n${list || '(none)'}`.slice(
        0,
        MAX_OUTPUT,
      )
    }
    case 'browser_click': {
      const id = await browser.ensureActiveTab()
      const r = await browser.clickTarget(id, { selector: args.selector as string, text: args.text as string })
      return `clicked. now at ${r.title || '(untitled)'} — ${r.url}`
    }
    case 'browser_fill': {
      const id = await browser.ensureActiveTab()
      await browser.fillField(id, String(args.selector ?? ''), String(args.value ?? ''))
      return `filled ${args.selector}`
    }
    case 'browser_press': {
      const id = await browser.ensureActiveTab()
      await browser.pressKey(id, String(args.key ?? ''))
      return `pressed ${args.key}`
    }
    case 'browser_screenshot': {
      const id = await browser.ensureActiveTab()
      const png = await browser.screenshot(id)
      const dir = path.join(cwd, 'bh-screenshots')
      await mkdir(dir, { recursive: true })
      const file = path.join(dir, `shot-${Date.now()}.png`)
      await fsWriteFile(file, png)
      return `screenshot saved: ${file} (${Math.round(png.length / 1024)} KB)`
    }
    case 'browser_network': {
      const id = await browser.ensureActiveTab()
      const lines = browser
        .netLines(id)
        .map((r) => `${r.status} ${r.method} ${r.url}`)
        .join('\n')
      return (lines || '(no requests captured)').slice(0, MAX_OUTPUT)
    }
    case 'browser_console': {
      const id = await browser.ensureActiveTab()
      const lines = browser
        .consoleLines(id)
        .map((c) => `[${c.type}] ${c.text}`)
        .join('\n')
      return (lines || '(no console output)').slice(0, MAX_OUTPUT)
    }
    default:
      return `unknown tool: ${name}`
  }
}
