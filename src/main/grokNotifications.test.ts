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

  it('işaret silinmiş olsa bile AGENTDECK koruması varsa dosyayı değiştirmez (Grok CLI yorum silme durumu)', () => {
    const existing = `[ui]\npermission_mode = "ask"\n\n[ui.notifications]\nmethod = "bel"\ncondition = "always"\n\n[[ui.notifications.hooks]]\ncommand = "powershell.exe -Command \\"if ($env:AGENTDECK -eq '1') { exit 0 }\\""\n`
    expect(mergeGrokNotificationConfig(existing, 'beep')).toEqual({
      next: existing,
      changed: false
    })
  })

  it('işaretsiz mevcut bir [ui.notifications] varsa duplicate key oluşturmadan yerine geçer', () => {
    const existing = `[ui]\npermission_mode = "ask"\n\n[ui.notifications]\nmethod = "bel"\n\n[[ui.notifications.hooks]]\ncommand = "old_beep"\n`
    const { next, changed } = mergeGrokNotificationConfig(existing, 'pwsh -Command beep')
    expect(changed).toBe(true)
    expect(next).toContain(GROK_NOTIFY_MARKER)
    expect(next).toContain('pwsh -Command beep')
    expect(next.match(/\[ui\.notifications\]/g)?.length).toBe(1)
    expect(next.match(/\[\[ui\.notifications\.hooks\]\]/g)?.length).toBe(1)
  })

  it('Grok serialize edilmiş tablo + AgentDeck kopyasını tek geçerli bloğa indirir', () => {
    const existing = `[ui]\npermission_mode = "ask"\n\n[ui.notifications]\nmethod = "bel"\ncondition = "always"\nevents = [\n  "turn_complete",\n  "approval_required",\n]\n\n[[ui.notifications.hooks]]\ncommand = '''powershell.exe -Command "if ($env:AGENTDECK -eq '1') { exit 0 }"'''\nevents = ["turn_complete"]\n\n${GROK_NOTIFY_MARKER}\n[ui.notifications]\nmethod = "bel"\ncondition = "always"\n\n[[ui.notifications.hooks]]\ncommand = "duplicate"\n`
    const command = `pwsh -Command "if ($env:AGENTDECK -eq '1') { exit 0 }; beep"`
    const first = mergeGrokNotificationConfig(existing, command)

    expect(first.changed).toBe(true)
    expect(first.next.match(/\[ui\.notifications\]/g)?.length).toBe(1)
    expect(first.next.match(/\[\[ui\.notifications\.hooks\]\]/g)?.length).toBe(1)
    expect(first.next).toContain('pwsh -Command')
    expect(mergeGrokNotificationConfig(first.next, command)).toEqual({
      next: first.next,
      changed: false
    })
  })

  it('bildirimden sonraki bağımsız TOML tablolarını korur', () => {
    const existing = `[ui.notifications]\nmethod = "bel"\n\n[[ui.notifications.hooks]]\ncommand = "old"\n\n[telemetry]\nenabled = false\n\n${GROK_NOTIFY_MARKER}\n[ui.notifications]\nmethod = "bel"\n`
    const { next } = mergeGrokNotificationConfig(existing, 'beep')

    expect(next).toContain('[telemetry]\nenabled = false')
    expect(next.match(/\[ui\.notifications\]/g)?.length).toBe(1)
  })

  it('AGENTDECK metni başka tabloda geçiyorsa bildirimi yine kurar', () => {
    const existing = `[shell_environment_policy]\ninclude = ["AGENTDECK"]\n\n[ui.notifications]\nmethod = "bel"\n`
    const { next, changed } = mergeGrokNotificationConfig(
      existing,
      `pwsh -Command "if ($env:AGENTDECK -eq '1') { exit 0 }; beep"`
    )

    expect(changed).toBe(true)
    expect(next).toContain('$env:AGENTDECK')
    expect(next.match(/\[ui\.notifications\]/g)?.length).toBe(1)
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
