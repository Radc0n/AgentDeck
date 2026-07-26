import agentdeckIcon from '../assets/agentdeck-icon.png'
import { AddTerminalButton } from './AddTerminalButton'
import { ProjectTabs } from './ProjectTabs'
import { useWorkspaceStore } from '../store/workspace'

export function TopBar(): React.JSX.Element {
  const isNotesPanelOpen = useWorkspaceStore((state) => state.isNotesPanelOpen)
  const toggleNotesPanel = useWorkspaceStore((state) => state.toggleNotesPanel)

  return (
    <header className="top-bar">
      <div className="top-bar__logo" aria-label="AgentDeck">
        <img
          className="top-bar__logo-mark"
          src={agentdeckIcon}
          alt=""
          width={22}
          height={22}
          draggable={false}
        />
        <span className="top-bar__logo-text">AgentDeck</span>
      </div>

      <ProjectTabs />

      <div className="top-bar__actions">
        <AddTerminalButton />

        <button
          type="button"
          className={`top-bar__icon-btn${isNotesPanelOpen ? ' top-bar__icon-btn--active' : ''}`}
          onClick={toggleNotesPanel}
          title="Notlar"
          aria-label="Notlar panelini aç/kapat"
          aria-pressed={isNotesPanelOpen}
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
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <path d="M8 8h8M8 12h8M8 16h5" />
          </svg>
        </button>

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
