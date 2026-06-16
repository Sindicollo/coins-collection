import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { listCoinsByCollection, getCoin, bulkAppendLlmInfo, type LlmNoteUpdate } from '../database/repositories/coins'
import type { LlmExportCoin, AiCoinInfo, AiBulkQuery, AiSingleQuery, LlmConfig, LlmTestResult } from '@shared/types'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { createLlmModel } from '../llm/providers'
import { queryBulkCoins, querySingleCoin } from '../llm/chains'
import { loadLlmConfig, saveLlmConfig } from '../llm/config'
import { HumanMessage } from '@langchain/core/messages'

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
  // --- Existing handlers ---

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

  // --- New AI query handlers ---

  ipcMain.handle(
    IPC_CHANNELS.LLM.QUERY_BULK,
    async (_event, query: AiBulkQuery): Promise<AiCoinInfo[]> => {
      console.log('[llm:ipc] QUERY_BULK:', { collectionId: query.collectionId, queryType: query.queryType })
      try {
        const coins = listCoinsByCollection(query.collectionId)
        console.log('[llm:ipc] coins loaded:', coins.length)
        if (coins.length === 0) {
          console.warn('[llm:ipc] No coins in collection, returning empty')
          return []
        }

        const model = createLlmModel(query.config)
        console.log('[llm:ipc] model created, running chain...')
        const result = await queryBulkCoins(model, coins, query.queryType, query.locale || 'en')
        console.log('[llm:ipc] chain result:', result.length, 'coins')
        return result
      } catch (err) {
        console.error('[llm:ipc] QUERY_BULK error:', err)
        throw err
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.LLM.QUERY_SINGLE,
    async (_event, query: AiSingleQuery): Promise<AiCoinInfo> => {
      const coin = getCoin(query.coinId)
      if (!coin) {
        throw new Error(`Coin not found: ${query.coinId}`)
      }

      const model = createLlmModel(query.config)
      return querySingleCoin(model, coin, query.queryType, query.locale || 'en')
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.LLM.GET_CONFIG,
    async (): Promise<LlmConfig> => {
      return loadLlmConfig()
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.LLM.SET_CONFIG,
    async (_event, config: LlmConfig): Promise<void> => {
      saveLlmConfig(config)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.LLM.TEST_CONNECTION,
    async (_event, config?: LlmConfig): Promise<LlmTestResult> => {
      try {
        const model = createLlmModel(config)
        const effectiveConfig = config ? { ...loadLlmConfig(), ...config } : loadLlmConfig()
        console.log('[llm] Testing connection:', {
          provider: effectiveConfig.provider,
          model: effectiveConfig.model,
          baseUrl: effectiveConfig.baseUrl
        })
        await model.invoke([new HumanMessage('Reply with just the word "OK"')])
        return { ok: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[llm] Connection test failed:', message)
        return { ok: false, error: message }
      }
    }
  )
}
