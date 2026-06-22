import type { Terminal } from '@xterm/xterm'
import { useEffect } from 'react'

export function useTerminalIO(terminalId: string, terminal: Terminal | null): void {
  useEffect(() => {
    if (!terminal) {
      return
    }

    let liveEnabled = false
    let attachSettled = false
    const pendingLive: string[] = []

    const unsubData = window.agentdeck.onTerminalData((event) => {
      if (event.terminalId !== terminalId) {
        return
      }

      if (!liveEnabled) {
        pendingLive.push(event.data)
        return
      }

      terminal.write(event.data)
    })

    void window.agentdeck.attachTerminal({ terminalId }).then(({ data, reattach }) => {
      const settleAttach = (): void => {
        if (attachSettled) {
          return
        }
        attachSettled = true

        if (data) {
          terminal.write(data)
        }

        liveEnabled = true
        for (const chunk of pendingLive) {
          terminal.write(chunk)
        }
        pendingLive.length = 0

        if (reattach) {
          void window.agentdeck.resizeTerminal({
            terminalId,
            cols: terminal.cols,
            rows: terminal.rows,
            force: true
          })
        }
      }

      // Buffer'ı fit() sonrası doğru boyutta yaz — aksi halde TUI bozulur veya ekran boş kalır.
      const fitDisposable = terminal.onResize(() => {
        if (attachSettled) {
          return
        }
        settleAttach()
      })

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!attachSettled) {
            settleAttach()
          }
          fitDisposable.dispose()
        })
      })
    })

    const unsubExit = window.agentdeck.onTerminalExit((event) => {
      if (event.terminalId !== terminalId) {
        return
      }

      const signalPart =
        event.signal !== undefined ? `, sinyal: ${event.signal}` : ''
      terminal.writeln(
        `\r\n\x1b[33m[İşlem sonlandı — çıkış kodu: ${event.exitCode}${signalPart}]\x1b[0m`
      )
    })

    const dataDisposable = terminal.onData((data) => {
      void window.agentdeck.writeTerminal({ terminalId, data })
      void window.agentdeck.reportTerminalUserInput({ terminalId })
    })

    const reportFocus = (): void => {
      void window.agentdeck.reportTerminalFocus({ terminalId })
    }

    const element = terminal.element
    element?.addEventListener('focus', reportFocus, true)
    element?.addEventListener('mousedown', reportFocus)

    return () => {
      void window.agentdeck.detachTerminal({ terminalId })
      unsubData()
      unsubExit()
      dataDisposable.dispose()
      element?.removeEventListener('focus', reportFocus, true)
      element?.removeEventListener('mousedown', reportFocus)
    }
  }, [terminalId, terminal])
}
