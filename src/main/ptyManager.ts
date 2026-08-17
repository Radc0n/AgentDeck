import * as pty from 'node-pty'
import { buildTerminalEnv } from './terminalEnv'

export interface SpawnSpec {
  file: string
  args: string[]
  cwd: string
}

type DataHandler = (id: string, data: string) => void
type ExitHandler = (id: string, exitCode: number, signal?: number) => void
type SpawnErrorHandler = (id: string, message: string) => void

const terminals = new Map<string, pty.IPty>()
const dataHandlers = new Set<DataHandler>()
const exitHandlers = new Set<ExitHandler>()
const spawnErrorHandlers = new Set<SpawnErrorHandler>()

function emitData(id: string, data: string): void {
  for (const handler of dataHandlers) {
    handler(id, data)
  }
}

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
  return 'Terminal başlatılamadı.'
}

export function spawnTerminal(id: string, spec: SpawnSpec): void {
  if (terminals.has(id)) {
    throw new Error(`Terminal zaten çalışıyor: ${id}`)
  }

  try {
    const terminal = pty.spawn(spec.file, spec.args, {
      name: 'xterm-256color',
      cwd: spec.cwd,
      cols: 80,
      rows: 24,
      env: {
        ...buildTerminalEnv(),
        AGENTDECK_TERMINAL_ID: id
      },
      // Windows: ConPTY — modern TUI (claude/codex/grok) için gerekli.
      ...(process.platform === 'win32' ? { useConpty: true } : {})
    })

    terminal.onData((data) => {
      emitData(id, data)
    })

    terminal.onExit(({ exitCode, signal }) => {
      terminals.delete(id)
      emitExit(id, exitCode, signal)
    })

    terminals.set(id, terminal)
  } catch (error) {
    const message = toSpawnErrorMessage(error)
    emitSpawnError(id, message)
    throw new Error(message)
  }
}

export function write(id: string, data: string): void {
  const terminal = terminals.get(id)
  if (!terminal) {
    throw new Error(`Terminal bulunamadı: ${id}`)
  }
  terminal.write(data)
}

export function resize(
  id: string,
  cols: number,
  rows: number,
  options: { force?: boolean } = {}
): void {
  const terminal = terminals.get(id)
  if (!terminal) {
    throw new Error(`Terminal bulunamadı: ${id}`)
  }
  if (!options.force && terminal.cols === cols && terminal.rows === rows) {
    return
  }
  terminal.resize(cols, rows)
}

export function kill(id: string): void {
  const terminal = terminals.get(id)
  // Süreç zaten çıkmışsa (crash/exit) map boş — kapatma UI için no-op olmalı.
  if (!terminal) {
    return
  }
  terminals.delete(id)
  try {
    terminal.kill()
  } catch {
    // ConPTY / süreç zaten ölü olabilir.
  }
}

export function onData(handler: DataHandler): () => void {
  dataHandlers.add(handler)
  return () => {
    dataHandlers.delete(handler)
  }
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

export function hasTerminal(id: string): boolean {
  return terminals.has(id)
}

export function resetPtyManagerForTests(): void {
  for (const terminal of terminals.values()) {
    try {
      terminal.kill()
    } catch {
      // Test temizliğinde süreç zaten kapanmış olabilir.
    }
  }
  terminals.clear()
  dataHandlers.clear()
  exitHandlers.clear()
  spawnErrorHandlers.clear()
}
