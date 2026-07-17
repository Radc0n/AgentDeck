import { useCallback, useEffect, useState } from 'react'
import type { Terminal, TerminalProfile, TerminalRunState } from '../global'
import { useWorkspaceStore } from '../store/workspace'

const PROFILE_LABELS: Record<TerminalProfile, string> = {
  shell: 'Terminal',
  claude: 'Claude',
  cursor: 'Cursor',
  codex: 'Codex',
  gemini: 'Gemini',
  custom: 'Özel'
}

const STATE_LABELS: Record<TerminalRunState, string> = {
  running: 'Çalışıyor',
  exited: 'Kapandı',
  error: 'Hata'
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
  const [runState, setRunState] = useState<TerminalRunState>('running')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const attention = useWorkspaceStore(
    (state) => state.attentionByTerminalId[terminal.id] ?? 'idle'
  )

  useEffect(() => {
    const unsubState = window.agentdeck.onTerminalState((event) => {
      if (event.terminalId !== terminal.id) {
        return
      }
      setRunState(event.state)
      if (event.message) {
        setStatusMessage(event.message)
      }
      if (event.exitCode !== undefined) {
        setExitCode(event.exitCode)
      }
      if (event.state === 'running') {
        setStatusMessage(null)
        setExitCode(null)
      }
    })

    const unsubSpawnError = window.agentdeck.onTerminalSpawnError((event) => {
      if (event.terminalId !== terminal.id) {
        return
      }
      setRunState('error')
      setStatusMessage(event.message)
    })

    const unsubExit = window.agentdeck.onTerminalExit((event) => {
      if (event.terminalId !== terminal.id) {
        return
      }
      setRunState('exited')
      setExitCode(event.exitCode)
    })

    return () => {
      unsubState()
      unsubSpawnError()
      unsubExit()
    }
  }, [terminal.id])

  const focusWindow = useCallback(async (): Promise<void> => {
    setIsBusy(true)
    try {
      const ok = await window.agentdeck.focusTerminalWindow({ terminalId: terminal.id })
      if (!ok && runState === 'running') {
        setStatusMessage('Pencere bulunamadı — yeniden açmayı deneyin.')
      }
    } catch (error) {
      console.error('Terminal penceresine odaklanılamadı:', error)
    } finally {
      setIsBusy(false)
    }
  }, [runState, terminal.id])

  const restartSession = useCallback(async (): Promise<void> => {
    setIsBusy(true)
    try {
      if (runState === 'running') {
        try {
          await window.agentdeck.killTerminal({ terminalId: terminal.id })
        } catch {
          // Zaten kapanmış olabilir.
        }
      }

      await window.agentdeck.createTerminal({
        id: terminal.id,
        profile: terminal.profile,
        cwd: terminal.cwd,
        command: terminal.command,
        title: `AgentDeck · ${terminal.name}`
      })
      setRunState('running')
      setStatusMessage(null)
      setExitCode(null)
    } catch (error) {
      console.error('Terminal yeniden açılamadı:', error)
      setRunState('error')
      setStatusMessage(
        error instanceof Error ? error.message : 'Terminal yeniden açılamadı.'
      )
    } finally {
      setIsBusy(false)
    }
  }, [runState, terminal])

  const handleDoubleClick = (): void => {
    onDoubleClick()
    if (runState === 'running') {
      void focusWindow()
    }
  }

  const attentionClass = attention === 'needsAttention' ? ' terminal-view--attention' : ''
  const stateClass = ` terminal-view--${runState}`

  return (
    <article
      className={`terminal-view terminal-view--native${attentionClass}${stateClass}`}
      onDoubleClick={handleDoubleClick}
      title="Çift tık: odak + native pencereye geç"
    >
      <header className="terminal-view__header">
        <span className={`terminal-view__profile terminal-view__profile--${terminal.profile}`}>
          {PROFILE_LABELS[terminal.profile]}
        </span>
        <span className="terminal-view__name">{terminal.name}</span>
        <span className={`terminal-view__status terminal-view__status--${runState}`}>
          {STATE_LABELS[runState]}
        </span>
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
      <div className="terminal-view__body terminal-view__body--native">
        <div className="terminal-view__native-card">
          <p className="terminal-view__native-kicker">Native terminal</p>
          <h3 className="terminal-view__native-title">{terminal.name}</h3>
          <p className="terminal-view__native-path" title={terminal.cwd}>
            {terminal.cwd}
          </p>
          {terminal.command ? (
            <p className="terminal-view__native-command" title={terminal.command}>
              <span className="terminal-view__native-label">Komut</span>
              {terminal.command}
            </p>
          ) : null}
          {exitCode !== null ? (
            <p className="terminal-view__native-meta">Çıkış kodu: {exitCode}</p>
          ) : null}
          {statusMessage ? (
            <p className="terminal-view__native-error" role="alert">
              {statusMessage}
            </p>
          ) : (
            <p className="terminal-view__native-hint">
              Shell Windows Terminal / sistem konsolunda açılır. Seçim, kopyala ve
              yapıştır OS terminali ile çalışır.
            </p>
          )}
          <div className="terminal-view__native-actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={isBusy || runState !== 'running'}
              onClick={(event) => {
                event.stopPropagation()
                void focusWindow()
              }}
            >
              Pencereye git
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={isBusy}
              onClick={(event) => {
                event.stopPropagation()
                void restartSession()
              }}
            >
              {runState === 'running' ? 'Yeniden başlat' : 'Yeniden aç'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
