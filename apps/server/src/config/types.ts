export interface ProviderModel {
  id: string
  name?: string
  contextWindow?: number
}

export type ProviderProtocol = 'openai-chat' | 'anthropic' | 'codex'

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
  /**
   * Max think→act→observe rounds the top-level agent may run for one task before it
   * stops itself — a runaway guard, not a target. The model normally finishes well
   * before this; raise it for very long autonomous hunts. Default 120.
   */
  maxSteps?: number
  /** "providerId/modelId" */
  defaultModel?: string
  providers: Provider[]
  /** Telegram bot integration (the bot TOKEN lives in the credentials vault, not here). */
  telegram?: TelegramConfig
}

export interface TelegramConfig {
  enabled: boolean
  /** Telegram user id bound as the sole owner once paired. */
  ownerId?: number
  /** One-time code the owner sends to the bot to claim it (cleared after pairing). */
  pairingCode?: string
  /** The connected bot's @username (from getMe), for display. */
  botUsername?: string
  /** "providerId/modelId" used for Telegram-driven runs. */
  defaultModel?: string
  /** Workspace folder Telegram-driven runs operate in. */
  defaultWorkspace?: string
  /**
   * Speech-to-text for voice messages. Speaks the OpenAI /audio/transcriptions API, so it
   * works against a LOCAL whisper server (e.g. faster-whisper/Speaches — fully offline) or a
   * cloud one. The API key (if any) lives in the credentials vault under `telegram_stt`.
   */
  transcription?: {
    /** Base URL ending before /audio/transcriptions, e.g. http://localhost:8000/v1 */
    baseUrl?: string
    /** Transcription model id, e.g. whisper-1 / whisper-large-v3 / Systran/faster-whisper-small */
    model?: string
  }
}

/** providerId -> API key. Stored separately from settings, owner-only. */
export type Credentials = Record<string, string>
