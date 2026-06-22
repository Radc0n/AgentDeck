import { useWorkspaceStore } from '../store/workspace'

interface StatusBarProps {
  viewMode: 'grid' | 'focus'
  terminalCount: number
  onToggleViewMode: () => void
}

export function StatusBar({
  viewMode,
  terminalCount,
  onToggleViewMode
}: StatusBarProps): React.JSX.Element {
  const activeProject = useWorkspaceStore((state) => state.getActiveProject())

  return (
    <footer className="status-bar">
      <div className="status-bar__breadcrumb">
        {activeProject ? (
          <>
            <span className="status-bar__project-name">{activeProject.name}</span>
            <span className="status-bar__separator">·</span>
            <span className="status-bar__path" title={activeProject.path}>
              {activeProject.path}
            </span>
          </>
        ) : (
          <span className="status-bar__empty">Proje seçilmedi</span>
        )}
      </div>

      <div className="status-bar__meta">
        <span className="status-bar__count">{terminalCount} terminal</span>

        <button
          type="button"
          className="status-bar__mode-badge"
          disabled={!activeProject || terminalCount === 0}
          onClick={onToggleViewMode}
        >
          {viewMode === 'focus' ? 'Izgara' : 'Odak'}
        </button>
      </div>
    </footer>
  )
}
