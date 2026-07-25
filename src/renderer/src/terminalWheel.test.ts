import { describe, expect, it } from 'vitest'
import { decideWheelAction, wheelLines, type WheelContext } from './terminalWheel'

/** Grok benzeri TUI: mouse-tracking açık, normal buffer, piksel delta. */
function ctx(overrides: Partial<WheelContext> = {}): WheelContext {
  return {
    shiftKey: false,
    deltaY: 100,
    deltaMode: 0,
    mouseTrackingMode: 'drag',
    bufferType: 'normal',
    cellHeight: 20,
    rows: 30,
    ...overrides
  }
}

describe('wheelLines', () => {
  it('piksel deltasını hücre yüksekliğine böler', () => {
    expect(wheelLines(ctx({ deltaY: 100, deltaMode: 0, cellHeight: 20 }))).toBe(5)
    expect(wheelLines(ctx({ deltaY: -100, deltaMode: 0, cellHeight: 20 }))).toBe(-5)
  })

  it('satır deltasını olduğu gibi kullanır', () => {
    expect(wheelLines(ctx({ deltaY: 3, deltaMode: 1 }))).toBe(3)
    expect(wheelLines(ctx({ deltaY: -3, deltaMode: 1 }))).toBe(-3)
  })

  it('sayfa deltasını görünür satır sayısıyla çarpar', () => {
    expect(wheelLines(ctx({ deltaY: 1, deltaMode: 2, rows: 30 }))).toBe(30)
    expect(wheelLines(ctx({ deltaY: -2, deltaMode: 2, rows: 30 }))).toBe(-60)
  })

  it('çok küçük delta bile en az bir satır kaydırır', () => {
    expect(wheelLines(ctx({ deltaY: 1, deltaMode: 0, cellHeight: 20 }))).toBe(1)
    expect(wheelLines(ctx({ deltaY: -1, deltaMode: 0, cellHeight: 20 }))).toBe(-1)
  })

  it('sıfır delta sıfır satırdır', () => {
    expect(wheelLines(ctx({ deltaY: 0 }))).toBe(0)
  })

  it('hücre yüksekliği ölçülemezse yedek değere düşer', () => {
    expect(wheelLines(ctx({ deltaY: 160, deltaMode: 0, cellHeight: 0 }))).toBe(10)
  })
})

describe('decideWheelAction', () => {
  it('normal buffer + tracking açıkken viewport kaydırılır (asıl düzeltme)', () => {
    // Grok senaryosu: tracking açık olmasına rağmen scrollback terminalindir.
    expect(decideWheelAction(ctx({ deltaY: -100 }))).toEqual({ kind: 'scroll', lines: -5 })
    expect(decideWheelAction(ctx({ deltaY: 100 }))).toEqual({ kind: 'scroll', lines: 5 })
  })

  it('Shift basılıyken olay uygulamaya iletilir (kaçış kapısı)', () => {
    expect(decideWheelAction(ctx({ shiftKey: true }))).toEqual({ kind: 'forward' })
  })

  it('tracking kapalıyken xterm varsayılanına dokunulmaz', () => {
    expect(decideWheelAction(ctx({ mouseTrackingMode: 'none' }))).toEqual({ kind: 'forward' })
  })

  it('dikey hareket yoksa xterm varsayılanına dokunulmaz', () => {
    expect(decideWheelAction(ctx({ deltaY: 0 }))).toEqual({ kind: 'forward' })
  })

  // Regresyon: alt buffer'da ok tuşu üretmek Grok'ta mesaj geçmişinde gezinmeye
  // yol açtı. Alternatif buffer'a asla karışılmaz.
  it('alternatif bufferda olay uygulamaya iletilir, ok tuşu üretilmez', () => {
    expect(decideWheelAction(ctx({ bufferType: 'alternate', deltaY: -60 }))).toEqual({
      kind: 'forward'
    })
    expect(decideWheelAction(ctx({ bufferType: 'alternate', deltaY: 60 }))).toEqual({
      kind: 'forward'
    })
  })

  it('tracking açık x10 modunda da normal buffer kaydırılır', () => {
    expect(decideWheelAction(ctx({ mouseTrackingMode: 'x10', deltaY: -100 }))).toEqual({
      kind: 'scroll',
      lines: -5
    })
  })
})
