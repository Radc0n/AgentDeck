import { spawn, type ChildProcess } from 'child_process'
import { buildTerminalEnv } from './terminalEnv'

export interface SpawnSpec {
  file: string
  args: string[]
  cwd: string
}

export interface SpawnOptions {
  title?: string
}

type ExitHandler = (id: string, exitCode: number, signal?: number) => void
type SpawnErrorHandler = (id: string, message: string) => void

interface SessionRecord {
  child: ChildProcess
  pid: number
  title: string
}

const sessions = new Map<string, SessionRecord>()
const exitHandlers = new Set<ExitHandler>()
const spawnErrorHandlers = new Set<SpawnErrorHandler>()

function emitExit(id: string, exitCode: number, signal?: number): void {
  for (const handler of exitHandlers) {
    handler(id, exitCode, signal)
  }
}

function emitSpawnError(id: string, message: string): void {
  for (const handler of spawnErrorHandlers) {
    handler(id, message)
  }
}

function toSpawnErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Native terminal başlatılamadı.'
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''")
}

/** Windows konsol penceresi başlığı için mümkünse PowerShell sarmalayıcısı. */
export function applyWindowTitle(spec: SpawnSpec, title: string | undefined): SpawnSpec {
  if (!title || process.platform !== 'win32') {
    return spec
  }

  const safeTitle = escapePowerShellSingleQuoted(title)
  const fileName = spec.file.toLowerCase()
  const isPowerShell =
    fileName.endsWith('powershell.exe') ||
    fileName.endsWith('pwsh.exe') ||
    fileName === 'powershell' ||
    fileName === 'pwsh'

  if (!isPowerShell) {
    return spec
  }

  if (spec.args.length === 0) {
    return {
      ...spec,
      args: [
        '-NoLogo',
        '-NoExit',
        '-Command',
        `$Host.UI.RawUI.WindowTitle = '${safeTitle}'`
      ]
    }
  }

  const commandIndex = spec.args.findIndex(
    (arg) => arg.toLowerCase() === '-command' || arg.toLowerCase() === '-c'
  )
  if (commandIndex >= 0 && commandIndex < spec.args.length - 1) {
    const original = spec.args[commandIndex + 1]
    const args = [...spec.args]
    args[commandIndex + 1] =
      `$Host.UI.RawUI.WindowTitle = '${safeTitle}'; ${original}`
    return { ...spec, args }
  }

  return spec
}

function killProcessTree(pid: number): void {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref()
    return
  }

  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      // Süreç zaten kapanmış olabilir.
    }
  }
}

export function spawnSession(
  id: string,
  spec: SpawnSpec,
  options: SpawnOptions = {}
): void {
  if (sessions.has(id)) {
    throw new Error(`Terminal zaten çalışıyor: ${id}`)
  }

  const launchSpec = applyWindowTitle(spec, options.title)

  try {
    const child = spawn(launchSpec.file, launchSpec.args, {
      cwd: launchSpec.cwd,
      env: buildTerminalEnv(),
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    })

    if (child.pid === undefined) {
      throw new Error('Süreç PID alınamadı.')
    }

    const record: SessionRecord = {
      child,
      pid: child.pid,
      title: options.title ?? id
    }
    sessions.set(id, record)

    child.on('error', (error) => {
      if (sessions.get(id)?.child === child) {
        sessions.delete(id)
      }
      emitSpawnError(id, toSpawnErrorMessage(error))
    })

    child.on('exit', (code, signal) => {
      if (sessions.get(id)?.child === child) {
        sessions.delete(id)
      }
      const exitCode = code ?? (signal ? 1 : 0)
      const signalNumber =
        typeof signal === 'number'
          ? signal
          : signal
            ? 1
            : undefined
      emitExit(id, exitCode, signalNumber)
    })

    child.unref()
  } catch (error) {
    const message = toSpawnErrorMessage(error)
    emitSpawnError(id, message)
    throw new Error(message)
  }
}

export function focusSession(id: string): boolean {
  const session = sessions.get(id)
  if (!session) {
    return false
  }

  if (process.platform === 'win32') {
    const script = `
$pidToFocus = ${session.pid}
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class AgentDeckWin32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@
$proc = Get-Process -Id $pidToFocus -ErrorAction SilentlyContinue
if (-not $proc) { exit 1 }
$hwnd = $proc.MainWindowHandle
if ($hwnd -eq [IntPtr]::Zero) {
  $child = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $pidToFocus } | Select-Object -First 1
  if ($child) {
    $proc = Get-Process -Id $child.ProcessId -ErrorAction SilentlyContinue
    if ($proc) { $hwnd = $proc.MainWindowHandle }
  }
}
if ($hwnd -eq [IntPtr]::Zero) { exit 2 }
if ([AgentDeckWin32]::IsIconic($hwnd)) { [void][AgentDeckWin32]::ShowWindowAsync($hwnd, 9) }
[void][AgentDeckWin32]::SetForegroundWindow($hwnd)
exit 0
`.trim()

    spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      }
    ).unref()
    return true
  }

  // macOS / Linux: en iyi çaba — process grubunu uyandırmak sınırlıdır.
  try {
    process.kill(session.pid, 0)
    return true
  } catch {
    return false
  }
}

export function killSession(id: string): void {
  const session = sessions.get(id)
  if (!session) {
    throw new Error(`Terminal bulunamadı: ${id}`)
  }

  sessions.delete(id)
  killProcessTree(session.pid)

  try {
    session.child.kill()
  } catch {
    // taskkill zaten sonlandırmış olabilir.
  }
}

export function hasSession(id: string): boolean {
  return sessions.has(id)
}

export function getSessionPid(id: string): number | null {
  return sessions.get(id)?.pid ?? null
}

export function onExit(handler: ExitHandler): () => void {
  exitHandlers.add(handler)
  return () => {
    exitHandlers.delete(handler)
  }
}

export function onSpawnError(handler: SpawnErrorHandler): () => void {
  spawnErrorHandlers.add(handler)
  return () => {
    spawnErrorHandlers.delete(handler)
  }
}

export function resetNativeSessionManagerForTests(): void {
  for (const [id, session] of sessions) {
    try {
      killProcessTree(session.pid)
    } catch {
      // test cleanup
    }
    sessions.delete(id)
  }
  exitHandlers.clear()
  spawnErrorHandlers.clear()
}
