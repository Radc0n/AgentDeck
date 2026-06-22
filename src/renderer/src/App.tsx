import { useCallback, useEffect, useState } from 'react'
import { FocusMode } from './components/FocusMode'
import { SavedCommandsBar } from './components/SavedCommandsBar'
import { StatusBar } from './components/StatusBar'
import { TerminalGrid } from './components/TerminalGrid'
import { TopBar } from './components/TopBar'
import { useAttentionSync } from './hooks/useAttentionSync'
import { useWorkspaceStore } from './store/workspace'

function App(): React.JSX.Element {
  useAttentionSync()

  const getActiveProject = useWorkspaceStore((state) => state.getActiveProject)

  const [focusedTerminalId, setFocusedTerminalId] = useState<string | null>(null)

  const activeProject = getActiveProject()
  const focusedTerminal = activeProject?.terminals.find(
    (terminal) => terminal.id === focusedTerminalId
  )

  useEffect(() => {
    if (focusedTerminalId && !focusedTerminal) {
      setFocusedTerminalId(null)
    }
  }, [focusedTerminalId, focusedTerminal])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && focusedTerminalId) {
        setFocusedTerminalId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusedTerminalId])

  const handleCloseFocusedTerminal = useCallback(async (): Promise<void> => {
    if (!activeProject || !focusedTerminalId) {
      return
    }

    try {
      await window.agentdeck.killTerminal({ terminalId: focusedTerminalId })
      useWorkspaceStore.getState().removeTerminal(activeProject.id, focusedTerminalId)
      setFocusedTerminalId(null)
    } catch (error) {
      console.error('Terminal kapatılamadı:', error)
    }
  }, [activeProject, focusedTerminalId])

  const terminalCount = activeProject?.terminals.length ?? 0
  const viewMode = focusedTerminalId ? 'focus' : 'grid'

  return (
    <div className="app">
      <TopBar />

      <main className="app__main">
        {focusedTerminal && activeProject ? (
          <FocusMode
            terminal={focusedTerminal}
            onClose={() => void handleCloseFocusedTerminal()}
            onExitFocus={() => setFocusedTerminalId(null)}
          />
        ) : (
          <TerminalGrid onFocusTerminal={setFocusedTerminalId} />
        )}
      </main>

      <SavedCommandsBar />

      <StatusBar
        viewMode={viewMode}
        terminalCount={terminalCount}
        onToggleViewMode={() => {
          if (viewMode === 'focus') {
            setFocusedTerminalId(null)
          } else if (activeProject && activeProject.terminals.length > 0) {
            const first = [...activeProject.terminals].sort((a, b) => a.order - b.order)[0]
            if (first) {
              setFocusedTerminalId(first.id)
            }
          }
        }}
      />
    </div>
  )
}

export default App
