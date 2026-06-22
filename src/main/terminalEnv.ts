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

  return env
}
