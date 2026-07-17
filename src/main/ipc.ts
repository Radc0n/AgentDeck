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
  type TerminalDataEvent,
  type TerminalExitEvent,
  type TerminalIdRequest,
  type TerminalResizeRequest,
  type TerminalSpawnErrorEvent,
  type TerminalWriteRequest
} from '../shared/ipc'
import type { TerminalProfile, Workspace } from '../shared/types'
import {
  applyAttentionEvent,
  createAttentionContext,
  dismissAttention,
  evaluateAttentionTimeout,
  type AttentionContext,
  type AttentionEvent
} from './attentionMonitor'
import { containsRealBell, stripRealBell } from './bellDetect'
import { resolveProfile } from './profiles'
import * as ptyManager from './ptyManager'
import { loadWorkspace, saveWorkspace } from './sessionStore'

const attentionByTerminal = new Map<string, AttentionContext>()
// Her terminalin profili. Bildirim (needsAttention) yalnızca ajan profilli terminallere
// (grok/claude/cursor/codex/antigravity/custom) izin verilir; düz "shell" başıboş bir bell (\x07)
// gönderse bile noktayı yakmamalı.
const terminalProfiles = new Map<string, TerminalProfile>()
// Bildirim gösterilmiş terminaller. Kullanıcı o terminale bakana (focus/userInput)
// kadar aynı terminal için tekrar bildirim göstermeyiz — bell akışı (\x07) sık geldiğinde
// oluşan spam'i önler.
const notifiedTerminals = new Set<string>()
const attachedTerminals = new Set<string>()
const pendingReattachTerminals = new Set<string>()
const terminalOutputBuffers = new Map<string, string>()
const MAX_TERMINAL_BUFFER_CHARS = 512_000
let attentionTimer: ReturnType<typeof setInterval> | null = null
let ptyCallbacksRegistered = false

function isAgentTerminal(terminalId: string): boolean {
  const profile = terminalProfiles.get(terminalId)
  return (
    profile === 'grok' ||
    profile === 'claude' ||
    profile === 'cursor' ||
    profile === 'codex' ||
    profile === 'antigravity' ||
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
}

function isWindowFocused(): boolean {
  const window = BrowserWindow.getAllWindows()[0]
  return !!window && !window.isDestroyed() && window.isFocused()
}

function maybeNotifyAttention(terminalId: string): void {
  if (!Notification.isSupported()) {
    return
  }

  // Pencere odaktaysa kullanıcı zaten uygulamaya bakıyor; in-app glow yeterli.
  if (isWindowFocused()) {
    return
  }

  // Bu terminal için zaten bildirim gösterildiyse, kullanıcı ona bakana (focus/userInput)
  // kadar tekrar gösterme.
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

    // OS bildirimi yalnızca bell (\x07) ile tetiklenir.
    // In-app rozet: bell veya kullanıcı girdisinden sonra gelen ajan yanıtının susması.
    if (next.state === 'needsAttention' && options.notify) {
      maybeNotifyAttention(terminalId)
    }
  }
}

function appendTerminalOutput(terminalId: string, data: string): void {
  const merged = (terminalOutputBuffers.get(terminalId) ?? '') + data
  terminalOutputBuffers.set(
    terminalId,
    merged.length > MAX_TERMINAL_BUFFER_CHARS
      ? merged.slice(merged.length - MAX_TERMINAL_BUFFER_CHARS)
      : merged
  )
}

function sendTerminalData(terminalId: string, data: string): void {
  const payload: TerminalDataEvent = { terminalId, data: stripRealBell(data) }
  sendToRenderer(IPC_CHANNELS.TERMINAL_DATA, payload)
}

function handleAttentionEvent(terminalId: string, event: AttentionEvent): void {
  // Kullanıcı terminale baktığında/yazdığında "bildirildi" işaretini temizle —
  // sonraki gerçek dikkat olayında yeniden bildirilebilsin.
  if (event === 'focus' || event === 'userInput') {
    notifiedTerminals.delete(terminalId)
  }

  const current = attentionByTerminal.get(terminalId) ?? createAttentionContext()
  const next = applyAttentionEvent(current, event, Date.now())
  updateAttentionState(terminalId, next, {
    notify: event === 'bell'
  })
}

