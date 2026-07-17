import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC_CHANNELS,
  type AgentDeckAPI,
  type AttentionChangedEvent,
  type CreateTerminalRequest,
  type CreateTerminalResult,
  type TerminalExitEvent,
  type TerminalIdRequest,
  type TerminalSpawnErrorEvent,
  type TerminalStateEvent
} from '../shared/ipc'
import type { Workspace } from '../shared/types'

const agentdeck: AgentDeckAPI = {
  createTerminal: (request: CreateTerminalRequest): Promise<CreateTerminalResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, request),

  killTerminal: (request: TerminalIdRequest): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_KILL, request),

  focusTerminalWindow: (request: TerminalIdRequest): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_FOCUS_WINDOW, request),

  reportTerminalFocus: (request: TerminalIdRequest): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_REPORT_FOCUS, request),

  reportTerminalUserInput: (request: TerminalIdRequest): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_REPORT_USER_INPUT, request),

  resetAttentionSession: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.ATTENTION_RESET_SESSION),

  dismissAttentionForTerminals: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.ATTENTION_DISMISS_TERMINALS, request),

  loadWorkspace: (): Promise<Workspace> => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LOAD),

  saveWorkspace: (workspace: Workspace): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SAVE, workspace),

  addProject: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_ADD),

  checkProjectPath: (path: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CHECK_PATH, path),

  revealProjectInFolder: (path: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_REVEAL_IN_FOLDER, path),

  onTerminalExit: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: TerminalExitEvent): void => {
      callback(payload)
    }
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_EXIT, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_EXIT, listener)
    }
  },

  onTerminalSpawnError: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: TerminalSpawnErrorEvent): void => {
      callback(payload)
    }
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_SPAWN_ERROR, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_SPAWN_ERROR, listener)
    }
  },

  onTerminalState: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: TerminalStateEvent): void => {
      callback(payload)
    }
    ipcRenderer.on(IPC_CHANNELS.TERMINAL_STATE, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_STATE, listener)
    }
  },

  onAttentionChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: AttentionChangedEvent): void => {
      callback(payload)
    }
    ipcRenderer.on(IPC_CHANNELS.ATTENTION_CHANGED, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.ATTENTION_CHANGED, listener)
    }
  }
}

contextBridge.exposeInMainWorld('agentdeck', agentdeck)
