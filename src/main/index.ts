import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { getDatabase, closeDatabase } from './database'
import { registerCollectionHandlers } from './ipc/collections'
import { registerCoinHandlers } from './ipc/coins'
import { registerPhotoHandlers } from './ipc/photos'
import { registerPreferenceHandlers } from './ipc/preferences'
import { registerImportHandlers } from './ipc/import'
import { registerPriceHandlers } from './ipc/prices'
import { registerBackupHandlers } from './ipc/backup'
import { registerExportHandlers } from './ipc/export'
import { registerExportPdfHandlers } from './ipc/export-pdf'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    },
    title: 'Coin Collection'
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.coincollection.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database
  getDatabase()

  // Register IPC handlers
  registerCollectionHandlers()
  registerCoinHandlers()
  registerPhotoHandlers()
  registerPreferenceHandlers()
  registerImportHandlers()
  registerPriceHandlers()
  registerBackupHandlers()
  registerExportHandlers()
  registerExportPdfHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