function ensurePtyCallbacks(): void {
  if (ptyCallbacksRegistered) {
    return
  }
  ptyCallbacksRegistered = true

  ptyManager.onData((terminalId, data) => {
    appendTerminalOutput(terminalId, data)

    if (attachedTerminals.has(terminalId)) {
      sendTerminalData(terminalId, data)
    }

    // Bildirim noktası yalnızca ajan terminalinin gönderdiği gerçek bell ile yanar.
    // Düz shell'in başıboş beep'i 'output' sayılır ve noktayı yakmaz.
    if (containsRealBell(data) && isAgentTerminal(terminalId)) {
      handleAttentionEvent(terminalId, 'bell')
    } else {
      handleAttentionEvent(terminalId, 'output')
    }
  })

  ptyManager.onExit((terminalId, exitCode, signal) => {
    attentionByTerminal.delete(terminalId)
    terminalProfiles.delete(terminalId)
    notifiedTerminals.delete(terminalId)
    attachedTerminals.delete(terminalId)
    pendingReattachTerminals.delete(terminalId)
    terminalOutputBuffers.delete(terminalId)
    const payload: TerminalExitEvent = { terminalId, exitCode, signal }
    sendToRenderer(IPC_CHANNELS.TERMINAL_EXIT, payload)
  })

  ptyManager.onSpawnError((terminalId, message) => {
    sendSpawnError(terminalId, message)
  })
}

function startAttentionPolling(): void {
  if (attentionTimer) {
    return
  }

  // Yalnızca ajan terminallerini yokla: ajan yanıtı sustuğunda koşullu needsAttention.
  attentionTimer = setInterval(() => {
    const now = Date.now()
    for (const [terminalId, context] of attentionByTerminal) {
      if (!isAgentTerminal(terminalId)) {
        continue
      }
      const next = evaluateAttentionTimeout(context, now)
      if (next.state !== context.state) {
        updateAttentionState(terminalId, next)
      } else {
        attentionByTerminal.set(terminalId, next)
      }
    }
  }, 1000)
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
  ptyManager.spawnTerminal(request.id, spec)
  attentionByTerminal.set(request.id, createAttentionContext())
  terminalProfiles.set(request.id, request.profile)
}

export function registerIpcHandlers(): void {
  ensurePtyCallbacks()
  startAttentionPolling()

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CREATE,
    (_event, request: CreateTerminalRequest): CreateTerminalResult => {
      try {
        if (ptyManager.hasTerminal(request.id)) {
          if (!attentionByTerminal.has(request.id)) {
            attentionByTerminal.set(request.id, createAttentionContext())
          }
          terminalProfiles.set(request.id, request.profile)
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

  ipcMain.handle(IPC_CHANNELS.TERMINAL_ATTACH, (_event, request: TerminalIdRequest) => {
    const reattach = pendingReattachTerminals.has(request.terminalId)
    if (reattach) {
      pendingReattachTerminals.delete(request.terminalId)
    }

    attachedTerminals.add(request.terminalId)
    return {
      data: stripRealBell(terminalOutputBuffers.get(request.terminalId) ?? ''),
      reattach
    }
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_DETACH, (_event, request: TerminalIdRequest): void => {
    if (!attachedTerminals.delete(request.terminalId)) {
      return
    }

    if (ptyManager.hasTerminal(request.terminalId)) {
      pendingReattachTerminals.add(request.terminalId)
    }
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_WRITE, (_event, request: TerminalWriteRequest): void => {
    try {
      ptyManager.write(request.terminalId, request.data)
    } catch (error) {
      throw new Error(toErrorMessage(error, 'Terminal girdisi yazılamadı.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_RESIZE, (_event, request: TerminalResizeRequest): void => {
    try {
      ptyManager.resize(request.terminalId, request.cols, request.rows, {
        force: request.force === true
      })
    } catch (error) {
      throw new Error(toErrorMessage(error, 'Terminal boyutu değiştirilemedi.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_KILL, (_event, request: TerminalIdRequest): void => {
    try {
      ptyManager.kill(request.terminalId)
      attentionByTerminal.delete(request.terminalId)
      terminalProfiles.delete(request.terminalId)
      notifiedTerminals.delete(request.terminalId)
      attachedTerminals.delete(request.terminalId)
      pendingReattachTerminals.delete(request.terminalId)
      terminalOutputBuffers.delete(request.terminalId)
    } catch (error) {
      throw new Error(toErrorMessage(error, 'Terminal kapatılamadı.'))
    }
  })

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
