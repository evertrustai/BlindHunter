import { spawn as ptySpawn, type IPty } from 'node-pty'
import { homedir } from 'node:os'
import { existsSync, statSync } from 'node:fs'
import { gitBashPath, type ShellKind } from '../tools/shell.js'

/**
 * Interactive terminal shells. Unlike tools/shell.ts (which wraps a one-shot command in
 * `-Command`/`-lc`), a PTY drops the user straight into an interactive REPL, so we spawn
 * the bare shell with only the flags needed to get a clean interactive prompt.
 */
function interactiveShell(kind: ShellKind): { file: string; args: string[] } {
  const isWin = process.platform === 'win32'
  let resolved: ShellKind = kind
  // The Windows-only shells don't exist off Windows — fall back to bash. (mirrors shell.ts)
  if (!isWin && (resolved === 'pwsh' || resolved === 'cmd' || resolved === 'gitbash' || resolved === 'wsl')) {
    resolved = 'bash'
  }
  switch (resolved) {
    case 'pwsh':
      return { file: isWin ? 'powershell.exe' : 'pwsh', args: isWin ? ['-NoLogo'] : [] }
    case 'cmd':
      return { file: 'cmd.exe', args: [] }
    case 'gitbash':
      return { file: gitBashPath(), args: ['-i', '-l'] }
    case 'wsl':
      return { file: 'wsl.exe', args: [] }
    case 'bash':
    default:
      return { file: 'bash', args: ['-i', '-l'] }
  }
}

/** The requested directory if it's a real directory, otherwise the user's home. */
export function safeCwd(cwd?: string): string {
  try {
    if (cwd && existsSync(cwd) && statSync(cwd).isDirectory()) return cwd
  } catch {
    /* fall through to home */
  }
  return homedir()
}

/** Spawn an interactive PTY shell for the given shell kind, directory, and size. */
export function spawnTerminal(kind: ShellKind, cwd: string, cols: number, rows: number): IPty {
  const { file, args } = interactiveShell(kind)
  return ptySpawn(file, args, {
    name: 'xterm-color',
    cols: Math.max(1, cols || 80),
    rows: Math.max(1, rows || 24),
    cwd: safeCwd(cwd),
    env: process.env as Record<string, string>,
  })
}
