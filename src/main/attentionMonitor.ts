export type AttentionState = 'idle' | 'busy' | 'needsAttention'

export type AttentionEvent = 'output' | 'bell' | 'focus' | 'userInput'

export interface AttentionContext {
  state: AttentionState
  /** Son ajan çıktısı zamanı; sessizlik ölçümü yalnızca buna dayanır. */
  lastOutputAt: number | null
  /** Son kullanıcı girdisi zamanı. */
  lastUserInputAt: number | null
  /** Son ajan çıktısı zamanı (userInput ile karıştırılmaz). */
  lastAgentOutputAt: number | null
  /** Kullanıcı terminale yazdıktan sonra gelen çıktı "aktif oturum" sayılır. */
  hasUserEngaged: boolean
  /** Bu oturumda yanıt bildirimi gösterildi mi (focus ile sıfırlanır). */
  responseNotified: boolean
}

export interface AttentionConfig {
  /** Ajan yanıt verdikten sonra bu süre boyunca çıktı gelmezse bildirim yanar. */
  busyTimeoutMs: number
}

export const DEFAULT_ATTENTION_CONFIG: AttentionConfig = {
  busyTimeoutMs: 10_000
}

export function createAttentionContext(): AttentionContext {
  return {
    state: 'idle',
    lastOutputAt: null,
    lastUserInputAt: null,
    lastAgentOutputAt: null,
    hasUserEngaged: false,
    responseNotified: false
  }
}

function agentRespondedAfterUserInput(ctx: AttentionContext): boolean {
  return (
    ctx.lastUserInputAt !== null &&
    ctx.lastAgentOutputAt !== null &&
    ctx.lastAgentOutputAt >= ctx.lastUserInputAt
  )
}

export function dismissAttention(ctx: AttentionContext): AttentionContext {
  if (ctx.state === 'needsAttention') {
    return createAttentionContext()
  }
  return ctx
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
        lastOutputAt: now,
        lastAgentOutputAt: now
      }

    case 'userInput':
      return {
        ...ctx,
        state: 'busy',
        lastUserInputAt: now,
        hasUserEngaged: true,
        responseNotified: false
      }

    case 'bell':
      return {
        ...ctx,
        state: 'needsAttention',
        responseNotified: true
      }

    case 'focus':
      return dismissAttention(ctx)

    default: {
      const exhaustive: never = event
      throw new Error(`Bilinmeyen dikkat olayı: ${exhaustive}`)
    }
  }
}

/**
 * Busy oturumda ajan çıktısı sustuğunda:
 * - Kullanıcı yazdıktan sonra gerçek ajan çıktısı geldiyse → needsAttention (bir kez)
 * - Ajan hiç yanıt vermediyse veya bildirim zaten gösterildiyse → idle
 */
export function evaluateAttentionTimeout(
  ctx: AttentionContext,
  now: number,
  config: AttentionConfig = DEFAULT_ATTENTION_CONFIG
): AttentionContext {
  if (ctx.state !== 'busy') {
    return ctx
  }

  const silenceAnchor = ctx.lastOutputAt ?? ctx.lastUserInputAt
  if (silenceAnchor === null) {
    return ctx
  }

  if (now - silenceAnchor < config.busyTimeoutMs) {
    return ctx
  }

  if (agentRespondedAfterUserInput(ctx) && !ctx.responseNotified) {
    return {
      ...ctx,
      state: 'needsAttention',
      responseNotified: true
    }
  }

  return createAttentionContext()
}
