/** custom: yalnızca kayıtlı komut çubuğu için; terminal menüsünde yok. */
export type TerminalProfile =
  | 'grok'
  | 'shell'
  | 'claude'
  | 'cursor'
  | 'codex'
  | 'antigravity'
  | 'custom'

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

/** Not paneli defteri — serbest metin scratchpad. */
export interface Notebook {
  id: string
  name: string
  content: string
  order: number
}

export interface Project {
  id: string
  name: string
  path: string
  terminals: Terminal[]
  savedCommands: SavedCommand[]
  pinned?: boolean
  /** true ise üst çubukta değil, "Diğer" rafında tutulur */
  other?: boolean
  /** @deprecated eski tek alan; yüklemede notebooks'a migrate edilir */
  notes?: string
  notebooks?: Notebook[]
}

export interface Workspace {
  schemaVersion: number
  projects: Project[]
  activeProjectId: string
  /** @deprecated eski tek alan; yüklemede globalNotebooks'a migrate edilir */
  globalNotes?: string
  globalNotebooks?: Notebook[]
  notesPanelOpen?: boolean
}

export const CURRENT_SCHEMA_VERSION = 1

export function createDefaultWorkspace(): Workspace {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects: [],
    activeProjectId: '',
    globalNotebooks: [],
    notesPanelOpen: false
  }
}
