import { describe, expect, it } from 'vitest'
import {
  resolveWindowsNotifyWav,
  resolveWindowsPowerShell,
  windowsAttentionSoundCommand,
  windowsAttentionSoundSpawn
} from './attentionSound'

describe('resolveWindowsNotifyWav', () => {
  it('ilk var olan Windows bildirim wav dosyasını seçer', () => {
    const exists = (path: string): boolean => path.endsWith('Windows Notify.wav')
    expect(resolveWindowsNotifyWav('C:\\Windows', exists)).toBe(
      'C:\\Windows\\Media\\Windows Notify.wav'
    )
  })

  it('hiçbir aday yoksa null döner', () => {
    expect(resolveWindowsNotifyWav('C:\\Windows', () => false)).toBeNull()
  })
})

describe('windowsAttentionSoundCommand', () => {
  it('wav varsa SoundPlayer PlaySync kullanır (süreç bitince ses kesilmesin)', () => {
    const command = windowsAttentionSoundCommand('C:\\Windows\\Media\\Windows Notify.wav')
    expect(command).toContain('System.Media.SoundPlayer')
    expect(command).toContain('PlaySync()')
    expect(command).toContain('C:\\Windows\\Media\\Windows Notify.wav')
  })

  it('PowerShell tek tırnağını kaçırır', () => {
    expect(windowsAttentionSoundCommand("C:\\O'Brian\\notify.wav")).toContain(
      "C:\\O''Brian\\notify.wav"
    )
  })

  it('wav yoksa sistem Asterisk sesine düşer', () => {
    const command = windowsAttentionSoundCommand(null)
    expect(command).toContain('SystemSounds')
    expect(command).toContain('Asterisk')
  })

  it('AgentDeck.exe / process.execPath kullanmaz', () => {
    expect(windowsAttentionSoundCommand('C:\\a.wav')).not.toMatch(/AgentDeck|execPath/i)
    expect(windowsAttentionSoundCommand(null)).not.toMatch(/AgentDeck|execPath/i)
  })
})

describe('windowsAttentionSoundSpawn', () => {
  it('System32 PowerShell yolunu kullanır, AgentDeck.exe değil', () => {
    const spec = windowsAttentionSoundSpawn('C:\\Windows', () => true)
    expect(spec.file).toBe(resolveWindowsPowerShell('C:\\Windows'))
    expect(spec.file).toMatch(/WindowsPowerShell\\v1\.0\\powershell\.exe$/i)
    expect(spec.file).not.toMatch(/AgentDeck/i)
    expect(spec.args).toContain('-Command')
  })
})
