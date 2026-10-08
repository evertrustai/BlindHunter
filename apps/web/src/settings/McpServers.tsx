import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { McpServer } from '../lib/api'
import { Toggle } from '../components/Toggle'

type Transport = 'stdio' | 'sse' | 'http'

interface Form {
  id?: string
  name: string
  transport: Transport
  command: string
  args: string // one per line
  url: string
}

const BLANK: Form = { name: '', transport: 'stdio', command: '', args: '', url: '' }

const STATUS_COLOR: Record<string, string> = {
  connected: 'var(--ok)',
  error: 'var(--danger)',
  connecting: 'var(--warn)',
  disabled: 'var(--txt-3)',
}

export function McpServers() {
  const [servers, setServers] = useState<McpServer[] | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      setServers(await api.getMcp())
    } catch {
      setServers([])
    }
  }
  useEffect(() => {
    void load()
  }, [])

  function toForm(s: McpServer): Form {
    return {
      id: s.id,
      name: s.name,
      transport: s.transport,
      command: s.command ?? '',
      args: (s.args ?? []).join('\n'),
      url: s.url ?? '',
    }
  }

  async function save() {
    if (!form) return
    const payload: Partial<McpServer> = {
      name: form.name.trim(),
      transport: form.transport,
      command: form.transport === 'stdio' ? form.command.trim() : undefined,
      args: form.transport === 'stdio' ? form.args.split('\n').map((a) => a.trim()).filter(Boolean) : undefined,
      url: form.transport !== 'stdio' ? form.url.trim() : undefined,
    }
    const valid = form.name.trim() && (form.transport === 'stdio' ? form.command.trim() : form.url.trim())
    if (!valid) return
    setBusy(true)
    try {
      if (form.id) await api.updateMcp(form.id, payload)
      else await api.addMcp(payload)
      await load()
      setForm(null)
    } catch {
      // ignore
    } finally {
      setBusy(false)
    }
  }

  async function toggleEnabled(s: McpServer, enabled: boolean) {
    setServers((cur) => (cur ?? []).map((x) => (x.id === s.id ? { ...x, enabled } : x)))
    try {
      await api.updateMcp(s.id, { enabled })
    } finally {
      await load()
    }
  }

  async function reconnect(s: McpServer) {
    setServers((cur) => (cur ?? []).map((x) => (x.id === s.id ? { ...x, status: 'connecting' } : x)))
    try {
      await api.reconnectMcp(s.id)
    } finally {
      await load()
    }
  }

  async function remove(s: McpServer) {
    if (!window.confirm(`Remove MCP server "${s.name}"?`)) return
    try {
      await api.deleteMcp(s.id)
      await load()
      if (form?.id === s.id) setForm(null)
    } catch {
      // ignore
    }
  }

  if (!servers) return <div className="setrow-d">Loading…</div>

  return (
    <>
      <div className="setrow-d" style={{ padding: '0 0 8px' }}>
        Connect MCP servers (Burp Suite, filesystem, custom tools…) to expose their tools to every agent. Local
        commands run over stdio; Burp and other network servers connect by URL.
      </div>

      {servers.map((s) => (
        <div className="mcp-row" key={s.id}>
          <span className="mcp-dot" style={{ background: STATUS_COLOR[s.status ?? 'connecting'] ?? 'var(--txt-3)' }} />
          <div className="mcp-info">
            <div className="mcp-name">{s.name}</div>
            <div className="mcp-meta">
              {s.transport === 'stdio' ? `${s.command} ${(s.args ?? []).join(' ')}`.trim() : s.url}
            </div>
            <div className="mcp-status">
              {s.status === 'connected' ? (
                <span style={{ color: 'var(--ok)' }}>connected · {s.toolCount} tool{s.toolCount === 1 ? '' : 's'}</span>
              ) : s.status === 'error' ? (
                <span style={{ color: 'var(--danger)' }} title={s.error}>
                  error: {(s.error ?? '').slice(0, 80)}
                </span>
              ) : (
                <span style={{ color: 'var(--txt-3)' }}>{s.status ?? 'connecting'}</span>
              )}
            </div>
          </div>
          <div className="mcp-actions">
            <Toggle label={s.name} checked={s.enabled} onChange={(on) => toggleEnabled(s, on)} />
            {s.enabled && (
              <button className="mcp-btn" onClick={() => reconnect(s)} title="Reconnect">
                ↻
              </button>
            )}
            <button className="mcp-btn" onClick={() => setForm(toForm(s))} title="Edit">
              ✎
            </button>
            <button className="mcp-btn danger" onClick={() => remove(s)} title="Remove">
              ✕
            </button>
          </div>
        </div>
      ))}

      {form ? (
        <div className="mcp-form">
          <div className="mcp-frow">
            <label className="agm-lab">Name</label>
            <input
              className="agm-input"
              value={form.name}
              placeholder="e.g. Burp Suite"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="mcp-frow">
            <label className="agm-lab">Transport</label>
            <select
              className="agm-input"
              value={form.transport}
              onChange={(e) => setForm({ ...form, transport: e.target.value as Transport })}
            >
              <option value="stdio">stdio — spawn a local command</option>
              <option value="sse">SSE — connect to a URL (e.g. Burp)</option>
              <option value="http">HTTP — streamable HTTP URL</option>
            </select>
          </div>
          {form.transport === 'stdio' ? (
            <>
              <div className="mcp-frow">
                <label className="agm-lab">Command</label>
                <input
                  className="agm-input"
                  value={form.command}
                  placeholder="e.g. npx"
                  onChange={(e) => setForm({ ...form, command: e.target.value })}
                />
              </div>
              <div className="mcp-frow">
                <label className="agm-lab">Arguments (one per line)</label>
                <textarea
                  className="agm-textarea"
                  style={{ minHeight: 80 }}
                  value={form.args}
                  placeholder={'-y\n@modelcontextprotocol/server-filesystem\nC:/path/to/dir'}
                  onChange={(e) => setForm({ ...form, args: e.target.value })}
                />
              </div>
            </>
          ) : (
            <div className="mcp-frow">
              <label className="agm-lab">URL</label>
              <input
                className="agm-input"
                value={form.url}
                placeholder="http://127.0.0.1:9876/sse"
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </div>
          )}
          <div className="mcp-form-actions">
            <button className="agm-cancel" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button className="agm-save" onClick={save} disabled={busy}>
              {busy ? 'Connecting…' : form.id ? 'Save' : 'Add & connect'}
            </button>
          </div>
        </div>
      ) : (
        <button className="mcp-add" onClick={() => setForm({ ...BLANK })}>
          ＋ Add MCP server
        </button>
      )}
    </>
  )
}
