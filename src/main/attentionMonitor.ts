export type AttentionState = 'idle' | 'busy' | 'needsAttention'

export type AttentionEvent = 'output' | 'bell' | 'focus' | 'userInput'

export interface AttentionContext {
  state: AttentionState
  lastOutputAt: number | null
  /** Kullanıcı terminale yazdıktan sonra gelen çıktı "aktif oturum" sayılır. */
  hasUserEngaged: boolean
}

export interface AttentionConfig {
  busyTimeoutMs: number
}

export const DEFAULT_ATTENTION_CONFIG: AttentionConfig = {
  busyTimeoutMs: 30_000
}

export function createAttentionContext(): AttentionContext {
  return {
    state: 'idle',
    lastOutputAt: null,
    hasUserEngaged: false
  }
}

export function applyAttentionEvent(
  ctx: AttentionContext,
  event: AttentionEvent,
  now: number
): AttentionContext {
  switch (event) {
    case 'output':
      if (!ctx.hasUserEngaged && ctx.state === 'idle') {
        return ctx
      }
      return {
        ...ctx,
        state: 'busy',
        lastOutputAt: now
      }

    case 'userInput':
      if (ctx.state === 'needsAttention') {
        return ctx
      }
      return {
        ...ctx,
        state: 'busy',
        lastOutputAt: ctx.lastOutputAt ?? now,
        hasUserEngaged: true
      }

    case 'bell':
      return {
        ...ctx,
        state: 'needsAttention'
      }

    case 'focus':
      return createAttentionContext()

    default: {
      const exhaustive: never = event
      throw new Error(`Bilinmeyen dikkat olayı: ${exhaustive}`)
    }
  }
}

export function evaluateAttentionTimeout(
  ctx: AttentionContext,
  now: number,
  config: AttentionConfig = DEFAULT_ATTENTION_CONFIG
): AttentionContext {
  if (ctx.state !== 'busy' || ctx.lastOutputAt === null) {
    return ctx
  }

  if (now - ctx.lastOutputAt >= config.busyTimeoutMs) {
    return {
      ...ctx,
      state: 'needsAttention'
    }
  }

  return ctx
}

export function stepAttentionMonitor(
  ctx: AttentionContext,
  event: AttentionEvent | null,
  now: number,
  config: AttentionConfig = DEFAULT_ATTENTION_CONFIG
): AttentionContext {
  const afterEvent = event ? applyAttentionEvent(ctx, event, now) : ctx
  return evaluateAttentionTimeout(afterEvent, now, config)
}
