import type { Project, Terminal } from '../global'
import { useWorkspaceStore } from '../store/workspace'
import { TerminalTabs } from './TerminalTabs'
import { TerminalView } from './TerminalView'

/**
 * Proje değişince terminal panelleri unmount OLMAZ — sadece görünürlükleri değişir.
 *
 * Neden: unmount edilirse xterm örneği dispose olur. Geri dönüldüğünde sıfırdan
 * kurulup main process'teki halka tampon (`MAX_TERMINAL_BUFFER_CHARS`, 512K) replay
 * edilir. Grok gibi TUI'ler mod pazarlığını (`?1049h` alt buffer, `?1006h` SGR mouse,
 * `?1002h` tracking) başlangıçta **bir kez** gönderir; tampon taştıktan sonra bu
 * diziler replay'de bulunmaz. Yeni xterm örneği modları kapalı sanır, tekerleği
 * uygulamaya iletmeyi bırakır ve scroll ölür.
 *
 * Semptom buydu: "ilk açılışta çalışıyor, bir süre sonra sapıtıyor".
 */
export function TerminalWorkspace(): React.JSX.Element {
  const projects = useWorkspaceStore((state) => state.projects)
  const activeProjectId = useWorkspaceStore((state) => state.activeProjectId)
  const activeTerminalByProjectId = useWorkspaceStore(
    (state) => state.activeTerminalByProjectId
  )
  const setActiveTerminal = useWorkspaceStore((state) => state.setActiveTerminal)
  const removeTerminal = useWorkspaceStore((state) => state.removeTerminal)

  const activeProject = projects.find((project) => project.id === activeProjectId)

  const closeTerminal = async (projectId: string, terminalId: string): Promise<void> => {
    try {
      await window.agentdeck.killTerminal({ terminalId })
    } catch (error) {
      console.error('Terminal kapatılamadı:', error)
    } finally {
      removeTerminal(projectId, terminalId)
    }
  }

  if (projects.length === 0) {
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

  const activeTerminals = activeProject ? sortTerminals(activeProject) : []
  const activeTerminalId = resolveActiveTerminalId(
    activeTerminals,
    activeProject ? activeTerminalByProjectId[activeProject.id] : undefined
  )

  return (
    <section className="terminal-workspace">
      <TerminalTabs
        projectId={activeProject?.id ?? ''}
        terminals={activeTerminals}
        activeTerminalId={activeTerminalId}
        onSelect={(terminalId) => {
          if (activeProject) {
            setActiveTerminal(activeProject.id, terminalId)
          }
        }}
        onClose={(terminalId) => {
          if (activeProject) {
            void closeTerminal(activeProject.id, terminalId)
          }
        }}
      />

      <div className="terminal-workspace__stage">
        {projects.flatMap((project) => {
          const terminals = sortTerminals(project)
          const visibleTerminalId = resolveActiveTerminalId(
            terminals,
            activeTerminalByProjectId[project.id]
          )
          const isActiveProject = project.id === activeProjectId

          return terminals.map((terminal) => {
            const isActive = isActiveProject && terminal.id === visibleTerminalId
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
                  onClose={() => void closeTerminal(project.id, terminal.id)}
                />
              </div>
            )
          })
        })}

        {activeTerminals.length === 0 ? (
          <div className="terminal-workspace__empty terminal-workspace__empty--overlay">
            <p className="terminal-workspace__empty-title">Terminal yok</p>
            <p className="terminal-workspace__empty-copy">
              Üst bardan “+ Terminal” veya sekme şeridindeki + ile oturum açın.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function sortTerminals(project: Project): Terminal[] {
  return [...project.terminals].sort((a, b) => a.order - b.order)
}

function resolveActiveTerminalId(
  terminals: Terminal[],
  preferredId: string | undefined
): string | null {
  if (preferredId && terminals.some((terminal) => terminal.id === preferredId)) {
    return preferredId
  }
  return terminals[0]?.id ?? null
}
