export type TerminalProfile =
  | 'grok'
  | 'shell'
  | 'claude'
  | 'cursor'
  | 'codex'
  | 'antigravity'
  | 'custom'

export type AttentionState = 'idle' | 'busy' | 'needsAttention'

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
  notes?: string
  notebooks?: Notebook[]
}

export interface Workspace {
  schemaVersion: number
  projects: Project[]
  activeProjectId: string
  globalNotes?: string
  globalNotebooks?: Notebook[]
  notesPanelOpen?: boolean
}

export interface CreateTerminalRequest {
  id: string
  profile: TerminalProfile
  cwd: string
  command?: string
}

export interface CreateTerminalResult {
  ok: true
}

export interface TerminalWriteRequest {
  terminalId: string
  data: string
}

export interface TerminalResizeRequest {
  terminalId: string
  cols: number
  rows: number
  force?: boolean
}

export interface TerminalIdRequest {
  terminalId: string
}

export interface TerminalDataEvent {
  terminalId: string
  data: string
}

export interface TerminalExitEvent {
  terminalId: string
  exitCode: number
  signal?: number
}

export interface AttentionChangedEvent {
  terminalId: string
  state: AttentionState
}

export interface TerminalSpawnErrorEvent {
  terminalId: string
  message: string
}

export interface AddProjectResult {
  path: string | null
  name?: string
}

export type Unsubscribe = () => void

export interface AttentionDismissRequest {
  terminalIds: string[]
}

export interface AgentDeckBridge {
  createTerminal: (request: CreateTerminalRequest) => Promise<CreateTerminalResult>
  writeTerminal: (request: TerminalWriteRequest) => Promise<void>
  resizeTerminal: (request: TerminalResizeRequest) => Promise<void>
  killTerminal: (request: TerminalIdRequest) => Promise<void>
  attachTerminal: (request: TerminalIdRequest) => Promise<{ data: string; reattach: boolean }>
  detachTerminal: (request: TerminalIdRequest) => Promise<void>
  reportTerminalFocus: (request: TerminalIdRequest) => Promise<void>
  reportTerminalUserInput: (request: TerminalIdRequest) => Promise<void>
  resetAttentionSession: () => Promise<void>
  dismissAttentionForTerminals: (request: AttentionDismissRequest) => Promise<void>
  loadWorkspace: () => Promise<Workspace>
  saveWorkspace: (workspace: Workspace) => Promise<void>
  addProject: () => Promise<AddProjectResult>
  checkProjectPath: (path: string) => Promise<boolean>
  revealProjectInFolder: (path: string) => Promise<void>
  onTerminalData: (callback: (event: TerminalDataEvent) => void) => Unsubscribe
  onTerminalExit: (callback: (event: TerminalExitEvent) => void) => Unsubscribe
  onTerminalSpawnError: (callback: (event: TerminalSpawnErrorEvent) => void) => Unsubscribe
  onAttentionChanged: (callback: (event: AttentionChangedEvent) => void) => Unsubscribe
}

declare global {
  interface Window {
    agentdeck: AgentDeckBridge
  }
}

export {}
