import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import {
  CURRENT_SCHEMA_VERSION,
  createDefaultWorkspace,
  type Notebook,
  type Project,
  type SavedCommand,
  type Terminal,
  type TerminalProfile,
  type Workspace
} from '../shared/types'

const WORKSPACE_FILENAME = 'agentdeck.json'

export function getWorkspaceFilePath(userDataDir: string): string {
  return join(userDataDir, WORKSPACE_FILENAME)
}

export function getDefaultUserDataDir(): string {
  // Electron main sürecinde varsayılan userData yolu.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron')
  return app.getPath('userData')
}

function normalizeProfile(value: unknown): TerminalProfile | null {
  if (value === 'gemini') {
    return 'antigravity'
  }
  if (
    value === 'grok' ||
    value === 'shell' ||
    value === 'claude' ||
    value === 'cursor' ||
    value === 'codex' ||
    value === 'antigravity' ||
    value === 'opencode' ||
    value === 'custom'
  ) {
    return value
  }
  return null
}

function normalizeSavedCommand(value: unknown): SavedCommand | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  if (
    typeof record.id !== 'string' ||
    typeof record.label !== 'string' ||
    typeof record.command !== 'string'
  ) {
    return null
  }

  return {
    id: record.id,
    label: record.label,
    command: record.command
  }
}

function normalizeNotebook(value: unknown, fallbackOrder: number): Notebook | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.name !== 'string') {
    return null
  }

  const content = typeof record.content === 'string' ? record.content : ''
  const order =
    typeof record.order === 'number' && Number.isFinite(record.order)
      ? record.order
      : fallbackOrder

  return {
    id: record.id,
    name: record.name,
    content,
    order
  }
}

function normalizeNotebooks(
  value: unknown,
  legacyNotes?: string
): Notebook[] {
  if (Array.isArray(value)) {
    const notebooks = value
      .map((item, index) => normalizeNotebook(item, index))
      .filter((item): item is Notebook => item !== null)
      .sort((a, b) => a.order - b.order)
      .map((notebook, index) => ({ ...notebook, order: index }))

    if (notebooks.length > 0) {
      return notebooks
    }
  }

  // Eski tek-metin modelinden bir defter oluştur.
  if (typeof legacyNotes === 'string' && legacyNotes.length > 0) {
    return [
      {
        id: randomUUID(),
        name: 'Notlar',
        content: legacyNotes,
        order: 0
      }
    ]
  }

  return []
}

function normalizeTerminal(value: unknown): Terminal | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const profile = normalizeProfile(record.profile)
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    profile === null ||
    typeof record.cwd !== 'string' ||
    typeof record.order !== 'number'
  ) {
    return null
  }

  const terminal: Terminal = {
    id: record.id,
    name: record.name,
    profile,
    cwd: record.cwd,
    order: record.order
  }

  if (typeof record.command === 'string') {
    terminal.command = record.command
  }

  return terminal
}

function normalizeProject(value: unknown): Project | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.path !== 'string'
  ) {
    return null
  }

  const terminals = Array.isArray(record.terminals)
    ? record.terminals
        .map(normalizeTerminal)
        .filter((terminal): terminal is Terminal => terminal !== null)
    : []

  const savedCommands = Array.isArray(record.savedCommands)
    ? record.savedCommands
        .map(normalizeSavedCommand)
        .filter((command): command is SavedCommand => command !== null)
    : []

  const legacyNotes = typeof record.notes === 'string' ? record.notes : undefined
  const notebooks = normalizeNotebooks(record.notebooks, legacyNotes)

  const project: Project = {
    id: record.id,
    name: record.name,
    path: record.path,
    terminals,
    savedCommands,
    pinned: record.pinned === true,
    other: record.other === true,
    notebooks
  }

  return project
}

function migrateWorkspace(raw: unknown): Workspace {
  if (!raw || typeof raw !== 'object') {
    return createDefaultWorkspace()
  }

  const data = raw as Record<string, unknown>
  let schemaVersion =
    typeof data.schemaVersion === 'number' ? data.schemaVersion : 0

  // Gelecekteki sürüm geçişleri buraya eklenecek.
  if (schemaVersion < 1) {
    schemaVersion = 1
  }

  const projects = Array.isArray(data.projects)
    ? data.projects
        .map(normalizeProject)
        .filter((project): project is Project => project !== null)
    : []

  const activeProjectId =
    typeof data.activeProjectId === 'string' ? data.activeProjectId : ''

  const legacyGlobalNotes =
    typeof data.globalNotes === 'string' ? data.globalNotes : undefined
  const globalNotebooks = normalizeNotebooks(data.globalNotebooks, legacyGlobalNotes)
  const notesPanelOpen = data.notesPanelOpen === true

  return {
    schemaVersion,
    projects,
    activeProjectId,
    globalNotebooks,
    notesPanelOpen
  }
}

function backupCorruptWorkspaceFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return
  }

  copyFileSync(filePath, `${filePath}.bak`)
}

export function loadWorkspace(userDataDir?: string): Workspace {
  const baseDir = userDataDir ?? getDefaultUserDataDir()
  const filePath = getWorkspaceFilePath(baseDir)

  if (!existsSync(filePath)) {
    return createDefaultWorkspace()
  }

  let rawContent: string
  try {
    rawContent = readFileSync(filePath, 'utf8')
  } catch (error) {
    console.error('Oturum dosyası okunamadı:', error)
    return createDefaultWorkspace()
  }

  try {
    const parsed: unknown = JSON.parse(rawContent)
    const workspace = migrateWorkspace(parsed)
    return {
      ...workspace,
      schemaVersion: CURRENT_SCHEMA_VERSION
    }
  } catch (error) {
    console.error('Oturum dosyası bozuk; yedek alınıp varsayılan oturum kullanılacak:', error)
    backupCorruptWorkspaceFile(filePath)
    return createDefaultWorkspace()
  }
}

export function saveWorkspace(workspace: Workspace, userDataDir?: string): void {
  const baseDir = userDataDir ?? getDefaultUserDataDir()
  const filePath = getWorkspaceFilePath(baseDir)

  mkdirSync(baseDir, { recursive: true })

  const payload: Workspace = {
    ...workspace,
    schemaVersion: CURRENT_SCHEMA_VERSION
  }

  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}
