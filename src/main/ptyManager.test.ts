import { describe, expect, it, afterEach } from 'vitest'
import {
  hasTerminal,
  kill,
  ptyBackendOptions,
  resetPtyManagerForTests
} from './ptyManager'

describe('ptyManager.kill', () => {
  afterEach(() => {
    resetPtyManagerForTests()
  })

  it('zaten ölmüş terminal için hata fırlatmaz (idempotent)', () => {
    expect(hasTerminal('ghost-id')).toBe(false)
    expect(() => kill('ghost-id')).not.toThrow()
  })
})

describe('ptyBackendOptions', () => {
  it('Windows’ta ConPTY DLL kullanır (kill sırasında fork/yeni pencere olmasın)', () => {
    expect(ptyBackendOptions('win32')).toEqual({
      useConpty: true,
      useConptyDll: true
    })
  })

  it('Windows dışında ConPTY seçenekleri göndermez', () => {
    expect(ptyBackendOptions('darwin')).toEqual({})
    expect(ptyBackendOptions('linux')).toEqual({})
  })
})
