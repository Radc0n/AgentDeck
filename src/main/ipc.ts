import { BrowserWindow, Notification, dialog, ipcMain, shell } from 'electron'
import { existsSync } from 'fs'
import { basename } from 'path'
import {
  IPC_CHANNELS,
  type AddProjectResult,
  type AttentionChangedEvent,
  type AttentionDismissRequest,
  type CreateTerminalRequest,
  type CreateTerminalResult,
  type TerminalExitEvent,
  type TerminalIdRequest,
  type TerminalSpawnErrorEvent,
  type TerminalStateEvent
} from '../shared/ipc'
import type { TerminalProfile, Workspace } from '../shared/types'
import {
  applyAttentionEvent,
  createAttentionContext,
  dismissAttention,
  type AttentionContext,
  type AttentionEvent
} from './attentionMonitor'
import * as nativeSessionManager from './nativeSessionManager'
import { resolveProfile } from './profiles'
import { loadWorkspace, saveWorkspace } from './sessionStore'

const attentionByTerminal = new Map<string, AttentionContext>()
// Bildirim yalnızca ajan profilli terminallere (claude/cursor/codex/gemini/custom).
const terminalProfiles = new Map<string, TerminalProfile>()
const notifiedTerminals = new Set<string>()
let sessionCallbacksRegistered = false

function isAgentTerminal(terminalId: string): boolean {
  const profile = terminalProfiles.get(terminalId)
  return (
    profile === 'claude' ||
    profile === 'cursor' ||
    profile === 'codex' ||
    profile === 'gemini' ||
    profile === 'custom'
  )
}

function getRendererWebContents(): Electron.WebContents | null {
  const window = BrowserWindow.getAllWindows()[0]
  if (!window || window.isDestroyed()) {
    return null
  }
  return window.webContents
}

function sendToRenderer<T>(channel: string, payload: T): void {
  const webContents = getRendererWebContents()
  if (!webContents || webContents.isDestroyed()) {
    return
  }
  webContents.send(channel, payload)
}

function emitAttentionChanged(event: AttentionChangedEvent): void {
  sendToRenderer(IPC_CHANNELS.ATTENTION_CHANGED, event)
}

function sendSpawnError(terminalId: string, message: string): void {
  const payload: TerminalSpawnErrorEvent = { terminalId, message }
  sendToRenderer(IPC_CHANNELS.TERMINAL_SPAWN_ERROR, payload)
  sendToRenderer(IPC_CHANNELS.TERMINAL_STATE, {
    terminalId,
    state: 'error',
    message
  } satisfies TerminalStateEvent)
}

function sendTerminalState(event: TerminalStateEvent): void {
  sendToRenderer(IPC_CHANNELS.TERMINAL_STATE, event)
}

function isWindowFocused(): boolean {
  const window = BrowserWindow.getAllWindows()[0]
  return !!window && !window.isDestroyed() && window.isFocused()
}

function maybeNotifyAttention(terminalId: string): void {
  if (!Notification.isSupported()) {
    return
  }

  if (isWindowFocused()) {
    return
  }

  if (notifiedTerminals.has(terminalId)) {
    return
  }
  notifiedTerminals.add(terminalId)

  const notification = new Notification({
    title: 'AgentDeck',
    body: 'Bir terminal dikkatinizi bekliyor.',
    silent: true
  })
  notification.show()
}

function resetAttentionSession(): void {
  for (const [terminalId, ctx] of attentionByTerminal) {
    if (ctx.state === 'idle' && !ctx.hasUserEngaged) {
      continue
    }
    updateAttentionState(terminalId, createAttentionContext())
  }
}

function dismissAttentionForTerminals(terminalIds: string[]): void {
  for (const terminalId of terminalIds) {
    const ctx = attentionByTerminal.get(terminalId)
    if (!ctx) {
      continue
    }
    const next = dismissAttention(ctx)
    if (next.state !== ctx.state) {
      updateAttentionState(terminalId, next)
    }
  }
}

function updateAttentionState(
  terminalId: string,
  next: AttentionContext,
  options: { notify?: boolean } = {}
): void {
  const previous = attentionByTerminal.get(terminalId)
  attentionByTerminal.set(terminalId, next)

  if (!previous || previous.state !== next.state) {
    emitAttentionChanged({ terminalId, state: next.state })

    if (next.state === 'needsAttention' && options.notify) {
      maybeNotifyAttention(terminalId)
    }
  }
}

function handleAttentionEvent(terminalId: string, event: AttentionEvent): void {
  if (event === 'focus' || event === 'userInput') {
    notifiedTerminals.delete(terminalId)
  }

  const current = attentionByTerminal.get(terminalId) ?? createAttentionContext()
  const next = applyAttentionEvent(current, event, Date.now())
  updateAttentionState(terminalId, next, {
    notify: event === 'bell'
  })
}

