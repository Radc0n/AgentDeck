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
      <div className="focus-mode__toolbar">
        <button type="button" className="btn btn--ghost" onClick={onExitFocus}>
          ← Izgaraya dön
        </button>
        <span className="focus-mode__hint">Odak modu — {terminal.name}</span>
      </div>
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
