import { describe, expect, it } from 'vitest'
import {
  GROK_NOTIFY_MARKER,
  grokConfigPath,
  grokNotificationHookCommand,
  mergeGrokNotificationConfig
} from './grokNotifications'

describe('grokNotifications', () => {
  it('kullanıcı evindeki grok config yolunu üretir', () => {
    expect(grokConfigPath('C:\\Users\\savas')).toBe('C:\\Users\\savas\\.grok\\config.toml')
  })

  it('eksik bildirimi always + bel + ses kancası olarak ekler', () => {
    const existing = '[ui]\npermission_mode = "always-approve"\n'
    const { next, changed } = mergeGrokNotificationConfig(existing, 'pwsh -Command beep')

    expect(changed).toBe(true)
    expect(next).toContain(GROK_NOTIFY_MARKER)
    expect(next).toContain('method = "bel"')
    expect(next).toContain('condition = "always"')
    expect(next).toContain('only_unfocused = false')
    expect(next).toContain('pwsh -Command beep')
    expect(next).toContain('permission_mode = "always-approve"')
    expect(next).not.toContain('session_ready')
  })

  it('işaret ve AGENTDECK koruması varsa dosyayı değiştirmez', () => {
    const existing = `${GROK_NOTIFY_MARKER}\n[ui.notifications]\ncommand = "if ($env:AGENTDECK -eq '1') { exit 0 }"\n`
    expect(mergeGrokNotificationConfig(existing, 'beep')).toEqual({
      next: existing,
      changed: false
    })
  })

  it('eski kancayı AgentDeck korumalı komutla değiştirir', () => {
    const existing = `[ui]\npermission_mode = "always-approve"\n\n${GROK_NOTIFY_MARKER}\n[ui.notifications]\ncondition = "always"\n`
    const { next, changed } = mergeGrokNotificationConfig(existing, 'pwsh -Command beep')
    expect(changed).toBe(true)
    expect(next).toContain('permission_mode = "always-approve"')
    expect(next).toContain('pwsh -Command beep')
  })

  it('PowerShell komutundaki tırnakları TOML için kaçırır', () => {
    const command = grokNotificationHookCommand('C:\\Windows', (path) =>
      path.endsWith('Windows Notify.wav')
    )
    expect(command).toContain('powershell.exe')
    expect(command).toContain('SoundPlayer')
    expect(command).toContain('PlaySync()')
    expect(command).toContain("$env:AGENTDECK -eq '1'")
  })
})