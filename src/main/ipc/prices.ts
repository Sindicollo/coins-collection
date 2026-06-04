import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { listCoinsByCollection, bulkAppendNotes, type PriceUpdate } from '../database/repositories/coins'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

interface ExportCoin {
  id: string
  country: string | null
  denomination: string
  year: number | null
  condition: string | null
}

export function registerPriceHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.PRICE.EXPORT_ALL,
    async (_event, collectionId: string): Promise<string | null> => {
      const coins = listCoinsByCollection(collectionId)
      const exportData: ExportCoin[] = coins.map((c) => ({
        id: c.id,
        country: c.country,
        denomination: c.denomination,
        year: c.year,
        condition: c.condition
      }))

      const now = new Date()
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const defaultFilename = `collection-export-${dateStr}.json`

      const result = await dialog.showSaveDialog({
        defaultPath: join(homedir(), 'Downloads', defaultFilename),
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })

      if (result.canceled || !result.filePath) return null

      writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8')
      return result.filePath
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PRICE.IMPORT_PRICES,
    async (): Promise<{ updated: number; skipped: number; filePath: string } | null> => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })

      if (result.canceled || result.filePaths.length === 0) return null

      const filePath = result.filePaths[0]
      const content = readFileSync(filePath, 'utf-8')
      const parsed: unknown = JSON.parse(content)

      if (!Array.isArray(parsed)) {
        console.error('[prices] Invalid JSON: expected array')
        return null
      }

      const updates: PriceUpdate[] = parsed
        .filter(
          (item): item is PriceUpdate =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as PriceUpdate).id === 'string' &&
            typeof (item as PriceUpdate).prices === 'string'
        )

      const { updated, skipped } = bulkAppendNotes(updates)
      return { updated, skipped, filePath }
    }
  )
}
