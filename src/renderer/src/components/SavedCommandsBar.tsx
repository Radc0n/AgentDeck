import { useState } from 'react'
import type { Terminal } from '../global'
import { useWorkspaceStore } from '../store/workspace'

export function SavedCommandsBar(): React.JSX.Element {
  const activeProject = useWorkspaceStore((state) => state.getActiveProject())
  const addTerminal = useWorkspaceStore((state) => state.addTerminal)
  const [isRunning, setIsRunning] = useState(false)

  if (!activeProject || activeProject.savedCommands.length === 0) {
    return <div className="saved-commands-bar saved-commands-bar--empty" />
  }

  const handleRunCommand = async (label: string, command: string): Promise<void> => {
    if (isRunning) {
      return
    }

    setIsRunning(true)
    try {
      const id = crypto.randomUUID()
      const terminal: Terminal = {
        id,
        name: label,
        profile: 'custom',
        command,
        cwd: activeProject.path,
        order: activeProject.terminals.length
      }

      await window.agentdeck.createTerminal({
        id,
        profile: 'custom',
        cwd: activeProject.path,
        command,
        title: `AgentDeck · ${label}`
      })

      addTerminal(activeProject.id, terminal)
    } catch (error) {
      console.error('Kayıtlı komut çalıştırılamadı:', error)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="saved-commands-bar">
      <span className="saved-commands-bar__label">Kayıtlı komutlar</span>
      <div className="saved-commands-bar__buttons">
        {activeProject.savedCommands.map((saved) => (
          <button
            key={saved.id}
            type="button"
            className="btn btn--preset"
            disabled={isRunning}
            title={saved.command}
            onClick={() => void handleRunCommand(saved.label, saved.command)}
          >
            {saved.label}
          </button>
        ))}
      </div>
    </div>
  )
}
