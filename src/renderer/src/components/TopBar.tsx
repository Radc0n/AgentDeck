import type { Project } from '../global'
import { useWorkspaceStore } from '../store/workspace'
import { AddTerminalButton } from './AddTerminalButton'
import { ProjectTabs } from './ProjectTabs'

function createProjectFromPath(path: string, name?: string): Project {
  const segments = path.split(/[/\\]/)
  const fallbackName = segments[segments.length - 1] || 'Proje'

  return {
    id: crypto.randomUUID(),
    name: name ?? fallbackName,
    path,
    terminals: [],
    savedCommands: []
  }
}

export function TopBar(): React.JSX.Element {
  const addProject = useWorkspaceStore((state) => state.addProject)
  const setActiveProject = useWorkspaceStore((state) => state.setActiveProject)

  const handleAddProject = async (): Promise<void> => {
    try {
      const result = await window.agentdeck.addProject()
      if (!result.path) {
        return
      }

      const project = createProjectFromPath(result.path, result.name)
      addProject(project)
      setActiveProject(project.id)
    } catch (error) {
      console.error('Proje eklenemedi:', error)
    }
  }

  return (
    <header className="top-bar">
      <div className="top-bar__logo" aria-label="AgentDeck">
        <span className="top-bar__logo-mark">◆</span>
        <span className="top-bar__logo-text">AgentDeck</span>
      </div>

      <ProjectTabs />

      <div className="top-bar__actions">
        <button type="button" className="btn btn--ghost" onClick={() => void handleAddProject()}>
          + Proje
        </button>

        <AddTerminalButton />

        <button
          type="button"
          className="top-bar__icon-btn"
          disabled
          title="Ayarlar (yakında)"
          aria-label="Ayarlar"
        >
          <svg
            className="top-bar__icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
      </div>
    </header>
  )
}
