import { NotesPanel } from './components/NotesPanel'
import { SavedCommandsBar } from './components/SavedCommandsBar'
import { StatusBar } from './components/StatusBar'
import { TerminalWorkspace } from './components/TerminalWorkspace'
import { TopBar } from './components/TopBar'
import { useAttentionSync } from './hooks/useAttentionSync'
import { useWorkspaceStore } from './store/workspace'

function App(): React.JSX.Element {
  useAttentionSync()

  const getActiveProject = useWorkspaceStore((state) => state.getActiveProject)
  const isNotesPanelOpen = useWorkspaceStore((state) => state.isNotesPanelOpen)
  const getActiveTerminalId = useWorkspaceStore((state) => state.getActiveTerminalId)

  const activeProject = getActiveProject()
  const terminalCount = activeProject?.terminals.length ?? 0
  const activeTerminalId = getActiveTerminalId()
  const activeTerminalName =
    activeProject?.terminals.find((terminal) => terminal.id === activeTerminalId)?.name ?? null

  return (
    <div className="app">
      <TopBar />

      <main className="app__main">
        <div className="app__workspace">
          {isNotesPanelOpen && <NotesPanel />}

          <div className="app__content">
            <TerminalWorkspace />
          </div>
        </div>
      </main>

      <SavedCommandsBar />

      <StatusBar terminalCount={terminalCount} activeTerminalName={activeTerminalName} />
    </div>
  )
}

export default App
