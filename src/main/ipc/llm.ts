import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { listCoinsByCollection, getCoin } from '../database/repositories/coins'
import { createCoinNote } from '../database/repositories/coin-notes'
import type {
  LlmExportCoin,
  AiCoinInfo,
  AiBulkQuery,
  AiSingleQuery,
  LlmConfig,
  LlmTestResult,
  LlmBulkProgress,
  Coin
} from '@shared/types'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { createLlmModel } from '../llm/providers'
import { queryBulkCoins, querySingleCoin, querySingleCoinWithSearch } from '../llm/chains'
import { loadLlmConfig, saveLlmConfig, saveBulkSession, clearBulkSession, loadBulkSession } from '../llm/config'
import { createSearchTool, testSearchProvider } from '../llm/search'
import { saveAiNote } from '../llm/notes'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { DynamicTool } from '@langchain/core/tools'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'

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

/**
 * Determine what search path to use based on config.
 *
 * Returns:
 *   'agentic'   — bind search tool, use manual tool-call loop (tavily/brave/ddg/searxng)
 *   'builtin'   — OpenRouter server-side search (fetch-hack in providers.ts)
 *   'none'      — no web search
 */
function getSearchPath(config?: Partial<LlmConfig>): 'agentic' | 'builtin' | 'none' {
  const cfg = config ? { ...loadLlmConfig(), ...config } : loadLlmConfig()
  if (!cfg.enableWebSearch) return 'none'
  if (!cfg.search) return 'none'
  if (cfg.search.provider === 'none') return 'none'
  if (cfg.search.provider === 'openrouter_builtin') return 'builtin'
  return 'agentic'
}

function createSearchToolFromConfig(config?: Partial<LlmConfig>): DynamicTool | null {
  const cfg = config ? { ...loadLlmConfig(), ...config } : loadLlmConfig()
  if (!cfg.search || cfg.search.provider === 'none' || cfg.search.provider === 'openrouter_builtin') return null
  return createSearchTool(cfg.search)
}

