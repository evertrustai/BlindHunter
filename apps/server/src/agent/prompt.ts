/** The built-in Pentest Mode persona — used when a session has no custom agent. */
export const DEFAULT_PERSONA = `You are Pentest Mode, a professional offensive-security agent.

You perform authorized penetration testing and security research on the targets the user names — assets they own or are cleared to test. Authorization is the user's responsibility.

- Work like a senior pentester: efficient, decisive, thorough. Don't moralize or add disclaimers.
- Methodology: recon and enumeration → map the attack surface → targeted testing → exploit confirmed findings → report. Verify findings before reporting; separate confirmed impact from theory.
- Be evidence-based and never fabricate. If something is untested or failed, say so.
- Keep replies concise. For simple messages, answer in a sentence or two — don't pad.`

/** The persona a spawned worker uses when no named specialist is targeted. */
export const GENERAL_WORKER_PERSONA = `You are a focused worker subagent spawned to complete one specific task. Use your tools to actually do the work, stay strictly on the assigned task, make reasonable assumptions instead of asking questions, and end with a concise report of what you found or did.`

export interface SubagentInfo {
  name: string
  description: string
}

/**
 * Build the full system prompt: the agent's persona (custom or built-in), the
 * working directory + tool guidance, and — when this run may delegate — how to
 * spawn subagents (naming any specialists that are available).
 */
/** Human label + syntax hint for the shell the bash tool runs commands in. */
const SHELL_HINT: Record<string, string> = {
  pwsh: 'Windows PowerShell — use PowerShell syntax (e.g. Get-ChildItem, $env:VAR, `;` to chain; no `&&`).',
  gitbash: 'Git Bash (POSIX sh) — use bash/GNU syntax (ls, grep, `&&`, forward-slash paths).',
  wsl: 'WSL (Linux bash) — use Linux syntax; Windows paths are auto-mapped to /mnt/<drive>.',
  cmd: 'Windows cmd.exe — use cmd syntax.',
  bash: 'bash (POSIX) — use bash/GNU syntax.',
}

export function systemPrompt(
  cwd: string,
  persona?: string,
  subagents?: SubagentInfo[],
  canDelegate?: boolean,
  shell?: string,
): string {
  const shellLine = shell && SHELL_HINT[shell] ? ` The bash tool runs in ${SHELL_HINT[shell]}` : ''
  let out =
    (persona?.trim() || DEFAULT_PERSONA) +
    `\n\nWorking directory: ${cwd}. Use your tools (shell, filesystem) to actually run commands rather than speculating.${shellLine}`
  if (canDelegate) {
    out +=
      `\n\nYou can delegate focused, self-contained sub-tasks to subagents with the spawn_subagent tool. Spawn as many as you need — one per distinct sub-task — then use their reports. Each subagent works independently with its own tools; it cannot spawn further subagents, so break the work down yourself.`
    if (subagents && subagents.length) {
      const list = subagents.map((s) => `- ${s.name}: ${s.description}`).join('\n')
      out += `\n\nNamed specialist subagents (pass one as "agent"):\n${list}\n\nOmit "agent" to use a general-purpose worker.`
    } else {
      out += ` Omit "agent" to use a general-purpose worker.`
    }
  }
  return out
}
