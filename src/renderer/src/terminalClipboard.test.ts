import { describe, expect, it } from 'vitest'
import {
  decidePasteAction,
  isCopyKey,
  isPasteKey,
  shouldCopyOnKeyUp,
  type ClipboardKeyEvent
} from './terminalClipboard'

function key(overrides: Partial<ClipboardKeyEvent> = {}): ClipboardKeyEvent {
  return {
    type: 'keydown',
    key: 'a',
    code: 'KeyA',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
    ...overrides
  }
}

describe('isPasteKey', () => {
  it('Ctrl+V ve Ctrl+Shift+V yapıştırmadır', () => {
    expect(isPasteKey(key({ key: 'v', code: 'KeyV', ctrlKey: true }))).toBe(true)
    expect(isPasteKey(key({ key: 'V', code: 'KeyV', ctrlKey: true, shiftKey: true }))).toBe(true)
  })

  it('Cmd+V yapıştırmadır', () => {
    expect(isPasteKey(key({ key: 'v', code: 'KeyV', metaKey: true }))).toBe(true)
  })

  it('Shift+Insert yapıştırmadır', () => {
    expect(isPasteKey(key({ key: 'Insert', code: 'Insert', shiftKey: true }))).toBe(true)
  })

  it('keyup, AltGr ve Ctrl+C yapıştırma değildir', () => {
    expect(isPasteKey(key({ type: 'keyup', key: 'v', ctrlKey: true }))).toBe(false)
    expect(isPasteKey(key({ key: 'v', ctrlKey: true, altKey: true }))).toBe(false)
    expect(isPasteKey(key({ key: 'c', ctrlKey: true }))).toBe(false)
  })
})

describe('isCopyKey', () => {
  it('Ctrl+C ve Ctrl+Insert kopyalamadır', () => {
    expect(isCopyKey(key({ key: 'c', code: 'KeyC', ctrlKey: true }))).toBe(true)
    expect(isCopyKey(key({ key: 'Insert', code: 'Insert', ctrlKey: true }))).toBe(true)
  })

  it('Ctrl+V ve Shift+Insert kopyalama değildir', () => {
    expect(isCopyKey(key({ key: 'v', ctrlKey: true }))).toBe(false)
    expect(isCopyKey(key({ key: 'Insert', shiftKey: true }))).toBe(false)
  })
})

describe('shouldCopyOnKeyUp', () => {
  it('Shift+ok bırakınca seçim kopyalanır', () => {
    expect(shouldCopyOnKeyUp(key({ type: 'keyup', key: 'ArrowRight', shiftKey: true }))).toBe(
      true
    )
    expect(shouldCopyOnKeyUp(key({ type: 'keyup', key: 'Home', shiftKey: true }))).toBe(true)
  })

  it('yalnızca Shift bırakmak veya sıradan tuş kopyalamaz', () => {
    expect(shouldCopyOnKeyUp(key({ type: 'keyup', key: 'Shift' }))).toBe(false)
    expect(shouldCopyOnKeyUp(key({ type: 'keyup', key: 'a' }))).toBe(false)
    expect(shouldCopyOnKeyUp(key({ type: 'keydown', key: 'ArrowRight', shiftKey: true }))).toBe(
      false
    )
  })
})

describe('decidePasteAction', () => {
  it('metin varsa host yapıştırır — TUI panoyu okuyamaz', () => {
    expect(decidePasteAction({ text: 'hello', hasImage: false })).toBe('paste-text')
    expect(decidePasteAction({ text: 'hello', hasImage: true })).toBe('paste-text')
  })

  it('yalnızca görsel veya boşluk+görsel varsa Ctrl+V TUI ye iletilir', () => {
    expect(decidePasteAction({ text: '', hasImage: true })).toBe('forward-image')
    expect(decidePasteAction({ text: '  \r\n', hasImage: true })).toBe('forward-image')
  })

  it('yalnızca boşluk varsa yine yapıştırır, tamamen boşsa yut', () => {
    expect(decidePasteAction({ text: '  ', hasImage: false })).toBe('paste-text')
    expect(decidePasteAction({ text: '', hasImage: false })).toBe('ignore')
  })
})
