import type { TerminalProfile, Workspace } from './types'

export type AttentionState = 'idle' | 'busy' | 'needsAttention'

export type TerminalRunState = 'running' | 'exited' | 'error'

export const IPC_CHANNELS = {
  TERMINAL_CREATE: 'agentdeck:terminal:create',
  TERMINAL_KILL: 'agentdeck:terminal:kill',
  TERMINAL_FOCUS_WINDOW: 'agentdeck:terminal:focusWindow',
  TERMINAL_REPORT_FOCUS: 'agentdeck:terminal:reportFocus',
  TERMINAL_REPORT_USER_INPUT: 'agentdeck:terminal:reportUserInput',
  WORKSPACE_LOAD: 'agentdeck:workspace:load',
  WORKSPACE_SAVE: 'agentdeck:workspace:save',
  PROJECT_ADD: 'agentdeck:project:add',
  TERMINAL_EXIT: 'agentdeck:terminal:exit',
  TERMINAL_SPAWN_ERROR: 'agentdeck:terminal:spawnError',
  TERMINAL_STATE: 'agentdeck:terminal:state',
  ATTENTION_CHANGED: 'agentdeck:attention:changed',
  ATTENTION_RESET_SESSION: 'agentdeck:attention:resetSession',
  ATTENTION_DISMISS_TERMINALS: 'agentdeck:attention:dismissTerminals',
  PROJECT_CHECK_PATH: 'agentdeck:project:checkPath',
  PROJECT_REVEAL_IN_FOLDER: 'agentdeck:project:revealInFolder'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

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

export interface AgentDeckAPI {
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
