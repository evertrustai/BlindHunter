import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Provider } from '../lib/api'

type Sub = 'main' | 'catalog' | 'custom'

interface Preset {
  ic: string
  name: string
  d: string
  baseUrl: string
  protocol: string
  tag?: 'recommended' | 'local'
}

const CATALOG: Preset[] = [
  { ic: 'AI', name: 'OpenAI', d: 'GPT models · OpenAI-compatible', baseUrl: 'https://api.openai.com/v1', protocol: 'openai-chat' },
  { ic: 'OR', name: 'OpenRouter', d: 'One key, hundreds of models', baseUrl: 'https://openrouter.ai/api/v1', protocol: 'openai-chat', tag: 'recommended' },
  { ic: 'DS', name: 'DeepSeek', d: 'DeepSeek models · OpenAI-compatible', baseUrl: 'https://api.deepseek.com/v1', protocol: 'openai-chat' },
  { ic: 'GQ', name: 'Groq', d: 'Fast inference · OpenAI-compatible', baseUrl: 'https://api.groq.com/openai/v1', protocol: 'openai-chat' },
  { ic: 'OL', name: 'Ollama', d: 'Run models fully offline · localhost', baseUrl: 'http://localhost:11434/v1', protocol: 'openai-chat', tag: 'local' },
  { ic: 'LM', name: 'LM Studio', d: 'Local models on your machine', baseUrl: 'http://localhost:1234/v1', protocol: 'openai-chat', tag: 'local' },
]

function parseCtx(s: string): number | undefined {
  const m = s.trim().toUpperCase()
  if (!m) return undefined
  if (m.endsWith('M')) return Math.round(parseFloat(m) * 1_000_000)
  if (m.endsWith('K')) return Math.round(parseFloat(m) * 1_000)
  const n = Number(m)
  return Number.isNaN(n) ? undefined : n
}

function fmtCtx(n?: number): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${n / 1_000_000}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(n)
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '')

