export type AttentionState = 'idle' | 'busy' | 'needsAttention'

export type AttentionEvent = 'output' | 'activity' | 'bell' | 'focus' | 'userInput'

export interface AttentionContext {
  state: AttentionState
  /** Sessizlik saati (ajan çıktısı veya soğumadaki TUI gürültüsü). */
  lastOutputAt: number | null
  /** Son kullanıcı girdisi zamanı. */
  lastUserInputAt: number | null
  /** Son ajan çıktısı zamanı (userInput ile karıştırılmaz). */
  lastAgentOutputAt: number | null
  /** Kullanıcı terminale yazdıktan sonra gelen çıktı "aktif oturum" sayılır. */
  hasUserEngaged: boolean
  /** Bu oturumda yanıt bildirimi gösterildi mi (focus ile sıfırlanır). */
  responseNotified: boolean
  /** Son odak zamanı; sekme dönüşündeki TUI yeniden çizimini yoksaymak için. */
  lastFocusAt: number | null
}

export interface AttentionConfig {
  /** Ajan yanıt verdikten sonra bu süre boyunca çıktı gelmezse bildirim yanar. */
  busyTimeoutMs: number
  /** Odak sonrası TUI gürültüsünün yeni tur sayılmayacağı süre. */
  focusCooldownMs: number
}

export interface AttentionTimeoutOptions {
  /** Kullanıcı bu terminale bakıyorsa sezgisel rozet üretilmesin. */
  suppressNotify?: boolean
}

export const DEFAULT_ATTENTION_CONFIG: AttentionConfig = {
  busyTimeoutMs: 3_000,
  focusCooldownMs: 2_500
}

export function createAttentionContext(): AttentionContext {
  return {
    state: 'idle',
    lastOutputAt: null,
    lastUserInputAt: null,
    lastAgentOutputAt: null,
    hasUserEngaged: false,
    responseNotified: false,
    lastFocusAt: null
  }
}

function resolveConfig(config: Partial<AttentionConfig> = {}): AttentionConfig {
  return {
    ...DEFAULT_ATTENTION_CONFIG,
    ...config
  }
}

function agentRespondedAfterUserInput(ctx: AttentionContext): boolean {
  return (
    ctx.lastUserInputAt !== null &&
    ctx.lastAgentOutputAt !== null &&
    ctx.lastAgentOutputAt >= ctx.lastUserInputAt
  )
}

function inFocusCooldown(
  ctx: AttentionContext,
  now: number,
  config: AttentionConfig
): boolean {
  return ctx.lastFocusAt !== null && now - ctx.lastFocusAt < config.focusCooldownMs
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
  now: number,
  config: Partial<AttentionConfig> = {}
): AttentionContext {
  const resolved = resolveConfig(config)

  switch (event) {
    case 'output':
      if (ctx.state === 'needsAttention') {
        return ctx
      }
      if (!ctx.hasUserEngaged && ctx.state === 'idle') {
        return ctx
      }
      if (inFocusCooldown(ctx, now, resolved)) {
        const typedAfterFocus =
          ctx.lastUserInputAt !== null &&
          ctx.lastFocusAt !== null &&
          ctx.lastUserInputAt >= ctx.lastFocusAt
        if (!typedAfterFocus) {
          if (ctx.state === 'busy') {
            return {
              ...ctx,
              lastOutputAt: now
            }
          }
          return ctx
        }
      }
      return {
        ...ctx,
        state: 'busy',
        lastOutputAt: now,
        lastAgentOutputAt: now
      }

    case 'activity':
      // Başlık / progress: ajan hâlâ canlı. Yeni tur sayılmaz, sessizlik saati yenilenir.
      if (ctx.state !== 'busy') {
        return ctx
      }
      return {
        ...ctx,
        lastOutputAt: now
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

    case 'focus': {
      const dismissed = dismissAttention(ctx)
      return {
        ...dismissed,
        lastFocusAt: now
      }
    }

    default: {
      const exhaustive: never = event
      throw new Error(`Bilinmeyen dikkat olayı: ${exhaustive}`)
    }
  }
}

/**
 * Busy oturumda ajan çıktısı sustuğunda:
 * - Kullanıcı yazdıktan sonra gerçek ajan çıktısı geldiyse → needsAttention (bir kez)
 * - Kullanıcı o terminale bakıyorsa → idle (gördü sayılır)
 * - Ajan hiç yanıt vermediyse veya bildirim zaten gösterildiyse → idle
 */
export function evaluateAttentionTimeout(
  ctx: AttentionContext,
  now: number,
  config: Partial<AttentionConfig> = {},
  options: AttentionTimeoutOptions = {}
): AttentionContext {
  const resolved = resolveConfig(config)

  if (ctx.state !== 'busy') {
    return ctx
  }

  const silenceAnchor = ctx.lastOutputAt ?? ctx.lastUserInputAt
  if (silenceAnchor === null) {
    return ctx
  }

  if (now - silenceAnchor < resolved.busyTimeoutMs) {
    return ctx
  }

  if (agentRespondedAfterUserInput(ctx) && !ctx.responseNotified) {
    if (options.suppressNotify) {
      return {
        ...ctx,
        state: 'idle',
        responseNotified: true
      }
    }

    return {
      ...ctx,
      state: 'needsAttention',
      responseNotified: true
    }
  }

  return createAttentionContext()
}
