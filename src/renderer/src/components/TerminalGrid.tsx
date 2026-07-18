import { useWorkspaceStore } from '../store/workspace'
import { TerminalView } from './TerminalView'

interface TerminalGridProps {
  onFocusTerminal: (terminalId: string) => void
}

function getTerminalGridClass(count: number): string {
  const base = 'terminal-grid'
  if (count === 1) {
    return `${base} ${base}--single`
  }
  if (count === 2) {
    return `${base} ${base}--duo`
  }
  if (count === 3) {
    return `${base} ${base}--trio`
  }
  if (count === 4) {
    return `${base} ${base}--quad`
  }
  return `${base} ${base}--many`
}

export function TerminalGrid({ onFocusTerminal }: TerminalGridProps): React.JSX.Element {
  const activeProject = useWorkspaceStore((state) => state.getActiveProject())
  const removeTerminal = useWorkspaceStore((state) => state.removeTerminal)

  if (!activeProject) {
    return (
      <div className="terminal-grid terminal-grid--empty">
        <p>Başlamak için üst bardan bir proje ekleyin.</p>
      </div>
    )
  }

  const sortedTerminals = [...activeProject.terminals].sort((a, b) => a.order - b.order)

  const handleCloseTerminal = async (terminalId: string): Promise<void> => {
    try {
      await window.agentdeck.killTerminal({ terminalId })
    } catch (error) {
      console.error('Terminal kapatılamadı:', error)
    } finally {
      // Süreç çökmüş olsa bile panel UI'dan kalksın.
      removeTerminal(activeProject.id, terminalId)
    }
  }

  if (sortedTerminals.length === 0) {
    return (
      <div className="terminal-grid terminal-grid--empty">
        <p>Terminal eklemek için üst bardan + Terminal&apos;e tıklayın.</p>
      </div>
    )
  }

  return (
    <div className={getTerminalGridClass(sortedTerminals.length)}>
      {sortedTerminals.map((terminal) => (
        <TerminalView
          key={terminal.id}
          terminal={terminal}
          onClose={() => void handleCloseTerminal(terminal.id)}
          onDoubleClick={() => onFocusTerminal(terminal.id)}
        />
      ))}
    </div>
  )
}
