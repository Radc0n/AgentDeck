import { describe, expect, it } from 'vitest'
import { isEngagingUserInput } from './terminalInput'

describe('isEngagingUserInput', () => {
  it('odak raporlarını yok sayar', () => {
    expect(isEngagingUserInput('\x1b[I')).toBe(false)
    expect(isEngagingUserInput('\x1b[O')).toBe(false)
  })

  it('SGR ve X10 mouse olaylarını yok sayar', () => {
    expect(isEngagingUserInput('\x1b[<0;12;8M')).toBe(false)
    expect(isEngagingUserInput('\x1b[<0;12;8m')).toBe(false)
    expect(isEngagingUserInput('\x1b[Mabc')).toBe(false)
  })

  it('yalnızca bracketed paste işaretçisini yok sayar', () => {
    expect(isEngagingUserInput('\x1b[200~\x1b[201~')).toBe(false)
    expect(isEngagingUserInput('\x1b[200~hello\x1b[201~')).toBe(true)
  })

  it('gerçek yazı ve denetim tuşlarını sayar', () => {
    expect(isEngagingUserInput('hello')).toBe(true)
    expect(isEngagingUserInput('\r')).toBe(true)
    expect(isEngagingUserInput('\x7f')).toBe(true)
    expect(isEngagingUserInput('\x1b[A')).toBe(true)
  })

  it('protokol + metin karışımında metni sayar', () => {
    expect(isEngagingUserInput('\x1b[Ihello')).toBe(true)
  })

  it('boş girdiyi yok sayar', () => {
    expect(isEngagingUserInput('')).toBe(false)
  })
})
