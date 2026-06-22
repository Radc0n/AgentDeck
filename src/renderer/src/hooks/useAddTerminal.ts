import { useCallback, useState } from 'react'
import type { Terminal, TerminalProfile } from '../global'
import { useWorkspaceStore } from '../store/workspace'

export const PROFILE_OPTIONS: { profile: TerminalProfile; label: string }[] = [
  { profile: 'shell', label: 'Terminal' },
  { profile: 'claude', label: 'Claude' },
  { profile: 'cursor', label: 'Cursor' },
  { profile: 'custom', label: 'Özel komut' }
]

function nextTerminalName(profile: TerminalProfile, existing: Terminal[]): string {
  const labels: Record<TerminalProfile, string> = {
    shell: 'Terminal',
    claude: 'Claude',
    cursor: 'Cursor',
    custom: 'Özel'
  }
  const count = existing.filter((terminal) => terminal.profile === profile).length + 1
  return `${labels[profile]} ${count}`
}

interface UseAddTerminalResult {
  canAdd: boolean
  isAdding: boolean
  addTerminalWithProfile: (profile: TerminalProfile) => Promise<void>
}

export function useAddTerminal(): UseAddTerminalResult {
  const activeProject = useWorkspaceStore((state) => state.getActiveProject())
  const addTerminal = useWorkspaceStore((state) => state.addTerminal)
  const [isAdding, setIsAdding] = useState(false)

  const addTerminalWithProfile = useCallback(
    async (profile: TerminalProfile): Promise<void> => {
      if (!activeProject || isAdding) {
        return
      }

      let command: string | undefined
      if (profile === 'custom') {
        const input = window.prompt('Çalıştırılacak özel komut:')
        if (!input?.trim()) {
          return
        }
        command = input.trim()
      }

      setIsAdding(true)

      try {
        const id = crypto.randomUUID()
        const terminal: Terminal = {
          id,
          name: nextTerminalName(profile, activeProject.terminals),
          profile,
          command,
          cwd: activeProject.path,
          order: activeProject.terminals.length
        }

        await window.agentdeck.createTerminal({
          id,
          profile,
          cwd: activeProject.path,
          command
        })

        addTerminal(activeProject.id, terminal)
      } catch (error) {
        console.error('Terminal oluşturulamadı:', error)
      } finally {
        setIsAdding(false)
      }
    },
    [activeProject, addTerminal, isAdding]
  )

  return {
    canAdd: activeProject !== undefined,
    isAdding,
    addTerminalWithProfile
  }
}
