export interface ProviderModel {
  id: string
  name?: string
  contextWindow?: number
}

export type ProviderProtocol = 'openai-chat'

export interface Provider {
  id: string
  displayName: string
  baseUrl: string
  protocol: ProviderProtocol
  defaultContext?: number
  headers?: Record<string, string>
  models: ProviderModel[]
  enabled: boolean
}

export type AgentEnvironment = 'windows' | 'wsl'
export type TerminalShell = 'powershell' | 'gitbash' | 'wsl'

export type PermissionMode = 'auto' | 'manual' | 'bypass'

export interface Settings {
  theme: 'dark' | 'light'
  language: string
  agentEnvironment: AgentEnvironment
  terminalShell: TerminalShell
  /** Default permission mode for new sessions (composer picker overrides per session). */
  defaultPermission: PermissionMode
  /** Keep imported content in sync automatically. */
  importAutosync: boolean
  /** Server/agent log verbosity. */
  logLevel: 'info' | 'debug' | 'trace'
  /** Enable in-progress capabilities. */
  experimental: boolean
  /** Let the in-app browser accept invalid/self-signed TLS certs (for proxy interception). Off by default. */
  browserInsecureCerts?: boolean
  /** Names of built-in tools the agent is NOT allowed to use. */
  disabledTools: string[]
  /** "providerId/modelId" */
  defaultModel?: string
  providers: Provider[]
}

/** providerId -> API key. Stored separately from settings, owner-only. */
export type Credentials = Record<string, string>
