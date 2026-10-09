import { Composer } from '../components/Composer'
import type { ModelRef, Agent } from '../lib/api'
import type { SettingsTabId } from '../lib/commands'

interface ConsoleViewProps {
  models: ModelRef[]
  selectedModel: string | null
  onSelectModel: (ref: string) => void
  workspace: string | null
  onSelectWorkspace: (path: string) => void
  onSend: (prompt: string, images?: string[]) => void
  permission: string
  onPermission: (id: string) => void
  effort: string
  onEffort: (id: string) => void
  onOpenSettings?: (tab?: SettingsTabId) => void
  agents: Agent[]
  onOpenAgents?: (kind: 'agent' | 'subagent') => void
  onBrowser?: () => void
}

/** The empty "new session" landing screen. */
export function ConsoleView(props: ConsoleViewProps) {
  return (
    <div className="view-console">
      <div className="hero">
        <div className="wm">
          <span className="hl">B</span>LIND<span className="hl">H</span>UNTER
        </div>
        <div className="sub">privacy-first offensive-security agent</div>
      </div>
      <Composer {...props} />
    </div>
  )
}
