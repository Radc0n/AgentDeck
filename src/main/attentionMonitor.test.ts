import { describe, expect, it } from 'vitest'
import {
  applyAttentionEvent,
  createAttentionContext,
  evaluateAttentionTimeout,
  stepAttentionMonitor
} from './attentionMonitor'

describe('attentionMonitor', () => {
  it('bell olayı needsAttention durumuna geçirir', () => {
    const ctx = createAttentionContext()

    const next = applyAttentionEvent(ctx, 'bell', 1_000)

    expect(next.state).toBe('needsAttention')
  })

  it('busy durumda çıktı zaman aşımı needsAttention üretir', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = applyAttentionEvent(ctx, 'output', 1_000)

    const next = evaluateAttentionTimeout(ctx, 32_000, { busyTimeoutMs: 30_000 })

    expect(next.state).toBe('needsAttention')
  })

  it('kullanıcı etkileşimi olmadan gelen çıktı idle kalır', () => {
    const ctx = createAttentionContext()

    const next = applyAttentionEvent(ctx, 'output', 1_000)

    expect(next.state).toBe('idle')
    expect(next.hasUserEngaged).toBe(false)
  })

  it('focus olayı dikkat durumunu temizler', () => {
    const needsAttention = applyAttentionEvent(createAttentionContext(), 'bell', 1_000)

    const next = applyAttentionEvent(needsAttention, 'focus', 2_000)

    expect(next).toEqual(createAttentionContext())
  })

  it('çıktı sonrası zaman aşımı ile tam akışı uygular', () => {
    let ctx = createAttentionContext()

    ctx = stepAttentionMonitor(ctx, 'userInput', 500, { busyTimeoutMs: 5_000 })
    ctx = stepAttentionMonitor(ctx, 'output', 1_000, { busyTimeoutMs: 5_000 })
    expect(ctx.state).toBe('busy')

    ctx = stepAttentionMonitor(ctx, null, 6_500, { busyTimeoutMs: 5_000 })
    expect(ctx.state).toBe('needsAttention')
  })

  it('focus sonrası zaman aşımı değerlendirmesi idle kalır', () => {
    let ctx = applyAttentionEvent(createAttentionContext(), 'bell', 1_000)
    ctx = applyAttentionEvent(ctx, 'focus', 2_000)

    const next = evaluateAttentionTimeout(ctx, 99_000, { busyTimeoutMs: 1_000 })

    expect(next.state).toBe('idle')
  })
})
