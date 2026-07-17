export type TerminalProfile = 'shell' | 'claude' | 'cursor' | 'codex' | 'gemini' | 'custom'

export type AttentionState = 'idle' | 'busy' | 'needsAttention'

export type TerminalRunState = 'running' | 'exited' | 'error'

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

export interface CreateTerminalRequest {
  id: string
  profile: TerminalProfile
  cwd: string
  command?: string
  title?: string
}

export interface CreateTerminalResult {
  ok: true
}

export interface TerminalIdRequest {
  terminalId: string
}

export interface TerminalExitEvent {
  terminalId: string
  exitCode: number
  signal?: number
}

export interface TerminalStateEvent {
  terminalId: string
  state: TerminalRunState
  message?: string
  exitCode?: number
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
  killTerminal: (request: TerminalIdRequest) => Promise<void>
  focusTerminalWindow: (request: TerminalIdRequest) => Promise<boolean>
  reportTerminalFocus: (request: TerminalIdRequest) => Promise<void>
  reportTerminalUserInput: (request: TerminalIdRequest) => Promise<void>
  resetAttentionSession: () => Promise<void>
  dismissAttentionForTerminals: (request: AttentionDismissRequest) => Promise<void>
  loadWorkspace: () => Promise<Workspace>
  saveWorkspace: (workspace: Workspace) => Promise<void>
  addProject: () => Promise<AddProjectResult>
  checkProjectPath: (path: string) => Promise<boolean>
  revealProjectInFolder: (path: string) => Promise<void>
  onTerminalExit: (callback: (event: TerminalExitEvent) => void) => Unsubscribe
  onTerminalSpawnError: (callback: (event: TerminalSpawnErrorEvent) => void) => Unsubscribe
  onTerminalState: (callback: (event: TerminalStateEvent) => void) => Unsubscribe
  onAttentionChanged: (callback: (event: AttentionChangedEvent) => void) => Unsubscribe
}

declare global {
  interface Window {
    agentdeck: AgentDeckBridge
  }
}

export {}
