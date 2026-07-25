import { useWorkspaceStore } from '../store/workspace'
import { TerminalTabs } from './TerminalTabs'
import { TerminalView } from './TerminalView'

export function TerminalWorkspace(): React.JSX.Element {
  const activeProject = useWorkspaceStore((state) => state.getActiveProject())
  const activeTerminalByProjectId = useWorkspaceStore(
    (state) => state.activeTerminalByProjectId
  )
  const setActiveTerminal = useWorkspaceStore((state) => state.setActiveTerminal)
  const removeTerminal = useWorkspaceStore((state) => state.removeTerminal)

  if (!activeProject) {
    return (
      <section className="terminal-workspace terminal-workspace--empty">
        <div className="terminal-workspace__empty">
          <p className="terminal-workspace__empty-title">Proje yok</p>
          <p className="terminal-workspace__empty-copy">
            Başlamak için üst bardan bir proje ekleyin.
          </p>
        </div>
      </section>
    )
  }

  const sortedTerminals = [...activeProject.terminals].sort((a, b) => a.order - b.order)
  const preferredId = activeTerminalByProjectId[activeProject.id]
  const activeTerminalId =
    preferredId && sortedTerminals.some((terminal) => terminal.id === preferredId)
      ? preferredId
      : (sortedTerminals[0]?.id ?? null)

  const handleCloseTerminal = async (terminalId: string): Promise<void> => {
    try {
      await window.agentdeck.killTerminal({ terminalId })
    } catch (error) {
      console.error('Terminal kapatılamadı:', error)
    } finally {
      removeTerminal(activeProject.id, terminalId)
    }
  }

  if (sortedTerminals.length === 0) {
    return (
      <section className="terminal-workspace terminal-workspace--empty">
        <TerminalTabs
          projectId={activeProject.id}
          terminals={sortedTerminals}
          activeTerminalId={null}
          onSelect={() => undefined}
          onClose={() => undefined}
        />
        <div className="terminal-workspace__empty">
          <p className="terminal-workspace__empty-title">Terminal yok</p>
          <p className="terminal-workspace__empty-copy">
            Üst bardan “+ Terminal” veya sekme şeridindeki + ile oturum açın.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="terminal-workspace">
      <TerminalTabs
        projectId={activeProject.id}
        terminals={sortedTerminals}
        activeTerminalId={activeTerminalId}
        onSelect={(terminalId) => setActiveTerminal(activeProject.id, terminalId)}
        onClose={(terminalId) => void handleCloseTerminal(terminalId)}
      />

      <div className="terminal-workspace__stage">
        {sortedTerminals.map((terminal) => {
          const isActive = terminal.id === activeTerminalId
          return (
            <div
              key={terminal.id}
              id={`terminal-panel-${terminal.id}`}
              role="tabpanel"
              aria-labelledby={`terminal-tab-${terminal.id}`}
              aria-hidden={!isActive}
              className={
                isActive
                  ? 'terminal-workspace__pane terminal-workspace__pane--active'
                  : 'terminal-workspace__pane terminal-workspace__pane--idle'
              }
            >
              <TerminalView
                terminal={terminal}
                chrome="bare"
                active={isActive}
                onClose={() => void handleCloseTerminal(terminal.id)}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