function ensureSessionCallbacks(): void {
  if (sessionCallbacksRegistered) {
    return
  }
  sessionCallbacksRegistered = true

  nativeSessionManager.onExit((terminalId, exitCode, signal) => {
    const wasAgent = isAgentTerminal(terminalId)

    attentionByTerminal.delete(terminalId)
    terminalProfiles.delete(terminalId)
    notifiedTerminals.delete(terminalId)

    sendTerminalState({
      terminalId,
      state: 'exited',
      exitCode
    })

    const payload: TerminalExitEvent = { terminalId, exitCode, signal }
    sendToRenderer(IPC_CHANNELS.TERMINAL_EXIT, payload)

    // Native modda PTY çıktısı yok: ajan süreci bittiğinde dikkat çek.
    if (wasAgent) {
      updateAttentionState(
        terminalId,
        {
          ...createAttentionContext(),
          state: 'needsAttention',
          responseNotified: true
        },
        { notify: true }
      )
    }
  })

  nativeSessionManager.onSpawnError((terminalId, message) => {
    sendSpawnError(terminalId, message)
  })
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

function spawnTerminalFromRequest(request: CreateTerminalRequest): void {
  const spec = resolveProfile(request.profile, {
    cwd: request.cwd,
    command: request.command
  })
  nativeSessionManager.spawnSession(request.id, spec, {
    title: request.title ?? request.id
  })
  attentionByTerminal.set(request.id, createAttentionContext())
  terminalProfiles.set(request.id, request.profile)
  sendTerminalState({ terminalId: request.id, state: 'running' })
}

export function registerIpcHandlers(): void {
  ensureSessionCallbacks()

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CREATE,
    (_event, request: CreateTerminalRequest): CreateTerminalResult => {
      try {
        if (nativeSessionManager.hasSession(request.id)) {
          if (!attentionByTerminal.has(request.id)) {
            attentionByTerminal.set(request.id, createAttentionContext())
          }
          terminalProfiles.set(request.id, request.profile)
          sendTerminalState({ terminalId: request.id, state: 'running' })
          return { ok: true }
        }

        spawnTerminalFromRequest(request)
        return { ok: true }
      } catch (error) {
        const message = toErrorMessage(error, 'Terminal oluşturulamadı.')
        sendSpawnError(request.id, message)
        throw new Error(message)
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.TERMINAL_KILL, (_event, request: TerminalIdRequest): void => {
    try {
      if (nativeSessionManager.hasSession(request.terminalId)) {
        nativeSessionManager.killSession(request.terminalId)
      }
      attentionByTerminal.delete(request.terminalId)
      terminalProfiles.delete(request.terminalId)
      notifiedTerminals.delete(request.terminalId)
    } catch (error) {
      throw new Error(toErrorMessage(error, 'Terminal kapatılamadı.'))
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_FOCUS_WINDOW,
    (_event, request: TerminalIdRequest): boolean => {
      const ok = nativeSessionManager.focusSession(request.terminalId)
      if (ok && attentionByTerminal.has(request.terminalId)) {
        handleAttentionEvent(request.terminalId, 'focus')
        handleAttentionEvent(request.terminalId, 'userInput')
      }
      return ok
    }
  )

  ipcMain.handle(IPC_CHANNELS.ATTENTION_RESET_SESSION, (): void => {
    resetAttentionSession()
  })

  ipcMain.handle(
    IPC_CHANNELS.ATTENTION_DISMISS_TERMINALS,
    (_event, request: AttentionDismissRequest): void => {
      dismissAttentionForTerminals(request.terminalIds)
    }
  )

  ipcMain.handle(IPC_CHANNELS.TERMINAL_REPORT_FOCUS, (_event, request: TerminalIdRequest): void => {
    if (!attentionByTerminal.has(request.terminalId)) {
      return
    }
    handleAttentionEvent(request.terminalId, 'focus')
  })

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_REPORT_USER_INPUT,
    (_event, request: TerminalIdRequest): void => {
      if (!attentionByTerminal.has(request.terminalId)) {
        return
      }
      handleAttentionEvent(request.terminalId, 'userInput')
    }
  )

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LOAD, (): Workspace => {
    try {
      return loadWorkspace()
    } catch (error) {
      throw new Error(toErrorMessage(error, 'Oturum yüklenemedi.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SAVE, (_event, workspace: Workspace): void => {
    try {
      saveWorkspace(workspace)
    } catch (error) {
      throw new Error(toErrorMessage(error, 'Oturum kaydedilemedi.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_ADD, async (): Promise<AddProjectResult> => {
    const parentWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

    const result = await dialog.showOpenDialog(parentWindow ?? undefined, {
      title: 'Proje klasörü seçin',
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { path: null }
    }

    const path = result.filePaths[0]
    return {
      path,
      name: basename(path)
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CHECK_PATH, (_event, path: string): boolean => {
    if (typeof path !== 'string' || path.trim() === '') {
      return false
    }

    try {
      return existsSync(path)
    } catch {
      return false
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_REVEAL_IN_FOLDER, async (_event, path: string): Promise<void> => {
    if (typeof path !== 'string' || path.trim() === '') {
      throw new Error('Geçersiz proje yolu.')
    }

    if (!existsSync(path)) {
      throw new Error('Proje klasörüne erişilemiyor.')
    }

    const errorMessage = await shell.openPath(path)
    if (errorMessage) {
      throw new Error(errorMessage)
    }
  })
}
