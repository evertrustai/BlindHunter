import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

export interface ShellResult {
  stdout: string
  stderr: string
  code: number
}

export type ShellKind = 'bash' | 'pwsh' | 'cmd' | 'gitbash' | 'wsl'

/** Map the General-settings agent environment + shell to a concrete shell kind. */
export function resolveShellKind(agentEnvironment?: string, terminalShell?: string): ShellKind {
  if (agentEnvironment === 'wsl') return 'wsl'
  switch (terminalShell) {
    case 'gitbash':
      return 'gitbash'
    case 'wsl':
      return 'wsl'
    case 'powershell':
    default:
      return 'pwsh'
  }
}

/** Locate Git-for-Windows bash.exe, falling back to PATH `bash`. */
function gitBashPath(): string {
  const pf = process.env.ProgramFiles ?? 'C:\\Program Files'
  const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const candidates = [`${pf}\\Git\\bin\\bash.exe`, `${pf}\\Git\\usr\\bin\\bash.exe`, `${pf86}\\Git\\bin\\bash.exe`]
  return candidates.find((p) => existsSync(p)) ?? 'bash'
}

function pickShell(kind?: ShellKind): { cmd: string; args: (command: string) => string[] } {
  const isWin = process.platform === 'win32'
  const resolved: ShellKind = kind ?? (isWin ? 'pwsh' : 'bash')
  switch (resolved) {
    case 'pwsh':
      return { cmd: isWin ? 'powershell.exe' : 'pwsh', args: (c) => ['-NoProfile', '-Command', c] }
    case 'cmd':
      return { cmd: 'cmd.exe', args: (c) => ['/c', c] }
    case 'gitbash':
      return { cmd: gitBashPath(), args: (c) => ['-lc', c] }
    case 'wsl':
      // wsl.exe starts in the mapped /mnt path of the spawn cwd on modern WSL.
      return { cmd: 'wsl.exe', args: (c) => ['bash', '-lc', c] }
    case 'bash':
    default:
      return { cmd: 'bash', args: (c) => ['-lc', c] }
  }
}

/** Run a shell command in a working directory. Never rejects — errors come back as code 1. */
export function runShell(command: string, cwd: string, kind?: ShellKind): Promise<ShellResult> {
  return new Promise((resolve) => {
    const shell = pickShell(kind)
    const child = spawn(shell.cmd, shell.args(command), { cwd, env: process.env })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()))
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 0 }))
    child.on('error', (err) => resolve({ stdout, stderr: String(err), code: 1 }))
  })
}
