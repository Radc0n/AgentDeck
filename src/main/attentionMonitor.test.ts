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

  it('needsAttention iken gelen çıktı rozeti söndürmez', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = applyAttentionEvent(ctx, 'output', 1_000)
    ctx = evaluateAttentionTimeout(ctx, 12_000, { busyTimeoutMs: 10_000 })
    expect(ctx.state).toBe('needsAttention')

    const next = applyAttentionEvent(ctx, 'output', 13_000)

    expect(next.state).toBe('needsAttention')
  })

  it('odaklı terminalde sezgisel zaman aşımı rozet yakmaz', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = applyAttentionEvent(ctx, 'output', 1_000)

    const next = evaluateAttentionTimeout(
      ctx,
      12_000,
      { busyTimeoutMs: 10_000 },
      { suppressNotify: true }
    )

    expect(next.state).toBe('idle')
    expect(next.responseNotified).toBe(true)
    expect(next.hasUserEngaged).toBe(true)
  })

  it('zaman aşımı dolmadan busy kalır', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = applyAttentionEvent(ctx, 'output', 1_000)

    const next = evaluateAttentionTimeout(ctx, 5_000, { busyTimeoutMs: 10_000 })

    expect(next.state).toBe('busy')
  })

  it('focus needsAttention durumunu temizler ve soğuma zamanını yazar', () => {
    const needsAttention = applyAttentionEvent(createAttentionContext(), 'bell', 1_000)

    const next = applyAttentionEvent(needsAttention, 'focus', 2_000)

    expect(next).toEqual({
      ...createAttentionContext(),
      lastFocusAt: 2_000
    })
  })

  it('focus devam eden busy oturumunu korur', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = applyAttentionEvent(ctx, 'output', 1_000)

    const next = applyAttentionEvent(ctx, 'focus', 1_500)

    expect(next.state).toBe('busy')
    expect(next.hasUserEngaged).toBe(true)
    expect(next.lastUserInputAt).toBe(500)
    expect(next.lastFocusAt).toBe(1_500)
  })

  it('focus sonrası zaman aşımı değerlendirmesi idle kalır', () => {
    let ctx = applyAttentionEvent(createAttentionContext(), 'bell', 1_000)
    ctx = applyAttentionEvent(ctx, 'focus', 2_000)

    const next = evaluateAttentionTimeout(ctx, 99_000, { busyTimeoutMs: 1_000 })

    expect(next.state).toBe('idle')
  })

  it('odak soğumasında focus sonrası yazılan gerçek yanıt sayılır', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'focus', 1_000)
    ctx = applyAttentionEvent(ctx, 'userInput', 1_100)
    ctx = applyAttentionEvent(ctx, 'output', 1_400, { focusCooldownMs: 2_500 })

    expect(ctx.state).toBe('busy')
    expect(ctx.lastAgentOutputAt).toBe(1_400)
    expect(ctx.lastUserInputAt).toBe(1_100)
  })

  it('odak soğuması sırasındaki çıktı sahte ajan yanıtı sayılmaz', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = applyAttentionEvent(ctx, 'output', 800)
    ctx = applyAttentionEvent(ctx, 'focus', 1_000)

    const duringCooldown = applyAttentionEvent(ctx, 'output', 1_200, {
      focusCooldownMs: 2_500
    })

    expect(duringCooldown.state).toBe('busy')
    expect(duringCooldown.lastAgentOutputAt).toBe(800)
    expect(duringCooldown.lastOutputAt).toBe(1_200)
  })

  it('sekmeden dönünce odak soğuması + suppressNotify hayalet rozet üretmez', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 100)
    ctx = applyAttentionEvent(ctx, 'output', 200)
    ctx = applyAttentionEvent(ctx, 'focus', 10_000)
    ctx = applyAttentionEvent(ctx, 'output', 10_100, { focusCooldownMs: 2_500 })

    const next = evaluateAttentionTimeout(
      ctx,
      21_000,
      { busyTimeoutMs: 10_000 },
      { suppressNotify: true }
    )

    expect(next.state).toBe('idle')
  })
})
