import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const NOTIFY_WAV_NAMES = [
  'Windows Notify System Generic.wav',
  'Windows Notify.wav',
  'Windows Background.wav',
  'notify.wav'
] as const

export function resolveWindowsNotifyWav(
  windir: string = process.env.WINDIR ?? 'C:\\Windows',
  exists: (path: string) => boolean = existsSync
): string | null {
  const mediaDir = join(windir, 'Media')
  for (const name of NOTIFY_WAV_NAMES) {
    const candidate = join(mediaDir, name)
    if (exists(candidate)) {
      return candidate
    }
  }
  return null
}

export function resolveWindowsPowerShell(
  windir: string = process.env.WINDIR ?? 'C:\\Windows'
): string {
  return join(windir, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}

export function windowsAttentionSoundCommand(wavPath: string | null): string {
  if (wavPath) {
    const escaped = wavPath.replaceAll("'", "''")
    return `(New-Object System.Media.SoundPlayer '${escaped}').PlaySync()`
  }
  return '[System.Media.SystemSounds]::Asterisk.Play(); Start-Sleep -Milliseconds 800'
}

export function windowsAttentionSoundSpawn(
  windir: string = process.env.WINDIR ?? 'C:\\Windows',
  exists: (path: string) => boolean = existsSync
): { file: string; args: string[] } {
  return {
    file: resolveWindowsPowerShell(windir),
    args: [
      '-NoProfile',
      '-NonInteractive',
      '-NoLogo',
      '-WindowStyle',
      'Hidden',
      '-Command',
      windowsAttentionSoundCommand(resolveWindowsNotifyWav(windir, exists))
    ]
  }
}

/**
 * Ajan needsAttention olunca Windows sistem sesini main process'ten çalar.
 *
 * Renderer Web Audio (AudioContext) paketli Electron'da askıda kalabiliyor;
 * odak dışındayken de ses Windows toast'ına bırakılıyordu — Start Menu
 * kısayolu olmayan win-unpacked'te toast sessiz/yok.
 */
export function playAttentionSound(): void {
  if (process.platform !== 'win32') {
    return
  }

  const { file, args } = windowsAttentionSoundSpawn()
  const child = spawn(file, args, {
    windowsHide: true,
    stdio: 'ignore'
  })
  child.on('error', () => {
    // powershell yoksa veya spawn başarısızsa uygulamayı düşürme.
  })
  child.unref()
}
