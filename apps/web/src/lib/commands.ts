/** Settings tabs a slash command can jump to (kept here so both App and Composer/ChatView can reference it without a views→components dependency). */
export type SettingsTabId = 'general' | 'models' | 'permissions' | 'import' | 'plugins' | 'developer' | 'about'

export interface SlashCommand {
  id: string
  label: string
  caption: string
}

/** Every "/" command. Composer/ChatView each filter out the ones that don't apply to them. */
export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'open-folder', label: 'open-folder', caption: 'Choose a workspace' },
  { id: 'new-session', label: 'new-session', caption: 'Start a new session' },
  { id: 'agents', label: 'agents', caption: 'Manage agents (@mention to take over)' },
  { id: 'subagents', label: 'subagents', caption: 'Manage delegatable subagents' },
  { id: 'permission-auto', label: 'permission-auto', caption: 'Permission · Auto' },
  { id: 'permission-manual', label: 'permission-manual', caption: 'Permission · Manual' },
  { id: 'permission-bypass', label: 'permission-bypass', caption: 'Permission · Bypass' },
  { id: 'effort-low', label: 'effort-low', caption: 'Reasoning effort · Low' },
  { id: 'effort-medium', label: 'effort-medium', caption: 'Reasoning effort · Medium' },
  { id: 'effort-high', label: 'effort-high', caption: 'Reasoning effort · High' },
  { id: 'effort-extra', label: 'effort-extra', caption: 'Reasoning effort · Extra' },
  { id: 'settings', label: 'settings', caption: 'Open Settings' },
  { id: 'models', label: 'models', caption: 'Settings › Models' },
  { id: 'permissions', label: 'permissions', caption: 'Settings › Permissions' },
  { id: 'import', label: 'import', caption: 'Settings › Import' },
  { id: 'developer', label: 'developer', caption: 'Settings › Developer' },
  { id: 'about', label: 'about', caption: 'Settings › About' },
]

/** Prefix matches first, then substring matches — both case-insensitive. */
export function filterCommands(list: SlashCommand[], query: string): SlashCommand[] {
  const q = query.toLowerCase()
  if (!q) return list
  const starts = list.filter((c) => c.id.startsWith(q))
  const contains = list.filter((c) => !c.id.startsWith(q) && c.id.includes(q))
  return [...starts, ...contains]
}
