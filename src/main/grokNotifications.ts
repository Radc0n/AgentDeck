import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  resolveWindowsNotifyWav,
  resolveWindowsPowerShell,
  windowsAttentionSoundCommand
} from './attentionSound'

export const GROK_NOTIFY_MARKER = '# agentdeck: grok-notify'

export function grokConfigPath(
  home: string = process.env.USERPROFILE ?? process.env.HOME ?? homedir()
): string {
  return join(home, '.grok', 'config.toml')
}

export function grokNotificationHookCommand(
  windir: string = process.env.WINDIR ?? 'C:\\Windows',
  exists: (path: string) => boolean = existsSync
): string {
  const powershell = resolveWindowsPowerShell(windir)
  const wav = resolveWindowsNotifyWav(windir, exists)
  const inner = windowsAttentionSoundCommand(wav)
  // AgentDeck PTY'de hook sessiz; sesi main process çalar. Çift ötmesin.
  return `${powershell} -NoProfile -NonInteractive -WindowStyle Hidden -Command "if ($env:AGENTDECK -eq '1') { exit 0 }; ${inner}"`
}

function escapeTomlString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

export function grokNotificationConfigBlock(hookCommand: string): string {
  return [
    GROK_NOTIFY_MARKER,
    '[ui.notifications]',
    'method = "bel"',
    'condition = "always"',
    'idle_threshold_secs = 0',
    'events = ["turn_complete", "approval_required"]',
    '',
    '[[ui.notifications.hooks]]',
    `command = "${escapeTomlString(hookCommand)}"`,
    'events = ["turn_complete", "approval_required"]',
    'only_unfocused = false',
    'timeout_secs = 8',
    ''
  ].join('\n')
}

/**
 * AgentDeck bilinmeyen terminal: Grok odak takibi yapamaz, varsayılan
 * condition=unfocused yüzünden turn_complete BEL/ses hiç gönderilmez.
 * condition=always + Windows ses kancası CLI'nın kendi bildirimidir.
 */
export function mergeGrokNotificationConfig(
  existing: string,
  hookCommand: string
): { next: string; changed: boolean } {
  const block = grokNotificationConfigBlock(hookCommand)
  const markerAt = existing.indexOf(GROK_NOTIFY_MARKER)
  if (markerAt !== -1) {
    if (existing.includes('$env:AGENTDECK')) {
      return { next: existing, changed: false }
    }
    const next = `${existing.slice(0, markerAt).replace(/\s+$/u, '')}\n\n${block}`
    return { next, changed: true }
  }

  const trimmed = existing.replace(/\s+$/u, '')
  const next = trimmed.length === 0 ? block : `${trimmed}\n\n${block}`
  return { next, changed: true }
}

export function ensureGrokNotificationConfig(
  home: string = process.env.USERPROFILE ?? process.env.HOME ?? homedir(),
  hookCommand: string = grokNotificationHookCommand()
): boolean {
  const path = grokConfigPath(home)
  if (!existsSync(path)) {
    return false
  }

  const existing = readFileSync(path, 'utf8')
  const { next, changed } = mergeGrokNotificationConfig(existing, hookCommand)
  if (!changed) {
    return false
  }

  writeFileSync(path, next, 'utf8')
  return true
}