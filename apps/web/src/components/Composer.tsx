import { Dropdown, MenuItem } from './Dropdown'
import { WorkspacePicker } from './WorkspacePicker'
import { ComposerBar } from './ComposerBar'
import { Attachments } from './Attachments'
import { SlashMenu } from './SlashMenu'
import { useComposer } from '../hooks/useComposer'
import { useSlashMenu } from '../hooks/useSlashMenu'
import { useMentionMenu } from '../hooks/useMentionMenu'
import { SLASH_COMMANDS } from '../lib/commands'
import { api } from '../lib/api'
import type { SlashCommand, SettingsTabId } from '../lib/commands'
import type { ModelRef, Agent } from '../lib/api'

interface ComposerProps {
  models: ModelRef[]
  selectedModel: string | null
  onSelectModel: (ref: string) => void
  workspace: string | null
  onSelectWorkspace: (path: string) => void
  onSend: (prompt: string) => void
  permission: string
  onPermission: (id: string) => void
  effort: string
  onEffort: (id: string) => void
  onOpenSettings?: (tab?: SettingsTabId) => void
  agents: Agent[]
  onOpenAgents?: (kind: 'agent' | 'subagent') => void
  onBrowser?: () => void
}

// No session exists yet here, so "new-session" doesn't apply.
const COMMANDS = SLASH_COMMANDS.filter((c) => c.id !== 'new-session')

/** The new-session composer: workspace / agent row, input box, and the shared controls bar. */
export function Composer({
  models,
  selectedModel,
  onSelectModel,
  workspace,
  onSelectWorkspace,
  onSend,
  permission,
  onPermission,
  effort,
  onEffort,
  onOpenSettings,
  agents,
  onOpenAgents,
  onBrowser,
}: ComposerProps) {
  const c = useComposer()
  const slash = useSlashMenu(c.text, COMMANDS)
  const mention = useMentionMenu(c.text, c.setText, agents)
  const canSend = Boolean((c.text.trim() || c.attachments.length) && workspace && selectedModel)
  const topAgents = agents.filter((a) => a.kind === 'agent')

  function submit() {
    if (!canSend) return
    const msg = c.compose()
    if (!msg) return
    onSend(msg)
    c.reset()
  }

  function mentionAgent(a: Agent) {
    c.setText(`@${a.name} ${c.text}`.trimStart())
  }

  async function runCommand(cmd: SlashCommand) {
    c.setText('')
    switch (cmd.id) {
      case 'open-folder': {
        const { path } = await api.pickFolder()
        if (path) onSelectWorkspace(path)
        break
      }
      case 'agents':
        onOpenAgents?.('agent')
        break
      case 'subagents':
        onOpenAgents?.('subagent')
        break
      case 'permission-auto':
        onPermission('auto')
        break
      case 'permission-manual':
        onPermission('manual')
        break
      case 'permission-bypass':
        onPermission('bypass')
        break
      case 'effort-low':
        onEffort('low')
        break
      case 'effort-medium':
        onEffort('medium')
        break
      case 'effort-high':
        onEffort('high')
        break
      case 'effort-extra':
        onEffort('extra')
        break
      case 'settings':
        onOpenSettings?.()
        break
      case 'models':
        onOpenSettings?.('models')
        break
      case 'permissions':
        onOpenSettings?.('permissions')
        break
      case 'import':
        onOpenSettings?.('import')
        break
      case 'developer':
        onOpenSettings?.('developer')
        break
      case 'about':
        onOpenSettings?.('about')
        break
    }
  }

  return (
    <div className="composer">
      <div className="toprow">
        <WorkspacePicker workspace={workspace} onPick={onSelectWorkspace} />
        <Dropdown label={<><span className="lead">⬡</span> Agents <span className="chev">▾</span></>} wide>
          <div className="mlabel">Mention an agent to take over</div>
          {topAgents.map((a) => (
            <MenuItem
              key={a.id}
              title={<>@{a.name} {a.builtin && <span className="badge">built-in</span>}</>}
              desc={a.description}
              onSelect={() => mentionAgent(a)}
            />
          ))}
          <button className="mnote as-button" onClick={() => onOpenAgents?.('agent')}>
            ⚙ Manage agents & subagents
          </button>
        </Dropdown>
      </div>

      <Attachments items={c.attachments} onRemove={c.removeAttachment} />

      <div className="box">
        {slash.open ? (
          <SlashMenu items={slash.items} activeIndex={slash.activeIndex} onHover={slash.setActiveIndex} onSelect={runCommand} />
        ) : mention.open ? (
          <SlashMenu
            items={mention.items}
            activeIndex={mention.activeIndex}
            prefix="@"
            onHover={mention.setActiveIndex}
            onSelect={mention.apply}
          />
        ) : null}
        <textarea
          ref={c.textareaRef}
          className="composer-input"
          rows={1}
          placeholder={
            !workspace
              ? 'Choose a workspace to start'
              : !selectedModel
                ? 'Add a provider in Settings › Models'
                : 'Ask Pentest Mode…  (/ commands · @ agents)'
          }
          value={c.text}
          onChange={(e) => c.setText(e.target.value)}
          onKeyDown={(e) => {
            if (mention.handleKeyDown(e)) return
            if (slash.handleKeyDown(e, runCommand)) return
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <span className="ret" style={{ cursor: canSend ? 'pointer' : 'default' }} onClick={submit}>
          ↵
        </span>
      </div>

      <input ref={c.fileRef} type="file" multiple style={{ display: 'none' }} onChange={c.onFiles} />

      <ComposerBar
        models={models}
        selectedModel={selectedModel}
        onSelectModel={onSelectModel}
        permission={permission}
        onPermission={onPermission}
        effort={effort}
        onEffort={onEffort}
        onAttach={c.triggerAttach}
        onMic={c.toggleMic}
        micActive={c.listening}
        onBrowser={onBrowser}
      />
    </div>
  )
}
