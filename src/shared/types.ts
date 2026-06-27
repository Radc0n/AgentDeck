export type TerminalProfile = 'shell' | 'claude' | 'cursor' | 'codex' | 'gemini' | 'custom'

export interface SavedCommand {
  id: string
  label: string
  command: string
}

export interface Terminal {
  id: string
  name: string
  profile: TerminalProfile
  command?: string
  cwd: string
  order: number
}

export interface Project {
  id: string
  name: string
  path: string
  terminals: Terminal[]
  savedCommands: SavedCommand[]
  pinned?: boolean
  notes?: string
}

export interface Workspace {
  schemaVersion: number
  projects: Project[]
  activeProjectId: string
  globalNotes?: string
  notesPanelOpen?: boolean
}

export const CURRENT_SCHEMA_VERSION = 1

export function createDefaultWorkspace(): Workspace {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects: [],
    activeProjectId: '',
    globalNotes: '',
    notesPanelOpen: false
  }
}
