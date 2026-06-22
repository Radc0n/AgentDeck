import { describe, expect, it } from 'vitest'
import { containsRealBell } from './bellDetect'

describe('containsRealBell', () => {
  it('OSC başlık sonlandırıcısındaki BEL gerçek bell sayılmaz', () => {
    expect(containsRealBell('\x1b]0;claude\x07')).toBe(false)
    expect(containsRealBell('\x1b]0;✳ Claude Code\x07')).toBe(false)
    expect(containsRealBell('\x1b]104;255\x07')).toBe(false)
  })

  it('yalnız BEL gerçek bell sayılır', () => {
    expect(containsRealBell('\x07')).toBe(true)
    expect(containsRealBell('done\x07')).toBe(true)
  })

  it('OSC sonrası ayrı BEL gerçek bell sayılır', () => {
    expect(containsRealBell('\x1b]0;title\x07\x07')).toBe(true)
  })
})
