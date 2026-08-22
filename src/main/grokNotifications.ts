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

interface LineSpan {
  start: number
  end: number
}

function tomlTablePath(line: string): string | null {
  const match = line.match(/^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*(?:#.*)?$/u)
  return match?.[1]?.trim() ?? null
}

function isNotificationsTable(path: string | null): boolean {
  return path === 'ui.notifications' || path?.startsWith('ui.notifications.') === true
}

function notificationTableSpans(lines: string[]): LineSpan[] {
  const spans: LineSpan[] = []
  let line = 0

  while (line < lines.length) {
    if (!isNotificationsTable(tomlTablePath(lines[line]))) {
      line += 1
      continue
    }

    let start = line
    let markerLine = start - 1
    while (markerLine >= 0 && lines[markerLine].trim() === '') {
      markerLine -= 1
    }
    if (lines[markerLine]?.trim() === GROK_NOTIFY_MARKER) {
      start = markerLine
    }

    line += 1
    while (line < lines.length) {
      const path = tomlTablePath(lines[line])
      if (path !== null && !isNotificationsTable(path)) {
        break
      }
      line += 1
    }
    spans.push({ start, end: line })
  }

  return spans
}

function countNotificationRoots(lines: string[]): number {
  return lines.filter((line) => tomlTablePath(line) === 'ui.notifications').length
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
  const eol = existing.includes('\r\n') ? '\r\n' : '\n'
  const lines = existing.split(/\r?\n/u)
  const spans = notificationTableSpans(lines)
  const rootCount = countNotificationRoots(lines)
  const notificationsText = spans
    .map(({ start, end }) => lines.slice(start, end).join('\n'))
    .join('\n')

  // Grok CLI config'i yeniden serialize edip AgentDeck yorumunu silebilir. Tek
  // bir notification kökü ve bizim hook'umuz varsa biçim farkı için yeniden
  // yazmayız. Önce root sayısını kontrol etmek, zaten bozuk olan iki tabloyu
  // "$env:AGENTDECK var" diye yanlışlıkla geçerli saymamızı engeller.
  if (rootCount === 1 && notificationsText.includes('$env:AGENTDECK')) {
    return { next: existing, changed: false }
  }

  const blockLines = grokNotificationConfigBlock(hookCommand).trimEnd().split('\n')
  const nextLines: string[] = []

  if (spans.length === 0) {
    // Yalnız kalmış eski marker'ı temizle; ardından sahip olduğumuz bloğu ekle.
    nextLines.push(...lines.filter((line) => line.trim() !== GROK_NOTIFY_MARKER))
    while (nextLines.at(-1)?.trim() === '') {
      nextLines.pop()
    }
    if (nextLines.length > 0) {
      nextLines.push('')
    }
    nextLines.push(...blockLines)
  } else {
    let cursor = 0
    spans.forEach((span, index) => {
      nextLines.push(...lines.slice(cursor, span.start))
      if (index === 0) {
        nextLines.push(...blockLines)
      }
      cursor = span.end
    })
    nextLines.push(...lines.slice(cursor))
  }

  while (nextLines.at(-1)?.trim() === '') {
    nextLines.pop()
  }
  const next = `${nextLines.join(eol)}${eol}`
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
