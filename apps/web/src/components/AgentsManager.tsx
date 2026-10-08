import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Agent } from '../lib/api'
import { ConfirmModal } from './Modal'

type Kind = 'agent' | 'subagent'

interface Form {
  id?: string
  name: string
  description: string
  systemPrompt: string
  kind: Kind
  builtin?: boolean
}

const BLANK = (kind: Kind): Form => ({ name: '', description: '', systemPrompt: '', kind })

export function AgentsManager({ initialKind, onClose }: { initialKind: Kind; onClose: () => void }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [kind, setKind] = useState<Kind>(initialKind)
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState<Agent | null>(null)

  async function load() {
    try {
      setAgents(await api.getAgents())
    } catch {
      // ignore
    }
  }
  useEffect(() => {
    void load()
  }, [])

  // Escape closes the manager.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmDel) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, confirmDel])

  const list = agents.filter((a) => a.kind === kind)
  const canSave = Boolean(form && !form.builtin && form.name.trim() && form.systemPrompt.trim())

  function selectAgent(a: Agent) {
    setForm({
      id: a.id,
      name: a.name,
      description: a.description,
      systemPrompt: a.systemPrompt,
      kind: a.kind,
      builtin: a.builtin,
    })
  }

  async function save() {
    if (!form || !canSave) return
    setSaving(true)
    try {
      const saved = form.id
        ? await api.updateAgent(form.id, {
            name: form.name,
            description: form.description,
            systemPrompt: form.systemPrompt,
            kind: form.kind,
          })
        : await api.createAgent({
            name: form.name,
            description: form.description,
            systemPrompt: form.systemPrompt,
            kind: form.kind,
          })
      await load()
      setKind(saved.kind)
      selectAgent(saved)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  async function doDelete(a: Agent) {
    setConfirmDel(null)
    try {
      await api.deleteAgent(a.id)
      await load()
      if (form?.id === a.id) setForm(null)
    } catch {
      // ignore
    }
  }

  return (
    <div className="agm-overlay">
      <div className="agm">
        <div className="agm-head">
          <div className="agm-title">Agents</div>
          <div className="agm-tabs">
            <button className={kind === 'agent' ? 'agm-tab active' : 'agm-tab'} onClick={() => setKind('agent')}>
              Agents
            </button>
            <button className={kind === 'subagent' ? 'agm-tab active' : 'agm-tab'} onClick={() => setKind('subagent')}>
              Subagents
            </button>
          </div>
          <button className="set-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="agm-explain">
          {kind === 'agent' ? (
            <>
              An <b>agent</b> is a persona with its own system prompt. Type <code>@name</code> in the chat to hand the
              whole session over to it — it then drives every reply until you switch.
            </>
          ) : (
            <>
              A <b>subagent</b> is a specialist your active agent can delegate a focused sub-task to (via the
              <code> spawn_subagent</code> tool). It works on its own and reports back.
            </>
          )}
        </div>

        <div className="agm-body">
          <div className="agm-list">
            <button className="agm-new" onClick={() => setForm(BLANK(kind))}>
              ＋ New {kind === 'agent' ? 'agent' : 'subagent'}
            </button>
            {list.length === 0 && <div className="agm-empty">No {kind}s yet.</div>}
            {list.map((a) => (
              <button
                key={a.id}
                className={form?.id === a.id ? 'agm-item active' : 'agm-item'}
                onClick={() => selectAgent(a)}
              >
                <span className="agm-handle">@{a.name}</span>
                {a.builtin && <span className="agm-badge">built-in</span>}
                <span className="agm-desc">{a.description}</span>
              </button>
            ))}
          </div>

          <div className="agm-detail">
            {!form ? (
              <div className="agm-placeholder">
                Select {kind === 'agent' ? 'an agent' : 'a subagent'}, or create a new one.
              </div>
            ) : (
              <>
                {form.builtin && <div className="agm-note">This is the built-in default — read-only.</div>}
                <label className="agm-field">
                  <span className="agm-lab">Name (the @handle)</span>
                  <input
                    className="agm-input"
                    value={form.name}
                    disabled={form.builtin}
                    placeholder="e.g. recon"
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  <span className="agm-hint">Lowercased into a handle — mention it as @{form.name || 'name'}.</span>
                </label>
                <label className="agm-field">
                  <span className="agm-lab">Description</span>
                  <input
                    className="agm-input"
                    value={form.description}
                    disabled={form.builtin}
                    placeholder="One line — what this agent is for"
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </label>
                <label className="agm-field">
                  <span className="agm-lab">Type</span>
                  <select
                    className="agm-input"
                    value={form.kind}
                    disabled={form.builtin}
                    onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}
                  >
                    <option value="agent">Agent — @mentionable, takes over the session</option>
                    <option value="subagent">Subagent — delegated to for sub-tasks</option>
                  </select>
                </label>
                <label className="agm-field grow">
                  <span className="agm-lab">System prompt</span>
                  <textarea
                    className="agm-textarea"
                    value={form.systemPrompt}
                    disabled={form.builtin}
                    placeholder="Describe the agent's role, expertise, methodology, and constraints…"
                    onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                  />
                  <span className="agm-hint">
                    This is exactly how the agent works — it's prepended to every turn as the system prompt.
                  </span>
                </label>

                {!form.builtin && (
                  <div className="agm-actions">
                    {form.id && (
                      <button
                        className="agm-del"
                        onClick={() => {
                          const a = agents.find((x) => x.id === form.id)
                          if (a) setConfirmDel(a)
                        }}
                      >
                        Delete
                      </button>
                    )}
                    <div className="agm-spacer" />
                    <button className="agm-cancel" onClick={() => setForm(null)}>
                      Cancel
                    </button>
                    <button className="agm-save" onClick={save} disabled={!canSave || saving}>
                      {saving ? 'Saving…' : form.id ? 'Save' : 'Create'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {confirmDel && (
        <ConfirmModal
          title={`Delete @${confirmDel.name}?`}
          message="This agent and its system prompt will be removed. Sessions that used it fall back to the default."
          confirmLabel="Delete"
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => doDelete(confirmDel)}
        />
      )}
    </div>
  )
}
