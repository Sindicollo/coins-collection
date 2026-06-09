import { ipcMain, dialog, BrowserWindow } from 'electron'
import { copyFileSync, existsSync, unlinkSync } from 'fs'
import { IPC_CHANNELS } from '@shared/constants'
import { exportCollectionsToExcel } from '../export/collection-excel'

export function registerExportHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.EXPORT.EXCEL,
    async (
      event,
      options: { collectionIds: string[]; includeSold: boolean; includeImages: boolean; locale: 'en' | 'ru' }
    ): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return null

      const sendProgress = (stage: string, current: number, total: number, message: string) => {
        win.webContents.send('export:progress', { stage, current, total, message })
      }

      let tmpFilePath: string | null = null

      try {
        tmpFilePath = await exportCollectionsToExcel({
          ...options,
          onProgress: sendProgress
        })

        if (!tmpFilePath || !existsSync(tmpFilePath)) {
          return null
        }
      } catch (err) {
        console.error('[export] Failed to generate Excel:', err)
        return null
      }

      // Show save dialog
      const result = await dialog.showSaveDialog(win, {
        title: 'Save Excel Export',
        defaultPath: options.locale === 'ru'
          ? `коллекция-монет-${Date.now()}.xlsx`
          : `coin-collection-export-${Date.now()}.xlsx`,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      })

      if (result.canceled || !result.filePath) {
        // Clean up temp file
        if (tmpFilePath && existsSync(tmpFilePath)) {
          unlinkSync(tmpFilePath)
        }
        return null
      }

      try {
        copyFileSync(tmpFilePath, result.filePath)
      } catch (err) {
        console.error('[export] Failed to copy export file:', err)
        return null
      } finally {
        // Clean up temp file
        if (tmpFilePath && existsSync(tmpFilePath)) {
          unlinkSync(tmpFilePath)
        }
      }

      sendProgress('Done', 1, 1, 'Export complete')
      return result.filePath
    }
  )
}
