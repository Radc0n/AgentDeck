import {
  BrowserWindow,
  Notification,
  dialog,
  ipcMain,
  shell,
  type IpcMainInvokeEvent,
  type WebContents
} from 'electron'
import { basename } from 'path'
import {
  IPC_CHANNELS,
  type IpcChannel,
  type AddProjectResult,
  type AttentionChangedEvent,
  type CreateTerminalRequest,
  type CreateTerminalResult,
  type TerminalDataEvent,
  type TerminalExitEvent,
  type TerminalSpawnErrorEvent
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
import { stripRealBell } from './bellDetect'
import { classifyPtyOutput } from './ptyOutput'
import {
  validateAttentionDismissRequest,
  validateCreateTerminalRequest,
  validateProjectPath,
  validateTerminalIdRequest,
  validateTerminalResizeRequest,
  validateTerminalWriteRequest,
  validateWorkspace
} from './ipcValidation'
import { resolveProfile } from './profiles'
import * as ptyManager from './ptyManager'
import { loadWorkspace, saveWorkspace } from './sessionStore'

const trustedRendererIds = new Set<number>()
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
let focusedTerminalId: string | null = null
const pendingReattachTerminals = new Set<string>()
const terminalOutputBuffers = new Map<string, string>()
const MAX_TERMINAL_BUFFER_CHARS = 512_000
let attentionTimer: ReturnType<typeof setInterval> | null = null
let ptyCallbacksRegistered = false

export function trustRenderer(webContents: WebContents): void {
  const rendererId = webContents.id
  trustedRendererIds.add(rendererId)
  webContents.once('destroyed', () => {
    trustedRendererIds.delete(rendererId)
  })
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (
    !trustedRendererIds.has(event.sender.id) ||
    event.senderFrame !== event.sender.mainFrame
  ) {
    throw new Error('Yetkisiz IPC isteği.')
  }
}

function secureHandle<TArgs extends unknown[], TResult>(
  channel: IpcChannel,
  listener: (event: IpcMainInvokeEvent, ...args: TArgs) => TResult
): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedSender(event)
    return listener(event, ...(args as TArgs))
  })
}

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
    silent: false
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

    // OS toast pencere arkadayken; in-app ses renderer'da. Kaynak bell veya sezgi olabilir.
    if (next.state === 'needsAttention' && options.notify !== false) {
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
  updateAttentionState(terminalId, next)
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

    const kind = classifyPtyOutput(data)
    if (kind === 'notify' && isAgentTerminal(terminalId)) {
      handleAttentionEvent(terminalId, 'bell')
    } else if (kind === 'content') {
      handleAttentionEvent(terminalId, 'output')
    } else if (kind === 'activity') {
      handleAttentionEvent(terminalId, 'activity')
    }
  })

  ptyManager.onExit((terminalId, exitCode, signal) => {
    attentionByTerminal.delete(terminalId)
    terminalProfiles.delete(terminalId)
    notifiedTerminals.delete(terminalId)
    if (focusedTerminalId === terminalId) {
      focusedTerminalId = null
    }
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
      const suppressNotify = focusedTerminalId === terminalId && isWindowFocused()
      const next = evaluateAttentionTimeout(context, now, {}, { suppressNotify })
      if (next.state !== context.state) {
        updateAttentionState(terminalId, next)
      } else {
        attentionByTerminal.set(terminalId, next)
      }
    }
  }, 400)
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

  secureHandle(
    IPC_CHANNELS.TERMINAL_CREATE,
    (_event, rawRequest: unknown): CreateTerminalResult => {
      const request = validateCreateTerminalRequest(rawRequest)
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

  secureHandle(IPC_CHANNELS.TERMINAL_ATTACH, (_event, rawRequest: unknown) => {
    const request = validateTerminalIdRequest(rawRequest)
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

  secureHandle(IPC_CHANNELS.TERMINAL_DETACH, (_event, rawRequest: unknown): void => {
    const request = validateTerminalIdRequest(rawRequest)
    if (!attachedTerminals.delete(request.terminalId)) {
      return
    }

    if (ptyManager.hasTerminal(request.terminalId)) {
      pendingReattachTerminals.add(request.terminalId)
    }
  })

  secureHandle(IPC_CHANNELS.TERMINAL_WRITE, (_event, rawRequest: unknown): void => {
    const request = validateTerminalWriteRequest(rawRequest)
    try {
      ptyManager.write(request.terminalId, request.data)
    } catch (error) {
      throw new Error(toErrorMessage(error, 'Terminal girdisi yazılamadı.'))
    }
  })

  secureHandle(IPC_CHANNELS.TERMINAL_RESIZE, (_event, rawRequest: unknown): void => {
    const request = validateTerminalResizeRequest(rawRequest)
    try {
      ptyManager.resize(request.terminalId, request.cols, request.rows, {
        force: request.force === true
      })
    } catch (error) {
      throw new Error(toErrorMessage(error, 'Terminal boyutu değiştirilemedi.'))
    }
  })

  secureHandle(IPC_CHANNELS.TERMINAL_KILL, (_event, rawRequest: unknown): void => {
    const request = validateTerminalIdRequest(rawRequest)
    // PTY yoksa bile (crash sonrası) UI kapatabilsin; kill idempotent.
    try {
      ptyManager.kill(request.terminalId)
    } catch (error) {
      throw new Error(toErrorMessage(error, 'Terminal kapatılamadı.'))
    } finally {
      attentionByTerminal.delete(request.terminalId)
      terminalProfiles.delete(request.terminalId)
      notifiedTerminals.delete(request.terminalId)
      if (focusedTerminalId === request.terminalId) {
        focusedTerminalId = null
      }
      attachedTerminals.delete(request.terminalId)
      pendingReattachTerminals.delete(request.terminalId)
      terminalOutputBuffers.delete(request.terminalId)
    }
  })

  secureHandle(IPC_CHANNELS.ATTENTION_RESET_SESSION, (): void => {
    resetAttentionSession()
  })

  secureHandle(
    IPC_CHANNELS.ATTENTION_DISMISS_TERMINALS,
    (_event, rawRequest: unknown): void => {
      const request = validateAttentionDismissRequest(rawRequest)
      dismissAttentionForTerminals(request.terminalIds)
    }
  )

  secureHandle(
    IPC_CHANNELS.TERMINAL_REPORT_FOCUS,
    (_event, rawRequest: unknown): void => {
      const request = validateTerminalIdRequest(rawRequest)
      const alreadyFocused = focusedTerminalId === request.terminalId
      focusedTerminalId = request.terminalId
      if (!attentionByTerminal.has(request.terminalId)) {
        return
      }
      // Aynı terminalde tekrarlayan mousedown soğumayı sıfırlamasın; yalnızca
      // ilk odak (veya rozeti temizlemek) focus olayı üretsin.
      if (alreadyFocused) {
        const current = attentionByTerminal.get(request.terminalId)
        if (current?.state === 'needsAttention') {
          handleAttentionEvent(request.terminalId, 'focus')
        }
        return
      }
      handleAttentionEvent(request.terminalId, 'focus')
    }
  )

  secureHandle(
    IPC_CHANNELS.TERMINAL_REPORT_BLUR,
    (_event, rawRequest: unknown): void => {
      const request = validateTerminalIdRequest(rawRequest)
      if (focusedTerminalId === request.terminalId) {
        focusedTerminalId = null
      }
    }
  )

  secureHandle(
    IPC_CHANNELS.TERMINAL_REPORT_USER_INPUT,
    (_event, rawRequest: unknown): void => {
      const request = validateTerminalIdRequest(rawRequest)
      if (!attentionByTerminal.has(request.terminalId)) {
        return
      }
      handleAttentionEvent(request.terminalId, 'userInput')
    }
  )

  secureHandle(IPC_CHANNELS.WORKSPACE_LOAD, (): Workspace => {
    try {
      return loadWorkspace()
    } catch (error) {
      throw new Error(toErrorMessage(error, 'Oturum yüklenemedi.'))
    }
  })

  secureHandle(IPC_CHANNELS.WORKSPACE_SAVE, (_event, rawWorkspace: unknown): void => {
    const workspace = validateWorkspace(rawWorkspace)
    try {
      saveWorkspace(workspace)
    } catch (error) {
      throw new Error(toErrorMessage(error, 'Oturum kaydedilemedi.'))
    }
  })

  secureHandle(IPC_CHANNELS.PROJECT_ADD, async (): Promise<AddProjectResult> => {
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

  secureHandle(IPC_CHANNELS.PROJECT_CHECK_PATH, (_event, rawPath: unknown): boolean => {
    let path: string
    try {
      path = validateProjectPath(rawPath)
    } catch {
      return false
    }

    try {
      validateProjectPath(path, true)
      return true
    } catch {
      return false
    }
  })

  secureHandle(
    IPC_CHANNELS.PROJECT_REVEAL_IN_FOLDER,
    async (_event, rawPath: unknown): Promise<void> => {
      const path = validateProjectPath(rawPath, true)
      const errorMessage = await shell.openPath(path)
      if (errorMessage) {
        throw new Error(errorMessage)
      }
    }
  )
}
