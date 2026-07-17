import { describe, expect, it } from 'vitest'
import {
  applyAttentionEvent,
  createAttentionContext,
  evaluateAttentionTimeout
} from './attentionMonitor'

describe('attentionMonitor', () => {
  it('bell olayı needsAttention durumuna geçirir', () => {
    const ctx = createAttentionContext()

    const next = applyAttentionEvent(ctx, 'bell', 1_000)

    expect(next.state).toBe('needsAttention')
    expect(next.responseNotified).toBe(true)
  })

  it('kullanıcı etkileşimi olmadan gelen çıktı idle kalır', () => {
    const ctx = createAttentionContext()

    const next = applyAttentionEvent(ctx, 'output', 1_000)

    expect(next.state).toBe('idle')
    expect(next.hasUserEngaged).toBe(false)
  })

  it('kullanıcı yazdıktan sonra ajan yanıt verirse zaman aşımı needsAttention üretir', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = applyAttentionEvent(ctx, 'output', 1_000)

    const next = evaluateAttentionTimeout(ctx, 12_000, { busyTimeoutMs: 10_000 })

    expect(next.state).toBe('needsAttention')
    expect(next.responseNotified).toBe(true)
  })

  it('kullanıcı yazdı ama ajan yanıt vermediyse zaman aşımı idle döner', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)

    const next = evaluateAttentionTimeout(ctx, 12_000, { busyTimeoutMs: 10_000 })

    expect(next.state).toBe('idle')
    expect(next.hasUserEngaged).toBe(false)
  })

  it('bildirim gösterildikten sonra tekrar zaman aşımı needsAttention üretmez', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = applyAttentionEvent(ctx, 'output', 1_000)
    ctx = evaluateAttentionTimeout(ctx, 12_000, { busyTimeoutMs: 10_000 })
    expect(ctx.state).toBe('needsAttention')

    ctx = applyAttentionEvent(ctx, 'output', 13_000)
    const next = evaluateAttentionTimeout(ctx, 24_000, { busyTimeoutMs: 10_000 })

    expect(next.state).toBe('idle')
    expect(next.responseNotified).toBe(false)
  })

  it('zaman aşımı dolmadan busy kalır', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = applyAttentionEvent(ctx, 'output', 1_000)

    const next = evaluateAttentionTimeout(ctx, 5_000, { busyTimeoutMs: 10_000 })

    expect(next.state).toBe('busy')
  })

  it('focus needsAttention durumunu temizler', () => {
    const needsAttention = applyAttentionEvent(createAttentionContext(), 'bell', 1_000)

    const next = applyAttentionEvent(needsAttention, 'focus', 2_000)

    expect(next).toEqual(createAttentionContext())
  })

  it('focus devam eden busy oturumunu korur', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = applyAttentionEvent(ctx, 'output', 1_000)

    const next = applyAttentionEvent(ctx, 'focus', 1_500)

    expect(next.state).toBe('busy')
    expect(next.hasUserEngaged).toBe(true)
    expect(next.lastUserInputAt).toBe(500)
  })

  it('focus sonrası zaman aşımı değerlendirmesi idle kalır', () => {
    let ctx = applyAttentionEvent(createAttentionContext(), 'bell', 1_000)
    ctx = applyAttentionEvent(ctx, 'focus', 2_000)

    const next = evaluateAttentionTimeout(ctx, 99_000, { busyTimeoutMs: 1_000 })

    expect(next.state).toBe('idle')
  })
})
