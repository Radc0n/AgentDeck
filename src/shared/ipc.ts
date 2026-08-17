import type { TerminalProfile, Workspace } from './types'

export type AttentionState = 'idle' | 'busy' | 'needsAttention'

export const IPC_CHANNELS = {
  TERMINAL_CREATE: 'agentdeck:terminal:create',
  TERMINAL_WRITE: 'agentdeck:terminal:write',
  TERMINAL_RESIZE: 'agentdeck:terminal:resize',
  TERMINAL_KILL: 'agentdeck:terminal:kill',
  TERMINAL_REPORT_FOCUS: 'agentdeck:terminal:reportFocus',
  TERMINAL_REPORT_BLUR: 'agentdeck:terminal:reportBlur',
  TERMINAL_REPORT_USER_INPUT: 'agentdeck:terminal:reportUserInput',
  WORKSPACE_LOAD: 'agentdeck:workspace:load',
  WORKSPACE_SAVE: 'agentdeck:workspace:save',
  PROJECT_ADD: 'agentdeck:project:add',
  TERMINAL_DATA: 'agentdeck:terminal:data',
  TERMINAL_ATTACH: 'agentdeck:terminal:attach',
  TERMINAL_DETACH: 'agentdeck:terminal:detach',
  TERMINAL_EXIT: 'agentdeck:terminal:exit',
  TERMINAL_SPAWN_ERROR: 'agentdeck:terminal:spawnError',
  TERMINAL_BELL: 'agentdeck:terminal:bell',
  ATTENTION_CHANGED: 'agentdeck:attention:changed',
  ATTENTION_RESET_SESSION: 'agentdeck:attention:resetSession',
  ATTENTION_DISMISS_TERMINALS: 'agentdeck:attention:dismissTerminals',
  PROJECT_CHECK_PATH: 'agentdeck:project:checkPath',
  PROJECT_REVEAL_IN_FOLDER: 'agentdeck:project:revealInFolder',
  CLIPBOARD_READ: 'agentdeck:clipboard:read',
  CLIPBOARD_WRITE: 'agentdeck:clipboard:write'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

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

export interface TerminalBellEvent {
  terminalId: string
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

export interface TerminalAttachResult {
  data: string
  reattach: boolean
}

export interface AttentionDismissRequest {
  terminalIds: string[]
}

export interface ClipboardWriteRequest {
  text: string
}

export interface ClipboardReadResult {
  text: string
  hasImage: boolean
}

export interface AgentDeckAPI {
  createTerminal: (request: CreateTerminalRequest) => Promise<CreateTerminalResult>
  writeTerminal: (request: TerminalWriteRequest) => Promise<void>
  resizeTerminal: (request: TerminalResizeRequest) => Promise<void>
  killTerminal: (request: TerminalIdRequest) => Promise<void>
  attachTerminal: (request: TerminalIdRequest) => Promise<TerminalAttachResult>
  detachTerminal: (request: TerminalIdRequest) => Promise<void>
  reportTerminalFocus: (request: TerminalIdRequest) => Promise<void>
  reportTerminalBlur: (request: TerminalIdRequest) => Promise<void>
  reportTerminalUserInput: (request: TerminalIdRequest) => Promise<void>
  resetAttentionSession: () => Promise<void>
  dismissAttentionForTerminals: (request: AttentionDismissRequest) => Promise<void>
  loadWorkspace: () => Promise<Workspace>
  saveWorkspace: (workspace: Workspace) => Promise<void>
  addProject: () => Promise<AddProjectResult>
  checkProjectPath: (path: string) => Promise<boolean>
  revealProjectInFolder: (path: string) => Promise<void>
  readClipboard: () => Promise<ClipboardReadResult>
  writeClipboard: (request: ClipboardWriteRequest) => Promise<void>
  onTerminalData: (callback: (event: TerminalDataEvent) => void) => Unsubscribe
  onTerminalExit: (callback: (event: TerminalExitEvent) => void) => Unsubscribe
  onTerminalSpawnError: (callback: (event: TerminalSpawnErrorEvent) => void) => Unsubscribe
  onTerminalBell: (callback: (event: TerminalBellEvent) => void) => Unsubscribe
  onAttentionChanged: (callback: (event: AttentionChangedEvent) => void) => Unsubscribe
}
