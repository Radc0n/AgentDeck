import type { Terminal } from '../global'
import { TerminalView } from './TerminalView'

interface FocusModeProps {
  terminal: Terminal
  onClose: () => void
  onExitFocus: () => void
}

export function FocusMode({
  terminal,
  onClose,
  onExitFocus
}: FocusModeProps): React.JSX.Element {
  return (
    <section className="focus-mode">
      <button
        type="button"
        className="focus-mode__exit-bar"
        onClick={onExitFocus}
        title="Izgara görünümüne dön (Esc)"
        aria-label="Izgara görünümüne dön"
      >
        <span className="focus-mode__exit-label">
          <svg
            className="focus-mode__exit-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18 9 12l6-6" />
          </svg>
          Izgaraya dön
          <span className="focus-mode__exit-esc">(esc)</span>
        </span>
        <span className="focus-mode__hint">Odak — {terminal.name}</span>
      </button>
      <div className="focus-mode__terminal">
        <TerminalView
          terminal={terminal}
          onClose={onClose}
          onDoubleClick={onExitFocus}
        />
      </div>
    </section>
  )
}
