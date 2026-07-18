import { describe, expect, it, afterEach } from 'vitest'
import { hasTerminal, kill, resetPtyManagerForTests } from './ptyManager'

describe('ptyManager.kill', () => {
  afterEach(() => {
    resetPtyManagerForTests()
  })

  it('zaten ölmüş terminal için hata fırlatmaz (idempotent)', () => {
    expect(hasTerminal('ghost-id')).toBe(false)
    expect(() => kill('ghost-id')).not.toThrow()
  })
})