export function ModelsPane() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [sub, setSub] = useState<Sub>('main')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // custom-provider form state
  const [id, setId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [protocol, setProtocol] = useState('openai-chat')
  const [defaultContext, setDefaultContext] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<{ id: string; name: string }[]>([{ id: '', name: '' }])
  const [headers, setHeaders] = useState<{ name: string; value: string }[]>([{ name: '', value: '' }])
  const [editing, setEditing] = useState(false)
  const [fetched, setFetched] = useState<{ id: string; grade?: string; vision?: boolean }[]>([])
  const [fetching, setFetching] = useState(false)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

  async function reload() {
    try {
      setProviders(await api.getProviders())
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }
  useEffect(() => {
    void reload()
  }, [])

  function resetFetched() {
    setFetched([])
    setFetchErr(null)
    setFetching(false)
  }

  async function fetchModels() {
    if (!baseUrl.trim()) {
      setFetchErr('Enter a Base URL first.')
      return
    }
    setFetchErr(null)
    setFetching(true)
    try {
      const res = await api.fetchProviderModels({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim() || undefined,
        providerId: editing ? id : undefined,
      })
      if (res.error) setFetchErr(res.error)
      else setFetched(res.models ?? [])
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : String(e))
    } finally {
      setFetching(false)
    }
  }

  function addFetchedModel(mid: string) {
    setModels((prev) => {
      const kept = prev.filter((m) => m.id.trim())
      if (kept.some((m) => m.id === mid)) return prev
      return [...kept, { id: mid, name: mid }]
    })
  }

  function addAllFetched() {
    setModels((prev) => {
      const kept = prev.filter((m) => m.id.trim())
      const have = new Set(kept.map((m) => m.id))
      return [...kept, ...fetched.filter((f) => !have.has(f.id)).map((f) => ({ id: f.id, name: f.id }))]
    })
  }

  function openCustom(preset?: Preset) {
    setErr(null)
    resetFetched()
    setEditing(false)
    setId(preset ? slug(preset.name) : '')
    setDisplayName(preset?.name ?? '')
    setBaseUrl(preset?.baseUrl ?? '')
    setProtocol(preset?.protocol ?? 'openai-chat')
    setDefaultContext('')
    setApiKey('')
    setModels([{ id: '', name: '' }])
    setHeaders([{ name: '', value: '' }])
    setSub('custom')
  }

  async function save() {
    setErr(null)
    if (!id.trim() || !baseUrl.trim()) {
      setErr('Provider ID and Base URL are required.')
      return
    }
    setSaving(true)
    try {
      const headerObj: Record<string, string> = {}
      for (const h of headers) if (h.name.trim()) headerObj[h.name.trim()] = h.value
      await api.addProvider({
        id: slug(id),
        displayName: displayName.trim() || id,
        baseUrl: baseUrl.trim(),
        protocol,
        defaultContext: parseCtx(defaultContext),
        enabled: true,
        models: models.filter((m) => m.id.trim()).map((m) => ({ id: m.id.trim(), name: m.name.trim() || m.id.trim() })),
        headers: Object.keys(headerObj).length ? headerObj : undefined,
        apiKey: apiKey.trim() || undefined,
      })
      await reload()
      setSub('main')
      setEditing(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  function startEdit(p: Provider) {
    setErr(null)
    resetFetched()
    setEditing(true)
    setId(p.id)
    setDisplayName(p.displayName)
    setBaseUrl(p.baseUrl)
    setProtocol(p.protocol)
    setDefaultContext(p.defaultContext ? fmtCtx(p.defaultContext) : '')
    setApiKey('')
    setModels(p.models.length ? p.models.map((m) => ({ id: m.id, name: m.name ?? m.id })) : [{ id: '', name: '' }])
    setHeaders(
      p.headers && Object.keys(p.headers).length
        ? Object.entries(p.headers).map(([name, value]) => ({ name, value }))
        : [{ name: '', value: '' }],
    )
    setSub('custom')
  }

  async function toggleEnabled(p: Provider) {
    await api.addProvider({
      id: p.id,
      displayName: p.displayName,
      baseUrl: p.baseUrl,
      protocol: p.protocol,
      defaultContext: p.defaultContext,
      headers: p.headers,
      models: p.models,
      enabled: !p.enabled,
    })
    await reload()
  }

  async function disconnect(pid: string) {
    await api.deleteProvider(pid)
    await reload()
  }

  if (sub === 'catalog') {
    return (
      <div className="msub">
        <div className="formhead">
          <button className="backbtn" onClick={() => setSub('main')}>←</button>
          <div className="formtitle">Add provider</div>
        </div>
        <div className="grouphdr">Popular providers</div>
        {CATALOG.map((c) => (
          <div className="cat-row" key={c.name}>
            <span className="cat-ic">{c.ic}</span>
            <div className="cat-body">
              <div className="cat-nm">
                {c.name} {c.tag && <span className={c.tag === 'local' ? 'tag local' : 'tag'}>{c.tag}</span>}
              </div>
              <div className="cat-d">{c.d}</div>
            </div>
            <button className="cat-connect" onClick={() => openCustom(c)}>Connect</button>
          </div>
        ))}
        <div className="cat-row">
          <span className="cat-ic">✧</span>
          <div className="cat-body">
            <div className="cat-nm">Custom provider <span className="tag">custom</span></div>
            <div className="cat-d">Any OpenAI-compatible endpoint by base URL</div>
          </div>
          <button className="cat-connect" onClick={() => openCustom()}>Connect</button>
        </div>
      </div>
    )
  }

  if (sub === 'custom') {
    return (
      <div className="msub">
        <div className="formhead">
          <button className="backbtn" onClick={() => setSub('main')}>←</button>
          <div className="formtitle">{editing ? 'Edit provider' : 'Add provider'}</div>
        </div>
        <div className="field">
          <label>Provider ID</label>
          <input className="inp mono" placeholder="myprovider" value={id} readOnly={editing} onChange={(e) => setId(e.target.value)} />
          <div className="hint">{editing ? 'The identifier cannot be changed.' : 'Lowercase letters, numbers, hyphens, or underscores. Used in requests and as the credential name.'}</div>
        </div>
        <div className="field">
          <label>Display name</label>
          <input className="inp" placeholder="My AI Provider" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="field">
          <label>Base URL</label>
          <input className="inp mono" placeholder="https://api.myprovider.com/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </div>
        <div className="row2">
          <div className="field">
            <label>API protocol</label>
            <select className="inp" value={protocol} onChange={(e) => setProtocol(e.target.value)}>
              <option value="openai-chat">OpenAI Chat Completions (/chat/completions)</option>
            </select>
          </div>
          <div className="field">
            <label>Default context window</label>
            <input className="inp mono" placeholder="200K" value={defaultContext} onChange={(e) => setDefaultContext(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>API key</label>
          <input
            className="inp mono"
            type="password"
            placeholder={editing ? 'Leave blank to keep current key' : 'API key'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <div className="hint">
            {editing ? 'Leave blank to keep the current key.' : 'Optional. Leave empty if you manage auth via headers.'}
          </div>
        </div>

        <div className="grouphdr">Models</div>
        {models.map((m, i) => (
          <div className="addrow" key={i}>
            <input className="inp mono" placeholder="model-id" value={m.id} onChange={(e) => setModels((a) => a.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))} />
            <input className="inp" placeholder="Display name" value={m.name} onChange={(e) => setModels((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <button className="rmrow" aria-label="Remove model" onClick={() => setModels((a) => (a.length > 1 ? a.filter((_, j) => j !== i) : a))}>✕</button>
          </div>
        ))}
        <div className="minirow">
          <button className="minibtn" onClick={() => setModels((a) => [...a, { id: '', name: '' }])}>＋ Add model</button>
          <button className="minibtn" onClick={fetchModels} disabled={fetching}>
            {fetching ? 'Fetching…' : 'Fetch available models'}
          </button>
        </div>
        {fetchErr && <div className="setrow-d" style={{ color: 'var(--danger)', paddingTop: 8 }}>{fetchErr}</div>}
        {fetched.length > 0 && (
          <>
            <div className="minirow" style={{ marginTop: 10, alignItems: 'center' }}>
              <span className="setrow-d" style={{ margin: 0 }}>{fetched.length} models available — click to add</span>
              <button className="minibtn" onClick={addAllFetched}>Add all</button>
            </div>
            <div className="fetched-wrap">
              {fetched.map((f) => {
                const added = models.some((m) => m.id === f.id)
                return (
                  <button
                    key={f.id}
                    className={added ? 'fchip added' : 'fchip'}
                    onClick={() => !added && addFetchedModel(f.id)}
                    title={f.vision ? 'text + vision' : 'text'}
                  >
                    {added ? '✔' : '＋'} {f.id}
                    {f.grade && <span className="g">{f.grade}</span>}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div className="grouphdr">Headers (optional)</div>
        {headers.map((h, i) => (
          <div className="addrow" key={i}>
            <input className="inp mono" placeholder="Header-Name" value={h.name} onChange={(e) => setHeaders((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input className="inp mono" placeholder="value" value={h.value} onChange={(e) => setHeaders((a) => a.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            <button className="rmrow" aria-label="Remove header" onClick={() => setHeaders((a) => (a.length > 1 ? a.filter((_, j) => j !== i) : a))}>✕</button>
          </div>
        ))}
        <div className="minirow">
          <button className="minibtn" onClick={() => setHeaders((a) => [...a, { name: '', value: '' }])}>＋ Add header</button>
        </div>

        {err && <div className="setrow-d" style={{ color: 'var(--danger)', paddingTop: 12 }}>{err}</div>}
        <div className="formactions">
          <button className="btn-ghost" onClick={() => setSub('main')}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add provider'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="msub">
      <div className="grouphdr">Connected providers</div>
      {err && <div className="setrow-d" style={{ color: 'var(--danger)' }}>{err}</div>}
      {providers.length === 0 && <div className="stub">No providers yet. Add one to start using models.</div>}
      {providers.map((p) => (
        <div className="prov-card" key={p.id} style={p.enabled ? undefined : { opacity: 0.6 }}>
          <div className="prov-top">
            <div className="prov-name">
              <span className="prov-dot" style={{ background: p.enabled ? 'var(--ok)' : 'var(--txt-3)' }} /> {p.displayName}
            </div>
            <div className="prov-actions-r">
              <button className="prov-lnk" onClick={() => startEdit(p)}>Edit</button>
              <button
                className={p.enabled ? 'tgl on' : 'tgl'}
                role="switch"
                aria-checked={p.enabled}
                aria-label={p.enabled ? 'Disable provider' : 'Enable provider'}
                onClick={() => toggleEnabled(p)}
              />
              <button className="prov-lnk danger" onClick={() => disconnect(p.id)}>Delete</button>
            </div>
          </div>
          <div className="prov-grid">
            <div className="prov-field"><div className="k">Base URL</div><div className="v">{p.baseUrl}</div></div>
            <div className="prov-field"><div className="k">API protocol</div><div className="v">{p.protocol}</div></div>
            <div className="prov-field"><div className="k">API key</div><div className="v">{p.hasKey ? '•••• configured' : 'not set'}</div></div>
            <div className="prov-field"><div className="k">Default context</div><div className="v">{fmtCtx(p.defaultContext)}</div></div>
          </div>
          {p.models.length > 0 && (
            <div className="prov-models">
              {p.models.map((m) => (
                <span className="mchip" key={m.id}>
                  {m.id} <span className="ctx">{fmtCtx(m.contextWindow ?? p.defaultContext)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="prov-add-row">
        <button className="prov-add" onClick={() => setSub('catalog')}>＋ Add provider</button>
        <button className="prov-add" onClick={() => openCustom()}>＋ Add a custom provider</button>
      </div>
    </div>
  )
}
