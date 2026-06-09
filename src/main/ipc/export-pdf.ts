import { ipcMain, dialog, BrowserWindow } from 'electron'
import { copyFileSync, existsSync, unlinkSync } from 'fs'
import { IPC_CHANNELS } from '@shared/constants'
import { exportCollectionsToPdf } from '../export/collection-pdf'

export function registerExportPdfHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.EXPORT.PDF,
    async (
      event,
      options: {
        collectionIds: string[]
        includeSold: boolean
        includeImages: boolean
        includePurchaseInfo: boolean
        locale: 'en' | 'ru'
      }
    ): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return null

      const sendProgress = (
        stage: string,
        current: number,
        total: number,
        message: string
      ) => {
        win.webContents.send('export:progress', { stage, current, total, message })
      }

      let tmpFilePath: string | null = null

      try {
        tmpFilePath = await exportCollectionsToPdf({
          ...options,
          onProgress: sendProgress
        })

        if (!tmpFilePath || !existsSync(tmpFilePath)) {
          return null
        }
      } catch (err) {
        console.error('[export-pdf] Failed to generate PDF:', err)
        return null
      }

      const result = await dialog.showSaveDialog(win, {
        title: options.locale === 'ru' ? 'Сохранить PDF' : 'Save PDF',
        defaultPath:
          options.locale === 'ru'
            ? `коллекция-монет-${Date.now()}.pdf`
            : `coin-collection-${Date.now()}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      })

      if (result.canceled || !result.filePath) {
        if (tmpFilePath && existsSync(tmpFilePath)) {
          unlinkSync(tmpFilePath)
        }
        return null
      }

      try {
        copyFileSync(tmpFilePath, result.filePath)
      } catch (err) {
        console.error('[export-pdf] Failed to copy export file:', err)
        return null
      } finally {
        if (tmpFilePath && existsSync(tmpFilePath)) {
          unlinkSync(tmpFilePath)
        }
      }

      sendProgress('Done', 1, 1, 'Export complete')
      return result.filePath
    }
  )
}
