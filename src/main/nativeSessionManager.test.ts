import { describe, expect, it } from 'vitest'
import { applyWindowTitle } from './nativeSessionManager'

describe('applyWindowTitle', () => {
  it('Windows PowerShell boş args için başlık komutu ekler', () => {
    if (process.platform !== 'win32') {
      return
    }

    const next = applyWindowTitle(
      { file: 'powershell.exe', args: [], cwd: 'C:\\tmp' },
      'AgentDeck · Claude 1'
    )

    expect(next.args[0]).toBe('-NoLogo')
    expect(next.args).toContain('-NoExit')
    expect(next.args.at(-1)).toContain("WindowTitle = 'AgentDeck · Claude 1'")
  })

  it('Windows PowerShell -Command önüne başlık atar', () => {
    if (process.platform !== 'win32') {
      return
    }

    const next = applyWindowTitle(
      {
        file: 'powershell.exe',
        args: ['-NoLogo', '-Command', 'claude'],
        cwd: 'C:\\tmp'
      },
      "Grok's Terminal"
    )

    expect(next.args[1]).toBe('-Command')
    expect(next.args[2]).toBe(
      "$Host.UI.RawUI.WindowTitle = 'Grok''s Terminal'; claude"
    )
  })

  it('başlık yoksa spec değişmez', () => {
    const spec = { file: 'powershell.exe', args: ['-NoLogo'], cwd: 'C:\\tmp' }
    expect(applyWindowTitle(spec, undefined)).toEqual(spec)
  })
})
