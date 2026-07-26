import { Fragment, useEffect, useRef, useState } from 'react'
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

const DRAG_THRESHOLD_PX = 6

interface TerminalTabsProps {
  projectId: string
  terminals: Terminal[]
  activeTerminalId: string | null
  onSelect: (terminalId: string) => void
  onClose: (terminalId: string) => void
}

function resolveTerminalInsertionSlot(
  clientX: number,
  tabRects: Array<{ left: number; width: number }>
): number {
  for (let i = 0; i < tabRects.length; i++) {
    const rect = tabRects[i]
    if (clientX < rect.left + rect.width / 2) {
      return i
    }
  }
  return tabRects.length
}

export function TerminalTabs({
  projectId,
  terminals,
  activeTerminalId,
  onSelect,
  onClose
}: TerminalTabsProps): React.JSX.Element {
  const attentionByTerminalId = useWorkspaceStore((state) => state.attentionByTerminalId)
  const reorderTerminals = useWorkspaceStore((state) => state.reorderTerminals)
  const { canAdd, isAdding, addTerminalWithProfile } = useAddTerminal()
  const [menuOpen, setMenuOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [insertionSlot, setInsertionSlot] = useState<number | null>(null)
  const addRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLDivElement | null)[]>([])
  const dragStartRef = useRef<{ id: string; startX: number; didDrag: boolean } | null>(null)

  const sorted = [...terminals].sort((a, b) => a.order - b.order)

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

  const resetDrag = (): void => {
    dragStartRef.current = null
    setDraggingId(null)
    setInsertionSlot(null)
  }

  const measureRects = (): Array<{ left: number; width: number }> =>
    tabRefs.current
      .slice(0, sorted.length)
      .map((el) => {
        if (!el) {
          return null
        }
        const { left, width } = el.getBoundingClientRect()
        return { left, width }
      })
      .filter((rect): rect is { left: number; width: number } => rect !== null)

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    terminalId: string
  ): void => {
    if (event.button !== 0) {
      return
    }
    // Kapat düğmesi drag başlatmasın
    if ((event.target as HTMLElement).closest('.terminal-tabs__close')) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = { id: terminalId, startX: event.clientX, didDrag: false }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragStartRef.current
    if (!drag) {
      return
    }

    if (!drag.didDrag && Math.abs(event.clientX - drag.startX) >= DRAG_THRESHOLD_PX) {
      drag.didDrag = true
      setDraggingId(drag.id)
      setMenuOpen(false)
    }

    if (drag.didDrag) {
      setInsertionSlot(resolveTerminalInsertionSlot(event.clientX, measureRects()))
    }
  }

  const handlePointerUp = (
    event: React.PointerEvent<HTMLDivElement>,
    terminalId: string
  ): void => {
    const drag = dragStartRef.current
    if (!drag) {
      return
    }

    if (drag.didDrag) {
      const fromIndex = sorted.findIndex((terminal) => terminal.id === drag.id)
      const toSlot = resolveTerminalInsertionSlot(event.clientX, measureRects())
      if (fromIndex !== -1 && projectId) {
        reorderTerminals(projectId, fromIndex, toSlot)
      }
    } else {
      onSelect(terminalId)
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    resetDrag()
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    resetDrag()
  }

  const isDragging = draggingId !== null

  return (
    <div className="terminal-tabs" role="tablist" aria-label="Proje terminalleri">
      {/* Sekmeler ayrı scroll; + overflow dışında kalsın ki profil menüsü kesilmesin */}
      <div className="terminal-tabs__list">
        {sorted.map((terminal, index) => {
          const isActive = terminal.id === activeTerminalId
          const attention = attentionByTerminalId[terminal.id] ?? 'idle'
          const needsAttention = attention === 'needsAttention'
          const isItemDragging = draggingId === terminal.id
          const tabClass = [
            'terminal-tabs__tab',
            isActive ? 'terminal-tabs__tab--active' : '',
            needsAttention ? 'terminal-tabs__tab--attention' : ''
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <Fragment key={terminal.id}>
              {isDragging && insertionSlot === index ? (
                <div className="terminal-tabs__insertion-line" aria-hidden="true" />
              ) : null}
              <div
                ref={(element) => {
                  tabRefs.current[index] = element
                }}
                className={[
                  'terminal-tabs__item',
                  isItemDragging ? 'terminal-tabs__item--dragging' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                onPointerDown={(event) => handlePointerDown(event, terminal.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={(event) => handlePointerUp(event, terminal.id)}
                onPointerCancel={handlePointerCancel}
              >
                <button
                  type="button"
                  role="tab"
                  id={`terminal-tab-${terminal.id}`}
                  aria-selected={isActive}
                  aria-controls={`terminal-panel-${terminal.id}`}
                  tabIndex={isActive ? 0 : -1}
                  className={tabClass}
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
                  onPointerDown={(event) => event.stopPropagation()}
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
            </Fragment>
          )
        })}

        {isDragging && insertionSlot === sorted.length ? (
          <div className="terminal-tabs__insertion-line" aria-hidden="true" />
        ) : null}
      </div>

      <div className="terminal-tabs__add" ref={addRef}>
        <button
          type="button"
          className="terminal-tabs__add-btn"
          disabled={!canAdd || isAdding}
          aria-label="Yeni terminal sekmesi"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title={canAdd ? 'Yeni terminal' : 'Önce bir proje seçin'}
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
