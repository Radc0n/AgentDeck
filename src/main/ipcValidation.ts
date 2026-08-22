import { existsSync, statSync } from 'fs'
import type {
  AttentionDismissRequest,
  ClipboardWriteRequest,
  CreateTerminalRequest,
  TerminalIdRequest,
  TerminalResizeRequest,
  TerminalWriteRequest
} from '../shared/ipc'
import type { TerminalProfile, Workspace } from '../shared/types'

const TERMINAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const TERMINAL_PROFILES = new Set<TerminalProfile>([
  'grok',
  'shell',
  'claude',
  'cursor',
  'codex',
  'antigravity',
  'opencode',
  'custom'
])

const MAX_PATH_LENGTH = 32_767
const MAX_COMMAND_LENGTH = 16_384
const MAX_TERMINAL_WRITE_LENGTH = 1_048_576
export const MAX_CLIPBOARD_TEXT_LENGTH = 1_048_576
const MAX_TERMINAL_DIMENSION = 1_000
const MAX_ATTENTION_TERMINALS = 256
const MAX_WORKSPACE_JSON_LENGTH = 5_000_000

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} geçersiz.`)
  }
  return value as Record<string, unknown>
}

function asBoundedString(
  value: unknown,
  label: string,
  maxLength: number,
  allowEmpty = false
): string {
  if (
    typeof value !== 'string' ||
    (!allowEmpty && value.length === 0) ||
    value.length > maxLength ||
    value.includes('\0')
  ) {
    throw new Error(`${label} geçersiz.`)
  }
  return value
}

function asTerminalId(value: unknown): string {
  if (typeof value !== 'string' || !TERMINAL_ID_PATTERN.test(value)) {
    throw new Error('Terminal kimliği geçersiz.')
  }
  return value
}

function asDirectoryPath(value: unknown, mustExist: boolean): string {
  const path = asBoundedString(value, 'Proje yolu', MAX_PATH_LENGTH)
  if (!mustExist) {
    return path
  }

  try {
    if (!existsSync(path) || !statSync(path).isDirectory()) {
      throw new Error('Proje klasörüne erişilemiyor.')
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Proje klasörüne erişilemiyor.') {
      throw error
    }
    throw new Error('Proje klasörüne erişilemiyor.')
  }

  return path
}

export function validateCreateTerminalRequest(value: unknown): CreateTerminalRequest {
  const request = asRecord(value, 'Terminal isteği')
  const id = asTerminalId(request.id)
  const cwd = asDirectoryPath(request.cwd, true)

  if (typeof request.profile !== 'string' || !TERMINAL_PROFILES.has(request.profile as TerminalProfile)) {
    throw new Error('Terminal profili geçersiz.')
  }
  const profile = request.profile as TerminalProfile

  if (profile === 'custom') {
    const command = asBoundedString(request.command, 'Özel komut', MAX_COMMAND_LENGTH).trim()
    if (command.length === 0) {
      throw new Error('Özel komut geçersiz.')
    }
    return { id, profile, cwd, command }
  }

  if (request.command !== undefined) {
    throw new Error('Bu terminal profili özel komut kabul etmiyor.')
  }

  return { id, profile, cwd }
}

export function validateTerminalIdRequest(value: unknown): TerminalIdRequest {
  const request = asRecord(value, 'Terminal isteği')
  return { terminalId: asTerminalId(request.terminalId) }
}

export function validateTerminalWriteRequest(value: unknown): TerminalWriteRequest {
  const request = asRecord(value, 'Terminal yazma isteği')
  return {
    terminalId: asTerminalId(request.terminalId),
    data: asBoundedString(
      request.data,
      'Terminal girdisi',
      MAX_TERMINAL_WRITE_LENGTH,
      true
    )
  }
}

export function validateTerminalResizeRequest(value: unknown): TerminalResizeRequest {
  const request = asRecord(value, 'Terminal boyutlandırma isteği')
  const cols = request.cols
  const rows = request.rows

  if (
    typeof cols !== 'number' ||
    !Number.isInteger(cols) ||
    cols < 1 ||
    cols > MAX_TERMINAL_DIMENSION ||
    typeof rows !== 'number' ||
    !Number.isInteger(rows) ||
    rows < 1 ||
    rows > MAX_TERMINAL_DIMENSION
  ) {
    throw new Error('Terminal boyutu geçersiz.')
  }

  if (request.force !== undefined && typeof request.force !== 'boolean') {
    throw new Error('Terminal boyutlandırma seçeneği geçersiz.')
  }

  return {
    terminalId: asTerminalId(request.terminalId),
    cols,
    rows,
    force: request.force === true
  }
}

export function validateAttentionDismissRequest(value: unknown): AttentionDismissRequest {
  const request = asRecord(value, 'Dikkat isteği')
  if (
    !Array.isArray(request.terminalIds) ||
    request.terminalIds.length > MAX_ATTENTION_TERMINALS
  ) {
    throw new Error('Terminal listesi geçersiz.')
  }

  return {
    terminalIds: [...new Set(request.terminalIds.map(asTerminalId))]
  }
}

export function validateWorkspace(value: unknown): Workspace {
  const workspace = asRecord(value, 'Çalışma alanı')
  if (
    typeof workspace.schemaVersion !== 'number' ||
    !Array.isArray(workspace.projects) ||
    typeof workspace.activeProjectId !== 'string'
  ) {
    throw new Error('Çalışma alanı geçersiz.')
  }

  let serialized: string
  try {
    serialized = JSON.stringify(value)
  } catch {
    throw new Error('Çalışma alanı geçersiz.')
  }

  if (serialized.length > MAX_WORKSPACE_JSON_LENGTH) {
    throw new Error('Çalışma alanı çok büyük.')
  }

  return value as Workspace
}

export function validateProjectPath(value: unknown, mustExist = false): string {
  return asDirectoryPath(value, mustExist)
}

export function validateClipboardWriteRequest(value: unknown): ClipboardWriteRequest {
  const request = asRecord(value, 'Pano isteği')
  return {
    text: asBoundedString(request.text, 'Pano metni', MAX_CLIPBOARD_TEXT_LENGTH, true)
  }
}
