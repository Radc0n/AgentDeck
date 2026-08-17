import { describe, expect, it } from 'vitest'
import { isEngagingUserInput, isTurnStartingInput } from './terminalInput'

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

describe('isTurnStartingInput', () => {
  it('ok ve tab yeni tur sayılmaz', () => {
    expect(isTurnStartingInput('\x1b[A')).toBe(false)
    expect(isTurnStartingInput('\x1b[B')).toBe(false)
    expect(isTurnStartingInput('\x1b[C')).toBe(false)
    expect(isTurnStartingInput('\x1b[D')).toBe(false)
    expect(isTurnStartingInput('\t')).toBe(false)
    expect(isTurnStartingInput('\x1b[Z')).toBe(false)
    expect(isTurnStartingInput('\x1b')).toBe(false)
  })

  it('yazı, rakam ve enter yeni tur sayılır', () => {
    expect(isTurnStartingInput('hello')).toBe(true)
    expect(isTurnStartingInput('1')).toBe(true)
    expect(isTurnStartingInput('\r')).toBe(true)
    expect(isTurnStartingInput('\x7f')).toBe(true)
  })

  it('odak ve mouse hâlâ yok sayılır', () => {
    expect(isTurnStartingInput('\x1b[I')).toBe(false)
    expect(isTurnStartingInput('\x1b[<0;12;8M')).toBe(false)
  })
})
