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
  let resolved: ShellKind = kind ?? (isWin ? 'pwsh' : 'bash')
  // On a non-Windows host the Windows-only shells aren't available. Fall back to bash
  // so a fresh Linux/Kali install runs commands even with the default Windows settings. (QA-28)
  if (!isWin && (resolved === 'pwsh' || resolved === 'cmd' || resolved === 'gitbash' || resolved === 'wsl')) {
    resolved = 'bash'
  }
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

/** Cap accumulated stdout/stderr so a noisy command can't exhaust memory. (QA-32) */
const MAX_SHELL_OUTPUT = 200_000

/**
 * Run a shell command in a working directory. Never rejects — errors come back as code 1.
 * If `signal` aborts (the user pressed Stop), the whole child process tree is killed and
 * the command returns promptly with code 130. (QA-05)
 */
export function runShell(command: string, cwd: string, kind?: ShellKind, signal?: AbortSignal): Promise<ShellResult> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ stdout: '', stderr: '[cancelled]', code: 130 })
      return
    }
    const shell = pickShell(kind)
    // Give the child its own process group on POSIX so we can kill the whole tree.
    const detached = process.platform !== 'win32'
    const child = spawn(shell.cmd, shell.args(command), { cwd, env: process.env, detached })
    let stdout = ''
    let stderr = ''
    let killed = false
    const append = (cur: string, d: Buffer) =>
      cur.length >= MAX_SHELL_OUTPUT ? cur : (cur + d.toString()).slice(0, MAX_SHELL_OUTPUT)
    child.stdout.on('data', (d: Buffer) => (stdout = append(stdout, d)))
    child.stderr.on('data', (d: Buffer) => (stderr = append(stderr, d)))

    const killTree = () => {
      killed = true
      const pid = child.pid
      if (pid == null) return
      if (process.platform === 'win32') {
        // Kill the process and all its children (shells spawn child commands).
        try {
          spawn('taskkill', ['/pid', String(pid), '/T', '/F'])
        } catch {
          try {
            child.kill()
          } catch {
            /* already gone */
          }
        }
      } else {
        try {
          process.kill(-pid, 'SIGKILL') // negative pid = the whole process group
        } catch {
          try {
            child.kill('SIGKILL')
          } catch {
            /* already gone */
          }
        }
      }
    }
    const onAbort = () => killTree()
    signal?.addEventListener('abort', onAbort, { once: true })
    const finish = (res: ShellResult) => {
      signal?.removeEventListener('abort', onAbort)
      resolve(res)
    }
    child.on('close', (code) =>
      finish({
        stdout,
        stderr: killed ? `${stderr}${stderr ? '\n' : ''}[cancelled by user]` : stderr,
        code: killed ? 130 : (code ?? 0),
      }),
    )
    child.on('error', (err) => finish({ stdout, stderr: String(err), code: 1 }))
  })
}
