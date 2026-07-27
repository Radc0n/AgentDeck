import { app, BrowserWindow, Menu, net, protocol, session } from 'electron'
import { existsSync } from 'fs'
import { isAbsolute, join, relative, resolve } from 'path'
import { pathToFileURL } from 'url'
import { registerIpcHandlers, trustRenderer } from './ipc'

const APP_SCHEME = 'agentdeck'
const APP_HOST = 'bundle'

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
])

function configureApplicationMenu(): void {
  // Windows/Linux: varsayılan File/Edit menüsünü kaldır; Alt ile geçici görünmesin.
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
  }
}

/** Dev: build/icon.ico. Packaged Windows uses the .exe icon automatically. */
function resolveWindowIcon(): string | undefined {
  if (app.isPackaged) return undefined
  const iconPath = join(__dirname, '../../build/icon.ico')
  return existsSync(iconPath) ? iconPath : undefined
}

function registerApplicationProtocol(): void {
  const rendererRoot = resolve(__dirname, '../renderer')

  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url)
    if (url.host !== APP_HOST) {
      return new Response('Not found', { status: 404 })
    }

    let pathname: string
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return new Response('Bad request', { status: 400 })
    }

    const requestedPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const pathToServe = resolve(rendererRoot, requestedPath)
    const relativePath = relative(rendererRoot, pathToServe)
    const isSafe =
      relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath)

    if (!isSafe || !existsSync(pathToServe)) {
      return new Response('Not found', { status: 404 })
    }

    return net.fetch(pathToFileURL(pathToServe).toString())
  })
}

function configureSessionSecurity(): void {
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  session.defaultSession.on('will-download', (event) => {
    event.preventDefault()
  })
}

function secureWindowNavigation(mainWindow: BrowserWindow): void {
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl !== mainWindow.webContents.getURL()) {
      event.preventDefault()
    }
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    title: 'AgentDeck',
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  trustRenderer(mainWindow.webContents)
  secureWindowNavigation(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`)
  }
}

app.whenReady().then(() => {
  configureApplicationMenu()
  registerApplicationProtocol()
  configureSessionSecurity()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
