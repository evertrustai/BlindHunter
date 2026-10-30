import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import cssLang from 'highlight.js/lib/languages/css'
import jsonLang from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import python from 'highlight.js/lib/languages/python'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import sql from 'highlight.js/lib/languages/sql'
import php from 'highlight.js/lib/languages/php'
import java from 'highlight.js/lib/languages/java'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import ruby from 'highlight.js/lib/languages/ruby'
import ini from 'highlight.js/lib/languages/ini'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import { api } from '../lib/api'
import type { FileView } from '../lib/api'

for (const [name, lang] of Object.entries({
  javascript,
  typescript,
  xml,
  css: cssLang,
  json: jsonLang,
  bash,
  python,
  go,
  rust,
  yaml,
  markdown,
  sql,
  php,
  java,
  c,
  cpp,
  ruby,
  ini,
  dockerfile,
})) {
  hljs.registerLanguage(name, lang as never)
}

/** File extension → highlight.js language. */
const LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json', jsonc: 'json',
  html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml', vue: 'xml',
  css: 'css', scss: 'css', sass: 'css', less: 'css',
  sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'bash',
  py: 'python', go: 'go', rs: 'rust',
  yml: 'yaml', yaml: 'yaml',
  md: 'markdown', markdown: 'markdown',
  sql: 'sql', php: 'php', java: 'java',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp',
  rb: 'ruby', ini: 'ini', toml: 'ini', conf: 'ini', cfg: 'ini', env: 'ini',
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (ch) => (ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'))
}

function highlight(content: string, name: string): string {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  let lang = LANG[ext]
  if (!lang && name.toLowerCase() === 'dockerfile') lang = 'dockerfile'
  try {
    if (lang && hljs.getLanguage(lang)) return hljs.highlight(content, { language: lang, ignoreIllegals: true }).value
    return hljs.highlightAuto(content).value
  } catch {
    return escapeHtml(content)
  }
}

export interface OpenFile {
  /** Path as the tool reported it (may be relative to the workspace). */
  path: string
  /** Session workspace, so the server can resolve a relative path. */
  cwd: string
}
export const fileKey = (f: OpenFile): string => `${f.cwd}\u0000${f.path}`
function baseName(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || p
}

interface FileViewerPanelProps {
  files: OpenFile[]
  activeKey: string | null
  onActivate: (key: string) => void
  onCloseFile: (key: string) => void
  onClose: () => void
  width: number
  onWidth: (w: number) => void
}

/** Right-docked file viewer: tabs, line numbers, syntax highlighting, and image preview. */
export function FileViewerPanel({ files, activeKey, onActivate, onCloseFile, onClose, width, onWidth }: FileViewerPanelProps) {
  const [view, setView] = useState<FileView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wrap, setWrap] = useState(false)
  const [copied, setCopied] = useState(false)
  const cache = useRef<Map<string, FileView>>(new Map())
  const panelRef = useRef<HTMLDivElement>(null)

  const active = files.find((f) => fileKey(f) === activeKey) ?? null

  const load = useCallback(
    async (f: OpenFile, force = false) => {
      const key = fileKey(f)
      if (!force && cache.current.has(key)) {
        setView(cache.current.get(key)!)
        setError(null)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const r = await api.readFileView(f.path, f.cwd)
        if (r.error) setError(r.error)
        else {
          cache.current.set(key, r)
          setView(r)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // Load whenever the active file changes.
  useEffect(() => {
    if (active) void load(active)
    else setView(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  const html = useMemo(
    () => (view?.kind === 'text' && view.content != null ? highlight(view.content, view.name) : ''),
    [view],
  )
  const lineCount = useMemo(() => (view?.content ? view.content.split('\n').length : 0), [view])

  function startDrag(e: ReactMouseEvent) {
    e.preventDefault()
    const right = panelRef.current?.getBoundingClientRect().right ?? window.innerWidth
    const move = (ev: MouseEvent) => onWidth(Math.max(360, Math.min(window.innerWidth - 360, right - ev.clientX)))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  async function copy() {
    if (!view?.content) return
    try {
      await navigator.clipboard.writeText(view.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="fvpanel" style={{ width }} ref={panelRef}>
      <div className="fvp-resize" onMouseDown={startDrag} title="Drag to resize" />

      {/* Tabs */}
      <div className="fvp-tabs">
        {files.map((f) => {
          const key = fileKey(f)
          const img = /\.(png|jpe?g|gif|webp|bmp|ico|avif|svg)$/i.test(f.path)
          return (
            <div
              key={key}
              className={key === activeKey ? 'fvp-tab on' : 'fvp-tab'}
              onClick={() => onActivate(key)}
              title={f.path}
            >
              <span className="fvp-tabico">{img ? '🖼' : '📄'}</span>
              <span className="fvp-tabname">{baseName(f.path)}</span>
              <span
                className="fvp-tabx"
                title="Close file"
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseFile(key)
                }}
              >
                ✕
              </span>
            </div>
          )
        })}
        <div className="fvp-spacer" />
        <button className="fvp-close" title="Close viewer" aria-label="Close viewer" onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Path + actions */}
      {active && (
        <div className="fvp-bar">
          <span className="fvp-path" title={view?.path ?? active.path}>
            {view?.path ?? active.path}
          </span>
          <div className="fvp-actions">
            {view?.kind === 'text' && (
              <>
                <button className="fvp-act" title="Toggle word wrap" onClick={() => setWrap((w) => !w)} data-on={wrap}>
                  ⤶
                </button>
                <button className="fvp-act" title="Copy file contents" onClick={copy}>
                  {copied ? '✓' : '⧉'}
                </button>
              </>
            )}
            <button className="fvp-act" title="Reload from disk" onClick={() => active && load(active, true)}>
              ⟳
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="fvp-body">
        {!active ? (
          <div className="fvp-empty">No file open.</div>
        ) : loading ? (
          <div className="fvp-empty">
            <span className="fvp-spin" /> Loading…
          </div>
        ) : error ? (
          <div className="fvp-empty fvp-err">⚠ {error}</div>
        ) : view?.kind === 'image' ? (
          <div className="fvp-image">
            <img src={api.rawFileUrl(active.path, active.cwd)} alt={view.name} />
          </div>
        ) : view?.kind === 'binary' ? (
          <div className="fvp-empty">
            Binary file — {Math.round((view.size / 1024) * 10) / 10} KB. Can't display as text.
          </div>
        ) : view?.kind === 'text' ? (
          <div className={wrap ? 'fvp-code wrap' : 'fvp-code'}>
            {!wrap && (
              <div className="fvp-gutter" style={{ minWidth: `${String(lineCount).length + 1}ch` }}>
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
            )}
            <pre className="fvp-pre">
              <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
          </div>
        ) : null}
        {view?.truncated && <div className="fvp-trunc">Showing the first part of a large file.</div>}
      </div>
    </div>
  )
}
