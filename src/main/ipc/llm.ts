import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { listCoinsByCollection, getCoin, bulkAppendLlmInfo, type LlmNoteUpdate } from '../database/repositories/coins'
import type { LlmExportCoin, AiCoinInfo, AiBulkQuery, AiSingleQuery, LlmConfig, LlmTestResult, LlmBulkProgress, Coin } from '@shared/types'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { createLlmModel } from '../llm/providers'
import { queryBulkCoins, querySingleCoin } from '../llm/chains'
import { loadLlmConfig, saveLlmConfig } from '../llm/config'
import { HumanMessage } from '@langchain/core/messages'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildExportData(collectionId: string): LlmExportCoin[] {
  const coins = listCoinsByCollection(collectionId)
  return coins.map((c) => ({
    id: c.id,
    country: c.country,
    denomination: c.denomination,
    year: c.year,
    condition: c.condition,
    composition: c.composition
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

  // Rate limiter: max 5 requests per minute = 12s between starts
  const BATCH_SIZE = 5
  const MIN_INTERVAL_MS = 12000 // 5 req/min

  // Store active bulk query state for cancellation
  const activeQueries = new Map<string, { cancel: () => void }>()

  ipcMain.handle(
    IPC_CHANNELS.LLM.QUERY_BULK,
    async (event, query: AiBulkQuery): Promise<AiCoinInfo[]> => {
      const queryKey = `${query.collectionId}:${query.queryType}`
      console.log('[llm:ipc] QUERY_BULK:', { collectionId: query.collectionId, queryType: query.queryType })

      const coins = listCoinsByCollection(query.collectionId)
      console.log('[llm:ipc] coins loaded:', coins.length)
      if (coins.length === 0) {
        return []
      }

      const locale = query.locale || 'en'
      const allResults: AiCoinInfo[] = []
      const batches: Coin[][] = []
      for (let i = 0; i < coins.length; i += BATCH_SIZE) {
        batches.push(coins.slice(i, i + BATCH_SIZE))
      }

      let cancelled = false
      activeQueries.set(queryKey, { cancel: () => { cancelled = true } })

      try {
        for (let i = 0; i < batches.length; i++) {
          if (cancelled) {
            console.log('[llm:ipc] Query cancelled, stopping at batch', i + 1, 'of', batches.length)
            break
          }

          const batchStart = Date.now()
          console.log(`[llm:ipc] Processing batch ${i + 1}/${batches.length} (${batches[i].length} coins)`)

          const model = createLlmModel(query.config)
          const batchResults = await queryBulkCoins(model, batches[i], query.queryType, locale)
          allResults.push(...batchResults)

          // Emit progress
          event.sender.send(IPC_CHANNELS.LLM.BULK_PROGRESS, {
            processed: allResults.length,
            total: coins.length,
            currentBatch: i + 1,
            totalBatches: batches.length,
            results: batchResults
          } satisfies LlmBulkProgress)

          // Rate limit: wait if needed before next batch
          if (i < batches.length - 1 && !cancelled) {
            const elapsed = Date.now() - batchStart
            const wait = Math.max(0, MIN_INTERVAL_MS - elapsed)
            if (wait > 0) {
              console.log(`[llm:ipc] Rate limit: waiting ${(wait / 1000).toFixed(1)}s before next batch`)
              await sleep(wait)
            }
          }
        }
      } finally {
        activeQueries.delete(queryKey)
      }

      console.log('[llm:ipc] Bulk query complete:', allResults.length, 'results')
      return allResults
    }
  )

  // Cancel active bulk query
  ipcMain.handle('llm:cancel-bulk', async (_event, collectionId: string): Promise<void> => {
    for (const [key, query] of activeQueries) {
      if (key.startsWith(collectionId)) {
        query.cancel()
        activeQueries.delete(key)
      }
    }
  })

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
        const effectiveConfig = config ? { ...loadLlmConfig(), ...config } : loadLlmConfig()
        const hasKey = !!effectiveConfig.apiKey && effectiveConfig.apiKey.length > 3
        console.log('[llm] Testing connection:', {
          provider: effectiveConfig.provider,
          model: effectiveConfig.model,
          baseUrl: effectiveConfig.baseUrl,
          apiKey: hasKey ? `***${effectiveConfig.apiKey.slice(-4)}` : '(missing)'
        })
        if (!hasKey) {
          return { ok: false, error: 'API key is not set. Open AI Settings and enter your API key.' }
        }
        const model = createLlmModel(config)
        try {
          await model.invoke([new HumanMessage('Reply with just the word "OK"')])
        } catch (invokeErr) {
          // LangChain bug: some API responses with empty choices cause
          // "Cannot read properties of undefined (reading 'message')"
          if (
            invokeErr instanceof TypeError &&
            String(invokeErr.message).includes("reading 'message'")
          ) {
            return {
              ok: false,
              error:
                'Model returned empty response. This model may be overloaded or unavailable. Try a different model.'
            }
          }
          throw invokeErr
        }
        return { ok: true }
      } catch (err) {
        // Dump full error for debugging
        try {
          console.error('[llm] Full error:', {
            name: (err as Error).name,
            message: (err as Error).message,
            stack: (err as Error).stack,
            keys: Object.getOwnPropertyNames(err)
          })
        } catch {
          console.error('[llm] Raw error:', err)
        }
        let message = 'Unknown error'
        if (err instanceof Error) {
          message = err.message
          if (err.cause) {
            console.error('[llm] Error cause:', err.cause)
          }
          const status = (err as unknown as Record<string, unknown>).status
          if (typeof status === 'number') {
            message = `HTTP ${status}: ${message}`
          }
        } else if (typeof err === 'string') {
          message = err
        }
        console.error('[llm] Connection test failed:', message)
        return { ok: false, error: message }
      }
    }
  )
}
