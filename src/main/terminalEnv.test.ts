import { describe, expect, it } from 'vitest'
import { buildTerminalEnv } from './terminalEnv'

describe('buildTerminalEnv', () => {
  it('renk engelleyicileri kaldırır ve truecolor etkinleştirir', () => {
    const env = buildTerminalEnv()

    expect(env.NO_COLOR).toBeUndefined()
    expect(env.CI).toBeUndefined()
    expect(env.TERM).toBe('xterm-256color')
    expect(env.COLORTERM).toBe('truecolor')
    expect(env.FORCE_COLOR).toBe('3')
    expect(env.CLICOLOR_FORCE).toBe('1')
  })
})
