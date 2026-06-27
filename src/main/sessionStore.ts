import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  CURRENT_SCHEMA_VERSION,
  createDefaultWorkspace,
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

function isTerminalProfile(value: unknown): value is TerminalProfile {
  return (
    value === 'shell' ||
    value === 'claude' ||
    value === 'cursor' ||
    value === 'codex' ||
    value === 'gemini' ||
    value === 'custom'
  )
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

function normalizeTerminal(value: unknown): Terminal | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    !isTerminalProfile(record.profile) ||
    typeof record.cwd !== 'string' ||
    typeof record.order !== 'number'
  ) {
    return null
  }

  const terminal: Terminal = {
    id: record.id,
    name: record.name,
    profile: record.profile,
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

  const project: Project = {
    id: record.id,
    name: record.name,
    path: record.path,
    terminals,
    savedCommands,
    pinned: record.pinned === true
  }

  if (typeof record.notes === 'string') {
    project.notes = record.notes
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

  const globalNotes = typeof data.globalNotes === 'string' ? data.globalNotes : ''
  const notesPanelOpen = data.notesPanelOpen === true

  return {
    schemaVersion,
    projects,
    activeProjectId,
    globalNotes,
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
