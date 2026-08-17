import { describe, expect, it } from 'vitest'
import {
  applyAttentionEvent,
  applyCliNotify,
  createAttentionContext,
  evaluateAttentionTimeout,
  isFocusedCompletion
} from './attentionMonitor'

describe('attentionMonitor', () => {
  it('kullanıcı etkileşimi olmadan bell yok sayılır', () => {
    const ctx = createAttentionContext()

    const next = applyAttentionEvent(ctx, 'bell', 1_000)

    expect(next).toEqual(ctx)
    expect(next.state).toBe('idle')
  })

  it('kullanıcı yazdıktan sonra bell needsAttention durumuna geçirir', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)

    const next = applyAttentionEvent(ctx, 'bell', 1_000)

    expect(next.state).toBe('needsAttention')
    expect(next.responseNotified).toBe(true)
  })

  it('bu tur zaten bildirildiyse bell tekrar yakmaz', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = applyAttentionEvent(ctx, 'output', 1_000)
    ctx = evaluateAttentionTimeout(
      ctx,
      12_000,
      { busyTimeoutMs: 10_000 },
      { suppressNotify: true }
    )
    expect(ctx.responseNotified).toBe(true)

    const next = applyAttentionEvent(ctx, 'bell', 13_000)

    expect(next.state).toBe('idle')
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
    expect(isFocusedCompletion(ctx, next)).toBe(false)
  })

  it('kullanıcı yazdı ama ajan yanıt vermediyse zaman aşımı idle döner', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)

    const next = evaluateAttentionTimeout(ctx, 12_000, { busyTimeoutMs: 10_000 })

    expect(next.state).toBe('idle')
    expect(next.hasUserEngaged).toBe(true)
    expect(next.lastUserInputAt).toBe(500)
    expect(isFocusedCompletion(ctx, next)).toBe(false)
  })

  it('ajan geç yanıt verirse ilk token ve sonraki bell hâlâ sayılır', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = evaluateAttentionTimeout(ctx, 12_000, { busyTimeoutMs: 10_000 })
    expect(ctx.state).toBe('idle')
    expect(ctx.hasUserEngaged).toBe(true)

    ctx = applyAttentionEvent(ctx, 'output', 13_000)
    expect(ctx.state).toBe('busy')
    expect(ctx.lastAgentOutputAt).toBe(13_000)

    const notified = applyAttentionEvent(ctx, 'bell', 13_100)
    expect(notified.state).toBe('needsAttention')
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
    expect(isFocusedCompletion(ctx, next)).toBe(true)
  })

  it('zaman aşımı dolmadan busy kalır', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = applyAttentionEvent(ctx, 'output', 1_000)

    const next = evaluateAttentionTimeout(ctx, 5_000, { busyTimeoutMs: 10_000 })

    expect(next.state).toBe('busy')
  })

  it('odaklı CLI notify rozet yakmaz ama bell çalar', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)

    const { context, ring } = applyCliNotify(ctx, { suppressNotify: true })

    expect(ring).toBe(true)
    expect(context.state).toBe('idle')
    expect(context.responseNotified).toBe(true)
  })

  it('oturum açılış notify bell çalmaz', () => {
    const { context, ring } = applyCliNotify(createAttentionContext())

    expect(ring).toBe(false)
    expect(context.state).toBe('idle')
  })

  it('focus needsAttention durumunu temizler ve soğuma zamanını yazar', () => {
    let needsAttention = createAttentionContext()
    needsAttention = applyAttentionEvent(needsAttention, 'userInput', 400)
    needsAttention = applyAttentionEvent(needsAttention, 'bell', 1_000)

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
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 400)
    ctx = applyAttentionEvent(ctx, 'bell', 1_000)
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

  it('varsayılan 3 sn sessizlikten sonra needsAttention üretir', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = applyAttentionEvent(ctx, 'output', 1_000)

    expect(evaluateAttentionTimeout(ctx, 3_500).state).toBe('busy')
    expect(evaluateAttentionTimeout(ctx, 4_000).state).toBe('needsAttention')
  })

  it('activity sessizlik saatini yeniler ama ajan yanıtı sayılmaz', () => {
    let ctx = createAttentionContext()
    ctx = applyAttentionEvent(ctx, 'userInput', 500)
    ctx = applyAttentionEvent(ctx, 'output', 1_000)
    ctx = applyAttentionEvent(ctx, 'activity', 3_500)

    expect(ctx.state).toBe('busy')
    expect(ctx.lastOutputAt).toBe(3_500)
    expect(ctx.lastAgentOutputAt).toBe(1_000)
    expect(evaluateAttentionTimeout(ctx, 5_500).state).toBe('busy')
    expect(evaluateAttentionTimeout(ctx, 6_500).state).toBe('needsAttention')
  })

  it('idle iken activity yok sayılır', () => {
    const ctx = createAttentionContext()
    const next = applyAttentionEvent(ctx, 'activity', 1_000)
    expect(next).toEqual(ctx)
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
