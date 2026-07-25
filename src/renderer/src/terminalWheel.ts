import type { Terminal } from '@xterm/xterm'

/**
 * Tekerlek politikası.
 *
 * Mouse-tracking modu (`CSI ? 1000/1002/1003 h`) açıkken xterm varsayılanı tekerleği
 * escape dizisi olarak uygulamaya iletir; uygulama bunu işlemezse scroll hiç çalışmaz.
 * Windows Terminal / iTerm davranışı ise şudur: **normal buffer'da scrollback
 * terminalindir**, tracking ne derse desin.
 *
 * Alternatif buffer'a (`CSI ? 1049 h`) DOKUNULMAZ. Orada scrollback zaten yoktur ve
 * tekerleği ok tuşuna çevirmek — standart "alternate scroll" davranışı olsa da —
 * Grok gibi ok tuşlarını mesaj geçmişi için kullanan TUI'leri bozar.
 */

export type MouseTrackingMode = 'none' | 'x10' | 'vt200' | 'drag' | 'any'
export type BufferType = 'normal' | 'alternate'

export interface WheelContext {
  shiftKey: boolean
  deltaY: number
  /** WheelEvent.deltaMode — 0: piksel, 1: satır, 2: sayfa */
  deltaMode: number
  mouseTrackingMode: MouseTrackingMode
  bufferType: BufferType
  /** Piksel deltasını satıra çevirmek için hücre yüksekliği (px) */
  cellHeight: number
  /** Sayfa deltası için görünür satır sayısı */
  rows: number
}

export type WheelAction = { kind: 'forward' } | { kind: 'scroll'; lines: number }

const DELTA_MODE_PIXEL = 0
const DELTA_MODE_LINE = 1
const DELTA_MODE_PAGE = 2

/** Hücre yüksekliği ölçülemezse: fontSize 13 × lineHeight 1.2 ≈ 16 */
const FALLBACK_CELL_HEIGHT = 16

/** Tekerlek deltasını satır sayısına çevirir. İşaret korunur, büyüklük en az 1'dir. */
export function wheelLines(ctx: WheelContext): number {
  if (ctx.deltaY === 0) {
    return 0
  }

  const cellHeight = ctx.cellHeight > 0 ? ctx.cellHeight : FALLBACK_CELL_HEIGHT
  const rows = ctx.rows > 0 ? ctx.rows : 1

  let raw: number
  switch (ctx.deltaMode) {
    case DELTA_MODE_LINE:
      raw = ctx.deltaY
      break
    case DELTA_MODE_PAGE:
      raw = ctx.deltaY * rows
      break
    case DELTA_MODE_PIXEL:
    default:
      raw = ctx.deltaY / cellHeight
      break
  }

  const magnitude = Math.max(1, Math.round(Math.abs(raw)))
  return raw < 0 ? -magnitude : magnitude
}

export function decideWheelAction(ctx: WheelContext): WheelAction {
  // Dikey hareket yoksa (yatay scroll, jest) xterm kendi bilsin.
  if (ctx.deltaY === 0) {
    return { kind: 'forward' }
  }

  // Kaçış kapısı: kullanıcı bilerek uygulamaya iletmek istiyor.
  if (ctx.shiftKey) {
    return { kind: 'forward' }
  }

  // Tracking kapalıyken xterm zaten viewport'u kaydırıyor — karışma.
  if (ctx.mouseTrackingMode === 'none') {
    return { kind: 'forward' }
  }

  // Alternatif buffer: scrollback yok, uygulama kendi bilsin. Karışmak Grok'ta
  // mesaj geçmişinde gezinmeye yol açıyor.
  if (ctx.bufferType === 'alternate') {
    return { kind: 'forward' }
  }

  // Normal buffer: scrollback terminalindir.
  return { kind: 'scroll', lines: wheelLines(ctx) }
}

function measureCellHeight(terminal: Terminal): number {
  const rowsEl = terminal.element?.querySelector('.xterm-rows')
  if (!(rowsEl instanceof HTMLElement) || terminal.rows <= 0) {
    return FALLBACK_CELL_HEIGHT
  }
  const height = rowsEl.getBoundingClientRect().height
  return height > 0 ? height / terminal.rows : FALLBACK_CELL_HEIGHT
}

/** xterm örneğine tekerlek politikasını bağlar. */
export function installWheelPolicy(terminal: Terminal): void {
  terminal.attachCustomWheelEventHandler((event) => {
    const action = decideWheelAction({
      shiftKey: event.shiftKey,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      mouseTrackingMode: terminal.modes.mouseTrackingMode,
      bufferType: terminal.buffer.active.type,
      cellHeight: measureCellHeight(terminal),
      rows: terminal.rows
    })

    if (action.kind === 'forward') {
      return true
    }

    terminal.scrollLines(action.lines)
    // xterm işlemesin: tekerlek uygulamaya escape dizisi olarak gitmemeli.
    return false
  })
}
