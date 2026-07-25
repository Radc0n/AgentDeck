import { useWorkspaceStore } from '../store/workspace'

interface StatusBarProps {
  terminalCount: number
  activeTerminalName: string | null
}

export function StatusBar({
  terminalCount,
  activeTerminalName
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
        {activeTerminalName ? (
          <span className="status-bar__active-tab" title="Aktif terminal">
            {activeTerminalName}
          </span>
        ) : null}
        <span className="status-bar__count">
          {terminalCount} {terminalCount === 1 ? 'terminal' : 'terminal'}
        </span>
      </div>
    </footer>
  )
}
