import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { getImportPreview, importSpreadsheet, importSpreadsheetNoYear, type ImportPreview, type ImportResult } from '../import/spreadsheet-import'

interface ImportExecuteArgs {
  filePath: string
  collectionOverrides: Record<string, string>
  downloadPhotos: boolean
}

export function registerImportHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.IMPORT.SELECT_FILE, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Excel Spreadsheet', extensions: ['xlsx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    IPC_CHANNELS.IMPORT.PREVIEW,
    async (_event, filePath: string): Promise<ImportPreview> => {
      return getImportPreview(filePath)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.IMPORT.EXECUTE,
    async (_event, args: ImportExecuteArgs): Promise<ImportResult> => {
      return importSpreadsheet(
        args.filePath,
        args.collectionOverrides,
        args.downloadPhotos // maps to importPhotos param
      )
    }
  )

  // One-time import: only coins without year (ancient coins, etc.)
  ipcMain.handle(
    IPC_CHANNELS.IMPORT.EXECUTE_NO_YEAR,
    async (_event, args: ImportExecuteArgs): Promise<ImportResult> => {
      return importSpreadsheetNoYear(
        args.filePath,
        args.collectionOverrides,
        args.downloadPhotos
      )
    }
  )
}
