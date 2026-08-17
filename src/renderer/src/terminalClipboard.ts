import type { Terminal } from '@xterm/xterm'

/**
 * Terminal kopyala/yapıştır.
 *
 * TUI ajanları (Codex, Antigravity, Grok) Ctrl+V'yi kendileri yakalar ve
 * PTY sürecinden sistem panosunu okumaya çalışır. ConPTY altında metin
 * panosu çoğu zaman başarısız olur; ekran görüntüsü bazen çalışır.
 *
 * Çözüm: kısayolu xterm'de kes, panoyu Electron main'den oku, metni
 * bracketed paste ile PTY'ye yaz. Seçim bitince de otomatik kopyala.
 */

/** Codex'in ekran görüntüsü yapıştırması için iletilen Ctrl+V. */
export const CTRL_V = '\x16'

export interface ClipboardContents {
  text: string
  hasImage: boolean
}

export type PasteAction = 'paste-text' | 'forward-image' | 'ignore'

export interface ClipboardKeyEvent {
  type: string
  key: string
  code: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  repeat: boolean
}

export interface TerminalClipboardHost {
  readClipboard: () => Promise<ClipboardContents>
  writeClipboard: (text: string) => Promise<void>
  writePty: (data: string) => Promise<void>
}

const SELECTION_NAV_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown'
])

function hasPrimaryModifier(event: ClipboardKeyEvent): boolean {
  return event.ctrlKey || event.metaKey
}

export function isPasteKey(event: ClipboardKeyEvent): boolean {
  if (event.type !== 'keydown' || event.altKey) {
    return false
  }

  if (hasPrimaryModifier(event) && (event.key === 'v' || event.key === 'V')) {
    return true
  }

  return (
    event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    (event.key === 'Insert' || event.code === 'Insert')
  )
}

export function isCopyKey(event: ClipboardKeyEvent): boolean {
  if (event.type !== 'keydown' || event.altKey) {
    return false
  }

  if (hasPrimaryModifier(event) && (event.key === 'c' || event.key === 'C')) {
    return true
  }

  return (
    hasPrimaryModifier(event) &&
    !event.shiftKey &&
    (event.key === 'Insert' || event.code === 'Insert')
  )
}

export function shouldCopyOnKeyUp(event: ClipboardKeyEvent): boolean {
  if (event.type !== 'keyup' || event.altKey) {
    return false
  }

  return event.shiftKey && SELECTION_NAV_KEYS.has(event.key)
}

export function decidePasteAction(contents: ClipboardContents): PasteAction {
  if (contents.text.trim().length > 0) {
    return 'paste-text'
  }

  if (contents.hasImage) {
    return 'forward-image'
  }

  if (contents.text.length > 0) {
    return 'paste-text'
  }

  return 'ignore'
}

function toKeyEvent(event: KeyboardEvent): ClipboardKeyEvent {
  return {
    type: event.type,
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    repeat: event.repeat
  }
}

const MAX_CLIPBOARD_TEXT = 1_048_576

function sanitizeClipboardText(text: string): string {
  const stripped = text.replace(/\0/g, '')
  return stripped.length > MAX_CLIPBOARD_TEXT ? stripped.slice(0, MAX_CLIPBOARD_TEXT) : stripped
}

function ignoreFailure(promise: Promise<void>): void {
  void promise.catch(() => {
    // Pano/PTY yazılamazsa TUI'ye hata düşürme.
  })
}

export function installClipboardPolicy(
  terminal: Terminal,
  host: TerminalClipboardHost
): () => void {
  const element = terminal.element
  let disposed = false
  let pasteGeneration = 0
  let lastCopied = ''
  let writePending = false
  let pointerSelecting = false

  const copySelection = (): boolean => {
    if (!terminal.hasSelection()) {
      return false
    }

    const text = sanitizeClipboardText(terminal.getSelection())
    if (text.length === 0) {
      return false
    }

    lastCopied = text
    writePending = true
    void host.writeClipboard(text).finally(() => {
      writePending = false
    }).catch(() => {
      // Pano yazılamazsa TUI'ye hata düşürme.
    })
    return true
  }

  const applyPaste = (contents: ClipboardContents): void => {
    const action = decidePasteAction(contents)
    if (action === 'paste-text') {
      terminal.paste(contents.text)
      return
    }

    if (action === 'forward-image') {
      ignoreFailure(host.writePty(CTRL_V))
    }
  }

  const pasteFromHost = (): void => {
    if (writePending && lastCopied.length > 0) {
      applyPaste({ text: lastCopied, hasImage: false })
      return
    }

    const generation = ++pasteGeneration
    void host.readClipboard().then(
      (contents) => {
        if (disposed || generation !== pasteGeneration) {
          return
        }
        applyPaste(contents)
      },
      () => {
        // Pano okunamazsa TUI'ye "failed to paste" gitmesin.
      }
    )
  }

  const consumeKey = (event: KeyboardEvent): false => {
    event.preventDefault()
    event.stopPropagation()
    return false
  }

  const onKey = (event: KeyboardEvent): boolean => {
    const keyEvent = toKeyEvent(event)

    if (isCopyKey(keyEvent) && terminal.hasSelection()) {
      if (!event.repeat) {
        copySelection()
      }
      return consumeKey(event)
    }

    if (isPasteKey(keyEvent)) {
      if (!event.repeat) {
        pasteFromHost()
      }
      return consumeKey(event)
    }

    return true
  }

  const onPointerDown = (event: MouseEvent): void => {
    if (event.button === 0) {
      pointerSelecting = true
    }
  }

  const onDocumentMouseUp = (event: MouseEvent): void => {
    if (!pointerSelecting || event.button !== 0) {
      return
    }
    pointerSelecting = false
    copySelection()
  }

  const onKeyUp = (event: KeyboardEvent): void => {
    if (shouldCopyOnKeyUp(toKeyEvent(event))) {
      copySelection()
    }
  }

  terminal.attachCustomKeyEventHandler(onKey)
  element?.addEventListener('mousedown', onPointerDown)
  document.addEventListener('mouseup', onDocumentMouseUp)
  element?.addEventListener('keyup', onKeyUp)

  return () => {
    disposed = true
    pasteGeneration += 1
    pointerSelecting = false
    element?.removeEventListener('mousedown', onPointerDown)
    document.removeEventListener('mouseup', onDocumentMouseUp)
    element?.removeEventListener('keyup', onKeyUp)
    terminal.attachCustomKeyEventHandler(() => true)
  }
}
