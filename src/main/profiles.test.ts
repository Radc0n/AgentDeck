import { describe, expect, it } from 'vitest'
import { resolveProfile } from './profiles'

const cwd = 'C:\\projeler\\agentdeck'

describe('resolveProfile', () => {
  it('Windows shell profilini powershell.exe olarak çözer', () => {
    const spec = resolveProfile('shell', { cwd, platform: 'win32' })

    expect(spec).toEqual({
      file: 'powershell.exe',
      args: [],
      cwd
    })
  })

  it('Unix shell profilini kabuk yolu olarak çözer', () => {
    const spec = resolveProfile('shell', { cwd, platform: 'linux' })

    expect(spec.file).toBeTruthy()
    expect(spec.args).toEqual([])
    expect(spec.cwd).toBe(cwd)
  })

  it('Windows claude profilini powershell üzerinden çalıştırır', () => {
    const spec = resolveProfile('claude', { cwd, platform: 'win32' })

    expect(spec).toEqual({
      file: 'powershell.exe',
      args: ['-NoLogo', '-Command', 'claude'],
      cwd
    })
  })

  it('Unix claude profilini kabuk üzerinden çalıştırır', () => {
    const spec = resolveProfile('claude', { cwd, platform: 'darwin' })

    expect(spec.args).toEqual(['-lc', 'claude'])
    expect(spec.cwd).toBe(cwd)
  })

  it('Windows cursor profilini powershell üzerinden cursor-agent çalıştırır', () => {
    const spec = resolveProfile('cursor', { cwd, platform: 'win32' })

    expect(spec).toEqual({
      file: 'powershell.exe',
      args: ['-NoLogo', '-Command', 'cursor-agent'],
      cwd
    })
  })

  it('Unix cursor profilini kabuk üzerinden çalıştırır', () => {
    const spec = resolveProfile('cursor', { cwd, platform: 'darwin' })

    expect(spec.args).toEqual(['-lc', 'cursor-agent'])
    expect(spec.cwd).toBe(cwd)
  })

  it('custom profilini verilen komutla kabuk üzerinden çözer', () => {
    const spec = resolveProfile('custom', {
      cwd,
      command: 'npm run dev',
      platform: 'win32'
    })

    expect(spec).toEqual({
      file: 'powershell.exe',
      args: ['-NoLogo', '-Command', 'npm run dev'],
      cwd
    })
  })

  it('custom profilde komut yoksa hata fırlatır', () => {
    expect(() => resolveProfile('custom', { cwd, platform: 'win32' })).toThrow(
      'Özel profil için komut gerekli.'
    )
  })
})
