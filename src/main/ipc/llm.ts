import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { listCoinsByCollection, bulkAppendLlmInfo, type LlmNoteUpdate } from '../database/repositories/coins'
import type { LlmExportCoin } from '@shared/types'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

function buildExportData(collectionId: string): LlmExportCoin[] {
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
    async (_event, collectionId: string): Promise<LlmExportCoin[]> => {
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

      let parsed: unknown
      try {
        const content = readFileSync(filePath, 'utf-8')
        parsed = JSON.parse(content)
      } catch (err) {
        console.error('[llm] Failed to read or parse file:', err)
        return null
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        console.error('[llm] Invalid JSON: expected non-empty array, got', typeof parsed)
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

      const skippedByFormat = parsed.length - updates.length
      if (skippedByFormat > 0) {
        console.warn(`[llm] Skipped ${skippedByFormat} items with invalid structure`)
      }

      const { updated, skipped } = bulkAppendLlmInfo(updates)
      return { updated, skipped, filePath }
    }
  )
}
