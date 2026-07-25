import { useEffect, useRef, useState } from 'react'
import type { Terminal, TerminalProfile } from '../global'
import { PROFILE_OPTIONS, useAddTerminal } from '../hooks/useAddTerminal'
import { useWorkspaceStore } from '../store/workspace'

const PROFILE_LABELS: Record<TerminalProfile, string> = {
  grok: 'Grok',
  shell: 'Shell',
  claude: 'Claude',
  cursor: 'Cursor',
  codex: 'Codex',
  antigravity: 'Antigravity',
  custom: 'Özel'
}

interface TerminalTabsProps {
  projectId: string
  terminals: Terminal[]
  activeTerminalId: string | null
  onSelect: (terminalId: string) => void
  onClose: (terminalId: string) => void
}

export function TerminalTabs({
  projectId,
  terminals,
  activeTerminalId,
  onSelect,
  onClose
}: TerminalTabsProps): React.JSX.Element {
  const attentionByTerminalId = useWorkspaceStore((state) => state.attentionByTerminalId)
  const { canAdd, isAdding, addTerminalWithProfile } = useAddTerminal()
  const [menuOpen, setMenuOpen] = useState(false)
  const addRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (!addRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [menuOpen])

  const sorted = [...terminals].sort((a, b) => a.order - b.order)

  return (
    <div className="terminal-tabs" role="tablist" aria-label="Proje terminalleri">
      <div className="terminal-tabs__scroll">
        {sorted.map((terminal) => {
          const isActive = terminal.id === activeTerminalId
          const attention = attentionByTerminalId[terminal.id] ?? 'idle'
          const needsAttention = attention === 'needsAttention'
          const tabClass = [
            'terminal-tabs__tab',
            isActive ? 'terminal-tabs__tab--active' : '',
            needsAttention ? 'terminal-tabs__tab--attention' : ''
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div key={terminal.id} className="terminal-tabs__item">
              <button
                type="button"
                role="tab"
                id={`terminal-tab-${terminal.id}`}
                aria-selected={isActive}
                aria-controls={`terminal-panel-${terminal.id}`}
                tabIndex={isActive ? 0 : -1}
                className={tabClass}
                onClick={() => onSelect(terminal.id)}
                title={terminal.name}
              >
                <span
                  className={`terminal-tabs__profile terminal-tabs__profile--${terminal.profile}`}
                >
                  {PROFILE_LABELS[terminal.profile]}
                </span>
                <span className="terminal-tabs__name">{terminal.name}</span>
                {needsAttention ? (
                  <span className="terminal-tabs__dot" aria-label="Dikkat gerekli" />
                ) : null}
              </button>
              <button
                type="button"
                className="terminal-tabs__close"
                aria-label={`${terminal.name} sekmesini kapat`}
                onClick={(event) => {
                  event.stopPropagation()
                  onClose(terminal.id)
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M18 6 6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          )
        })}
      </div>

      <div className="terminal-tabs__add" ref={addRef}>
        <button
          type="button"
          className="terminal-tabs__add-btn"
          disabled={!canAdd || isAdding}
          aria-label="Yeni terminal sekmesi"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title="Yeni terminal"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {menuOpen ? (
          <div className="terminal-tabs__menu" role="menu" aria-label="Terminal profili">
            {PROFILE_OPTIONS.map((option) => (
              <button
                key={option.profile}
                type="button"
                role="menuitem"
                className="terminal-tabs__menu-item"
                disabled={isAdding}
                onClick={() => {
                  setMenuOpen(false)
                  void addTerminalWithProfile(option.profile)
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <span className="terminal-tabs__meta" aria-hidden="true">
        {projectId ? `${sorted.length} oturum` : null}
      </span>
    </div>
  )
}
