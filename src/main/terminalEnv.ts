import { existsSync } from 'fs'
import { delimiter, join } from 'path'

/**
 * Electron masaüstünden açılınca kullanıcı shell PATH'i eksik kalabilir.
 * Grok / Antigravity (agy) / yaygın agent bin'lerini ekle.
 */
function extraPathDirs(): string[] {
  const home = process.env.USERPROFILE ?? process.env.HOME ?? ''
  const localAppData = process.env.LOCALAPPDATA ?? ''
  const candidates = [
    home ? join(home, '.grok', 'bin') : '',
    localAppData ? join(localAppData, 'agy', 'bin') : '',
    localAppData ? join(localAppData, 'Programs', 'Antigravity', 'bin') : '',
    home ? join(home, '.local', 'bin') : '',
    home ? join(home, 'AppData', 'Roaming', 'npm') : ''
  ]
  return candidates.filter((dir) => dir !== '' && existsSync(dir))
}

/**
 * PTY ortamı — renkleri devre dışı bırakan değişkenleri temizler,
 * truecolor desteğini açıkça etkinleştirir.
 */
export function buildTerminalEnv(): Record<string, string> {
  const env = { ...(process.env as Record<string, string>) }

  delete env.NO_COLOR
  delete env.CI

  env.TERM = 'xterm-256color'
  env.COLORTERM = 'truecolor'
  env.FORCE_COLOR = '3'
  env.CLICOLOR = '1'
  env.CLICOLOR_FORCE = '1'

  const extras = extraPathDirs()
  if (extras.length > 0) {
    const current = env.PATH ?? env.Path ?? ''
    const parts = current.split(delimiter).filter(Boolean)
    const merged = [...extras.filter((d) => !parts.includes(d)), ...parts]
    env.PATH = merged.join(delimiter)
    if (process.platform === 'win32') {
      env.Path = env.PATH
    }
  }

  return env
}
