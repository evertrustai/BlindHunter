import { useEffect, useState } from 'react'
import { Toggle } from '../components/Toggle'
import { api } from '../lib/api'
import type { PluginTool } from '../lib/api'
import { McpServers } from './McpServers'

export function PluginsPane() {
  const [tools, setTools] = useState<PluginTool[] | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void api
      .getPlugins()
      .then((r) => setTools(r.tools))
      .catch(() => setTools([]))
  }, [])

  async function toggle(name: string, enabled: boolean) {
    const next = (tools ?? []).map((t) => (t.name === name ? { ...t, enabled } : t))
    setTools(next)
    const disabledTools = next.filter((t) => !t.enabled).map((t) => t.name)
    try {
      await api.updateSettings({ disabledTools })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
    } catch {
      // ignore
    }
  }

  if (!tools) return <div className="setrow-d" style={{ padding: '8px 2px' }}>Loading…</div>

  return (
    <>
      <div className="grouphdr">
        Core tools
        {saved && <span className="saved-tag">✓ Saved</span>}
      </div>
      <div className="setrow-d" style={{ padding: '0 0 6px' }}>
        The built-in tools the agent can call. Turn one off to stop the agent from using it in every session.
      </div>
      {tools.map((t) => (
        <div className="setrow" key={t.name}>
          <div>
            <div className="setrow-t" style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>
              {t.name}
            </div>
            <div className="setrow-d">{t.description}</div>
          </div>
          <Toggle label={t.name} checked={t.enabled} onChange={(on) => toggle(t.name, on)} />
        </div>
      ))}

      <div className="grouphdr">Skills</div>
      <div className="setrow-d" style={{ padding: '0 0 6px' }}>
        No skills installed yet. Skill packages will appear here.
      </div>

      <div className="grouphdr">MCP servers</div>
      <McpServers />
    </>
  )
}
