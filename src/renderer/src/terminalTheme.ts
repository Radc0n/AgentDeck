import type { ITheme } from '@xterm/xterm'

/** Windows Terminal / Campbell — standart, canlı ANSI renkleri */
export const DEFAULT_TERMINAL_THEME: ITheme = {
  background: '#0c0c0c',
  foreground: '#cccccc',
  cursor: '#ffffff',
  cursorAccent: '#0c0c0c',
  selectionBackground: '#264f78',
  selectionForeground: '#ffffff',
  black: '#0c0c0c',
  red: '#c50f1f',
  green: '#13a10e',
  yellow: '#c19c00',
  blue: '#0037da',
  magenta: '#881798',
  cyan: '#3a96dd',
  white: '#cccccc',
  brightBlack: '#767676',
  brightRed: '#e74856',
  brightGreen: '#16c60c',
  brightYellow: '#f9f1a5',
  brightBlue: '#3b78ff',
  brightMagenta: '#b4009e',
  brightCyan: '#61d6d6',
  brightWhite: '#f2f2f2'
}

export const DEFAULT_XTERM_OPTIONS = {
  cursorBlink: true,
  scrollback: 5000,
  fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, "Courier New", monospace',
  fontSize: 13,
  lineHeight: 1.2,
  drawBoldTextInBrightColors: true,
  minimumContrastRatio: 1,
  theme: DEFAULT_TERMINAL_THEME
} as const
