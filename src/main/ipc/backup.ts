import { ipcMain, dialog, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { exportBackup } from '../export/backup'
import { previewBackup, importBackup } from '../import/backup'
import type { BackupPreview, ImportResult } from '@shared/types'

export function registerBackupHandlers(): void {
  // --- Export ---
  ipcMain.handle(IPC_CHANNELS.BACKUP.EXPORT_EXECUTE, async (): Promise<string | null> => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const now = new Date().toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog(win, {
      title: 'Export Backup',
      defaultPath: `coin-collection-backup-${now}.zip`,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
    })

    if (result.canceled || !result.filePath) return null

    try {
      await exportBackup(result.filePath, {
        onProgress: (stage, current, total, message) => {
          win.webContents.send('backup:export-progress', { stage, current, total, message })
        }
      })
      return result.filePath
    } catch (err) {
      console.error('[backup] Export failed:', err)
      throw err
    }
  })

  // --- Import: Select file ---
  ipcMain.handle(IPC_CHANNELS.BACKUP.IMPORT_SELECT, async (): Promise<string | null> => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      title: 'Import Backup',
      properties: ['openFile'],
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // --- Import: Preview ---
  ipcMain.handle(
    IPC_CHANNELS.BACKUP.IMPORT_PREVIEW,
    async (_event, zipPath: string): Promise<BackupPreview> => {
      return previewBackup(zipPath)
    }
  )

  // --- Import: Execute ---
  ipcMain.handle(
    IPC_CHANNELS.BACKUP.IMPORT_EXECUTE,
    async (_event, zipPath: string): Promise<ImportResult> => {
      return importBackup(zipPath, {
        onProgress: (stage, current, total, message) => {
          const win = BrowserWindow.getFocusedWindow()
          if (win) {
            win.webContents.send('backup:import-progress', { stage, current, total, message })
          }
        }
      })
    }
  )
}
