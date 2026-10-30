import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { SlashCommand } from '../lib/commands'

/**
 * The installed skills as "/" commands, so they show up in the composer's slash menu for
 * discovery + manual invocation. Fetched once and cached across components.
 */
let cache: SlashCommand[] | null = null

export function useSkillCommands(): SlashCommand[] {
  const [cmds, setCmds] = useState<SlashCommand[]>(cache ?? [])
  useEffect(() => {
    if (cache) return
    void api
      .getSkills()
      .then((skills) => {
        cache = skills.map((s) => ({ id: s.command, label: s.command, caption: s.description, kind: 'skill' as const }))
        setCmds(cache)
      })
      .catch(() => {
        /* no skills endpoint / none installed */
      })
  }, [])
  return cmds
}