export function registerLlmHandlers(): void {
  // --- Existing handlers (unchanged) ---

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
        parsed = JSON.parse(readFileSync(filePath, 'utf-8'))
      } catch (err) {
        console.error('[llm] Failed to read or parse file:', err)
        return null
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        console.error('[llm] Invalid JSON: expected non-empty array, got', typeof parsed)
        return null
      }

      const updates: Array<{ id: string; info: string }> = parsed.filter(
        (item): item is { id: string; info: string } =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as { id: string }).id === 'string' &&
          typeof (item as { info: string }).info === 'string'
      )

      let updated = 0
      let skipped = 0
      for (const item of updates) {
        const coin = getCoin(item.id)
        if (!coin) { skipped++; continue }
        createCoinNote({ coinId: item.id, title: 'AI Import', content: item.info })
        updated++
      }
      return { updated, skipped, filePath }
    }
  )

  // --- AI query handlers ---

  const BATCH_SIZE = 5
  const MIN_INTERVAL_MS = 12000 // OpenRouter rate limit: 5 req/min

  const activeQueries = new Map<string, { cancel: () => void }>()

  // ── BULK query ───────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.LLM.QUERY_BULK,
    async (event, query: AiBulkQuery): Promise<AiCoinInfo[]> => {
      const queryKey = `${query.collectionId}:${query.queryType}`
      console.log('[llm:ipc] QUERY_BULK:', {
        collectionId: query.collectionId,
        queryType: query.queryType,
        excludeCoinIds: query.excludeCoinIds?.length || 0
      })

      let coins = listCoinsByCollection(query.collectionId)
      console.log('[llm:ipc] coins loaded:', coins.length)

      // Filter out already-processed coins (resume)
      if (query.excludeCoinIds && query.excludeCoinIds.length > 0) {
        const exclude = new Set(query.excludeCoinIds)
        coins = coins.filter((c) => !exclude.has(c.id))
        console.log('[llm:ipc] after exclude filter:', coins.length)
      }

      if (coins.length === 0) {
        clearBulkSession(query.collectionId, query.queryType)
        return []
      }

      const locale = query.locale || 'en'
      const searchPath = getSearchPath(query.config)
      let cancelled = false
      activeQueries.set(queryKey, { cancel: () => { cancelled = true } })

      try {
        if (searchPath === 'agentic') {
          // ── Agentic path: one coin at a time with tool-calling ──
          const searchTool = createSearchToolFromConfig(query.config)!
          const allResults: AiCoinInfo[] = []

          // Initialize session (existing processed + new coin IDs as we go)
          const existingExcluded = query.excludeCoinIds || []
          const processedIds = new Set(existingExcluded)

          for (let i = 0; i < coins.length; i++) {
            if (cancelled) {
              console.log('[llm:ipc] Agentic bulk cancelled at coin', i + 1, 'of', coins.length)
              // Save partial session for resume
              saveBulkSession({
                collectionId: query.collectionId,
                queryType: query.queryType,
                processedCoinIds: [...processedIds],
                startedAt: Date.now()
              })
              break
            }

            const coin = coins[i]
            const model = createLlmModel(query.config)
            const result = await querySingleCoinWithSearch(
              model,
              searchTool,
              coin,
              query.queryType,
              locale
            )
            allResults.push(result)
            processedIds.add(coin.id)

            // Auto-save to DB (S2 pattern)
            try {
              saveAiNote(coin.id, query.queryType, result.info || JSON.stringify(result))
              saveBulkSession({
                collectionId: query.collectionId,
                queryType: query.queryType,
                processedCoinIds: [...processedIds],
                startedAt: Date.now()
              })
            } catch (err) {
              console.error('[llm:ipc] Failed to save AI note:', err)
            }

            // Emit per-coin progress
            event.sender.send(IPC_CHANNELS.LLM.BULK_PROGRESS, {
              processed: allResults.length,
              total: coins.length,
              currentBatch: i + 1,
              totalBatches: coins.length,
              results: [result]
            } satisfies LlmBulkProgress)

            // Rate limit for OpenRouter provider
            if (i < coins.length - 1 && !cancelled && query.config?.provider === 'openrouter') {
              await sleep(MIN_INTERVAL_MS)
            }
          }

          if (!cancelled) {
            clearBulkSession(query.collectionId, query.queryType)
          }
          console.log('[llm:ipc] Agentic bulk complete:', allResults.length, 'results')
          return allResults
        }

        if (searchPath === 'builtin') {
          // ── OpenRouter built-in path: batched with fetch-hack ──
          const allResults: AiCoinInfo[] = []
          const batches: Coin[][] = []
          for (let i = 0; i < coins.length; i += BATCH_SIZE) {
            batches.push(coins.slice(i, i + BATCH_SIZE))
          }

          for (let i = 0; i < batches.length; i++) {
            if (cancelled) {
              console.log('[llm:ipc] Builtin bulk cancelled at batch', i + 1, 'of', batches.length)
              break
            }

            const batchStart = Date.now()
            const model = createLlmModel(query.config)
            const batchResults = await queryBulkCoins(model, batches[i], query.queryType, locale)
            allResults.push(...batchResults)

            event.sender.send(IPC_CHANNELS.LLM.BULK_PROGRESS, {
              processed: allResults.length,
              total: coins.length,
              currentBatch: i + 1,
              totalBatches: batches.length,
              results: batchResults
            } satisfies LlmBulkProgress)

            if (i < batches.length - 1 && !cancelled) {
              await sleep(Math.max(0, MIN_INTERVAL_MS - (Date.now() - batchStart)))
            }
          }
          return allResults
        }

        // ── No-search path: batched ──
        {
          const allResults: AiCoinInfo[] = []
          const batches: Coin[][] = []
          for (let i = 0; i < coins.length; i += BATCH_SIZE) {
            batches.push(coins.slice(i, i + BATCH_SIZE))
          }

          for (let i = 0; i < batches.length; i++) {
            if (cancelled) {
              console.log('[llm:ipc] No-search bulk cancelled at batch', i + 1, 'of', batches.length)
              break
            }

            const batchStart = Date.now()
            const model = createLlmModel(query.config)
            const batchResults = await queryBulkCoins(model, batches[i], query.queryType, locale)
            allResults.push(...batchResults)

            event.sender.send(IPC_CHANNELS.LLM.BULK_PROGRESS, {
              processed: allResults.length,
              total: coins.length,
              currentBatch: i + 1,
              totalBatches: batches.length,
              results: batchResults
            } satisfies LlmBulkProgress)

            if (i < batches.length - 1 && !cancelled) {
              await sleep(Math.max(0, MIN_INTERVAL_MS - (Date.now() - batchStart)))
            }
          }
          return allResults
        }
      } finally {
        activeQueries.delete(queryKey)
      }
    }
  )

  // ── Cancel bulk ──────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.LLM.CANCEL_BULK,
    async (_event, collectionId: string): Promise<void> => {
      for (const [key, query] of activeQueries) {
        if (key.startsWith(collectionId)) {
          query.cancel()
          activeQueries.delete(key)
        }
      }
    }
  )

  // ── SINGLE query ─────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.LLM.QUERY_SINGLE,
    async (_event, query: AiSingleQuery): Promise<AiCoinInfo> => {
      const coin = getCoin(query.coinId)
      if (!coin) {
        throw new Error(`Coin not found: ${query.coinId}`)
      }

      const searchPath = getSearchPath(query.config)

      if (searchPath === 'agentic') {
        const searchTool = createSearchToolFromConfig(query.config)!
        const model = createLlmModel(query.config)
        return querySingleCoinWithSearch(model, searchTool, coin, query.queryType, query.locale || 'en')
      }

      // builtin or none: use existing path (builtin handles search via fetch-hack)
      const model = createLlmModel(query.config)
      return querySingleCoin(model, coin, query.queryType, query.locale || 'en')
    }
  )

  // ── Config ───────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.LLM.GET_CONFIG, async (): Promise<LlmConfig> => {
    return loadLlmConfig()
  })

  ipcMain.handle(
    IPC_CHANNELS.LLM.SET_CONFIG,
    async (_event, config: LlmConfig): Promise<void> => {
      saveLlmConfig(config)
    }
  )

  // ── Bulk session (resume) ────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.LLM.GET_BULK_SESSION,
    async (_event, collectionId: string, queryType: string) => {
      return loadBulkSession(collectionId, queryType as 'prices' | 'mintage' | 'info')
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.LLM.CLEAR_BULK_SESSION,
    async (_event, collectionId: string, queryType: string): Promise<void> => {
      clearBulkSession(collectionId, queryType as 'prices' | 'mintage' | 'info')
    }
  )

  // ── Test connection (extended) ───────────────────────────────

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

        // Step 1: Basic model connectivity
        try {
          await model.invoke([new HumanMessage('Reply with just the word "OK"')])
        } catch (invokeErr) {
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

        // Step 2: If web search is enabled (agentic path), check tool-calling support
        const searchPath = getSearchPath(config)
        let toolCallSupported: boolean | undefined
        let searchProviderOk: boolean | undefined

        if (searchPath === 'agentic') {
          const searchTool = createSearchToolFromConfig(config)
          if (searchTool) {
            // 2a: Test search provider connectivity
            const searchTest = await testSearchProvider(config!.search!)
            searchProviderOk = searchTest.ok

            // 2b: Test that the model supports tool-calling
            try {
              if (!model.bindTools) {
                toolCallSupported = false
              } else {
                const boundModel = model.bindTools([searchTool]) as unknown as BaseChatModel
                const testMessages = [
                  new SystemMessage(
                    'You MUST call the web_search tool right now. Search for "test query" and report the results. Do NOT answer without calling the tool first.'
                  ),
                  new HumanMessage('Call web_search tool to search for "test query".')
                ] as unknown as Parameters<BaseChatModel['invoke']>[0]
                const testResponse = await boundModel.invoke(testMessages)

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const testToolCalls: any[] =
                  (testResponse as any).tool_calls ||
                  testResponse.additional_kwargs?.tool_calls ||
                  []

                toolCallSupported = testToolCalls.length > 0
              }
            } catch {
              toolCallSupported = false
            }
          }
        }

        return { ok: true, toolCallSupported, searchProviderOk }
      } catch (err) {
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
          if (err.cause) console.error('[llm] Error cause:', err.cause)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (typeof (err as any).status === 'number') {
            message = `HTTP ${(err as any).status}: ${message}`
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
