import { app, BrowserWindow, Menu } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'

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

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    title: 'AgentDeck',
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  configureApplicationMenu()
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
