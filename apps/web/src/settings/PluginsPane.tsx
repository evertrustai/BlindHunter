import { useEffect, useState } from 'react'
import { Toggle } from '../components/Toggle'
import { api } from '../lib/api'
import type { PluginTool } from '../lib/api'
import { McpServers } from './McpServers'

export function PluginsPane() {
  const [tools, setTools] = useState<PluginTool[] | null>(null)
  const [saved, setSaved] = useState(false)
  const [skills, setSkills] = useState<{ command: string; name: string; description: string }[]>([])
  const [skillQuery, setSkillQuery] = useState('')

  useEffect(() => {
    void api
      .getPlugins()
      .then((r) => setTools(r.tools))
      .catch(() => setTools([]))
    void api
      .getSkills()
      .then(setSkills)
      .catch(() => setSkills([]))
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

      <div className="grouphdr">
        Skills
        {skills.length > 0 && <span className="saved-tag">{skills.length} installed</span>}
      </div>
      <div className="setrow-d" style={{ padding: '0 0 6px' }}>
        {skills.length
          ? 'Pre-installed offensive-security playbooks. The agent loads one when a task matches its /command (or you can invoke it yourself).'
          : 'No skills found. The bundled /skills library should load automatically.'}
      </div>
      {skills.length > 0 && (
        <>
          <input
            className="ctl"
            style={{ width: '100%', marginBottom: 8 }}
            placeholder={`Search ${skills.length} skills…`}
            value={skillQuery}
            onChange={(e) => setSkillQuery(e.target.value)}
          />
          <div className="skill-list">
            {skills
              .filter((s) => {
                const q = skillQuery.trim().toLowerCase()
                return !q || s.command.includes(q) || s.description.toLowerCase().includes(q)
              })
              .slice(0, 300)
              .map((s) => (
                <div className="skill-row" key={s.command}>
                  <code className="skill-cmd">/{s.command}</code>
                  <span className="skill-desc">{s.description}</span>
                </div>
              ))}
          </div>
        </>
      )}

      <div className="grouphdr">MCP servers</div>
      <McpServers />
    </>
  )
}
