import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { listCoinsByCollection, bulkAppendLlmInfo, type LlmNoteUpdate } from '../database/repositories/coins'
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

function buildExportData(collectionId: string): ExportCoin[] {
  const coins = listCoinsByCollection(collectionId)
  return coins.map((c) => ({
    id: c.id,
    country: c.country,
    denomination: c.denomination,
    year: c.year,
    condition: c.condition
  }))
}

export function registerLlmHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.LLM.GET_EXPORT_DATA,
    async (_event, collectionId: string): Promise<ExportCoin[]> => {
      return buildExportData(collectionId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.LLM.EXPORT_ALL,
    async (_event, collectionId: string): Promise<string | null> => {
      const exportData = buildExportData(collectionId)

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
    IPC_CHANNELS.LLM.IMPORT_INFO,
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
        console.error('[llm] Invalid JSON: expected array')
        return null
      }

      const updates: LlmNoteUpdate[] = parsed
        .filter(
          (item): item is LlmNoteUpdate =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as LlmNoteUpdate).id === 'string' &&
            typeof (item as LlmNoteUpdate).info === 'string'
        )

      const { updated, skipped } = bulkAppendLlmInfo(updates)
      return { updated, skipped, filePath }
    }
  )
}
