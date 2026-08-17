export type PtyOutputKind = 'notify' | 'activity' | 'content' | 'noise'

function isActivityOscPayload(payload: string): boolean {
  if (payload === '0' || payload.startsWith('0;')) {
    return true
  }
  if (payload === '1' || payload.startsWith('1;')) {
    return true
  }
  if (payload === '2' || payload.startsWith('2;')) {
    return true
  }
  return payload.startsWith('9;4')
}

function isNotifyOscPayload(payload: string): boolean {
  // ConEmu / Windows Terminal: 9;4 progress, 9;9 cwd, 9;<digit> diğer kabuk dizileri.
  if (/^9;\d/.test(payload)) {
    return false
  }

  if (payload === '9' || payload.startsWith('9;')) {
    return true
  }

  if (payload === '99' || payload.startsWith('99;')) {
    return true
  }

  return payload === '777;notify' || payload.startsWith('777;notify;')
}

function consumeOsc(data: string, start: number): { end: number; payload: string } {
  let i = start + 2
  while (i < data.length) {
    const current = data.charCodeAt(i)
    if (current === 0x07) {
      return { end: i, payload: data.slice(start + 2, i) }
    }
    if (current === 0x1b && data.charCodeAt(i + 1) === 0x5c) {
      return { end: i + 1, payload: data.slice(start + 2, i) }
    }
    i++
  }

  return { end: data.length - 1, payload: data.slice(start + 2) }
}

function consumeCsi(data: string, start: number): number {
  let i = start + 2
  while (i < data.length) {
    const code = data.charCodeAt(i)
    if (code >= 0x40 && code <= 0x7e) {
      return i
    }
    i++
  }
  return data.length - 1
}

/**
 * Grok seçmeli soru / onay kartı turu bitirmez, BEL de göndermez.
 * Kart chrome'u görünür metin — 3 sn sessizlik yedeği TUI çiziminden asla dolmaz.
 */
export function looksLikeBlockingPrompt(data: string): boolean {
  if (data.includes('Type your answer here')) {
    return true
  }
  if (data.includes('Always allow on all sessions')) {
    return true
  }

  const navigateAt = data.indexOf('navigate')
  if (navigateAt !== -1) {
    // "↑/↓ navigate · y copy" — uzun proza sığmasın.
    const nearby = data.slice(navigateAt, navigateAt + 20)
    if (nearby.includes('copy')) {
      return true
    }
  }

  return false
}

/**
 * PTY parçasını dikkat makinesi için sınıflandırır.
 * BEL / OSC 9-99-777 / seçmeli kart → notify; metin → content; başlık/progress → activity; CSI/renk → noise.
 */
export function classifyPtyOutput(data: string): PtyOutputKind {
  if (looksLikeBlockingPrompt(data)) {
    return 'notify'
  }

  let hasNotify = false
  let hasContent = false
  let hasActivity = false
  let i = 0

  while (i < data.length) {
    const code = data.charCodeAt(i)

    if (code === 0x1b && data.charCodeAt(i + 1) === 0x5d) {
      const osc = consumeOsc(data, i)
      if (isNotifyOscPayload(osc.payload)) {
        hasNotify = true
      } else if (isActivityOscPayload(osc.payload)) {
        hasActivity = true
      }
      i = osc.end + 1
      continue
    }

    if (code === 0x1b && data.charCodeAt(i + 1) === 0x5b) {
      i = consumeCsi(data, i) + 1
      continue
    }

    if (code === 0x1b) {
      i += i + 1 >= data.length ? 1 : 2
      continue
    }

    if (code === 0x07) {
      hasNotify = true
      i++
      continue
    }

    if (code === 0x09 || code === 0x0a || code === 0x0d) {
      hasContent = true
      i++
      continue
    }

    if (code < 32) {
      i++
      continue
    }

    hasContent = true
    i++
  }

  if (hasNotify) {
    return 'notify'
  }
  if (hasContent) {
    return 'content'
  }
  if (hasActivity) {
    return 'activity'
  }
  return 'noise'
}
