import { FitAddon } from '@xterm/addon-fit'
import { Terminal as XTerm } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef, useState } from 'react'
import type { Terminal, TerminalProfile } from '../global'
import { useTerminalIO } from '../hooks/useTerminalIO'
import { useWorkspaceStore } from '../store/workspace'
import { DEFAULT_XTERM_OPTIONS } from '../terminalTheme'

const PROFILE_LABELS: Record<TerminalProfile, string> = {
  grok: 'Grok',
  shell: 'Terminal',
  claude: 'Claude',
  cursor: 'Cursor',
  codex: 'Codex',
  antigravity: 'Antigravity',
  custom: 'Özel'
}

interface TerminalViewProps {
  terminal: Terminal
  onClose: () => void
  onDoubleClick: () => void
}

export function TerminalView({
  terminal,
  onClose,
  onDoubleClick
}: TerminalViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const [xterm, setXterm] = useState<XTerm | null>(null)
  const [spawnError, setSpawnError] = useState<string | null>(null)
  const attention = useWorkspaceStore(
    (state) => state.attentionByTerminalId[terminal.id] ?? 'idle'
  )

  useTerminalIO(terminal.id, xterm)

  useEffect(() => {
    const unsubSpawnError = window.agentdeck.onTerminalSpawnError((event) => {
      if (event.terminalId !== terminal.id) {
        return
      }

      setSpawnError(event.message)
    })

    return () => {
      unsubSpawnError()
    }
  }, [terminal.id])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const instance = new XTerm({ ...DEFAULT_XTERM_OPTIONS })

    const fitAddon = new FitAddon()
    fitAddonRef.current = fitAddon
    xtermRef.current = instance

    instance.loadAddon(fitAddon)
    instance.open(container)
    setXterm(instance)

    let fitFrame = 0

    const syncSize = (): void => {
      const rect = container.getBoundingClientRect()
      if (rect.width < 20 || rect.height < 20) {
        return
      }

      const beforeCols = instance.cols
      const beforeRows = instance.rows
      fitAddon.fit()

      const screenEl = instance.element?.querySelector('.xterm-screen')
      const screenRect = screenEl?.getBoundingClientRect()
      if (screenRect && rect.height > 0) {
        const overflow = screenRect.height - rect.height
        if (overflow > 1) {
          const core = (instance as unknown as {
            _core: { _renderService: { dimensions: { css: { cell: { height: number } } } } }
          })._core
          const cellHeight = core._renderService.dimensions.css.cell.height
          if (cellHeight > 0) {
            const extraRows = Math.ceil(overflow / cellHeight)
            const correctedRows = Math.max(1, instance.rows - extraRows)
            if (correctedRows !== instance.rows) {
              instance.resize(instance.cols, correctedRows)
            }
          }
        }
      }

      if (instance.cols === beforeCols && instance.rows === beforeRows) {
        return
      }

      void window.agentdeck.resizeTerminal({
        terminalId: terminal.id,
        cols: instance.cols,
        rows: instance.rows
      })
    }

    const scheduleSyncSize = (): void => {
      cancelAnimationFrame(fitFrame)
      fitFrame = requestAnimationFrame(() => {
        syncSize()
      })
    }

    scheduleSyncSize()
    requestAnimationFrame(() => {
      scheduleSyncSize()
    })

    const resizeObserver = new ResizeObserver(() => {
      scheduleSyncSize()
    })
    resizeObserver.observe(container)
    const body = container.closest('.terminal-view__body')
    if (body instanceof HTMLElement) {
      resizeObserver.observe(body)
    }

    const refocusSync = (): void => {
      scheduleSyncSize()
    }
    instance.element?.addEventListener('focus', refocusSync, true)

    return () => {
      cancelAnimationFrame(fitFrame)
      resizeObserver.disconnect()
      instance.element?.removeEventListener('focus', refocusSync, true)
      fitAddonRef.current = null
      xtermRef.current = null
      instance.dispose()
      setXterm(null)
    }
  }, [terminal.id])

  const attentionClass = attention === 'needsAttention' ? ' terminal-view--attention' : ''

  return (
    <article
      className={`terminal-view${attentionClass}`}
      onDoubleClick={onDoubleClick}
      title="Odak modu için çift tıklayın"
    >
      <header className="terminal-view__header">
        <span className={`terminal-view__profile terminal-view__profile--${terminal.profile}`}>
          {PROFILE_LABELS[terminal.profile]}
        </span>
        <span className="terminal-view__name">{terminal.name}</span>
        <button
          type="button"
          className="terminal-view__close"
          aria-label="Terminali kapat"
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
        >
          ✕
        </button>
      </header>
      <div className="terminal-view__body">
        {spawnError ? (
          <div className="terminal-view__error" role="alert">
            <p className="terminal-view__error-title">Terminal başlatılamadı</p>
            <p className="terminal-view__error-message">{spawnError}</p>
          </div>
        ) : null}
        <div className="terminal-view__terminal">
          <div className="terminal-view__xterm-host" ref={containerRef} />
        </div>
      </div>
    </article>
  )
}
