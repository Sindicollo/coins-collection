/**
 * IPC handlers for LLM features.
 *
 * Registration lives at the bottom: `registerLlmHandlers` is a thin mapping
 * of channels to handler functions, one per feature area. The handlers
 * themselves (AI query, export/import, config, session, connection test)
 * sit next to the small helpers they rely on.
 *
 * Conventions:
 *   - AI queries return structured `LlmQueryResult` payloads instead of
 *     thrown IPC rejections, so the renderer shows localized messages.
 *   - Bulk failures are isolated per coin/batch: non-fatal errors are
 *     skipped (resume retries them), fatal errors abort the whole run with
 *     a checkpoint.
 */

import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

import { listCoinsByCollection, getCoin } from '../database/repositories/coins'
import { createCoinNote } from '../database/repositories/coin-notes'
import { createLlmModel } from '../llm/providers'
import { queryBulkCoins, querySingleCoin, querySingleCoinWithSearch } from '../llm/chains'
import { classifyLlmError, isFatalLlmError } from '../llm/errors'
import { loadLlmConfig, saveLlmConfig, saveBulkSession, clearBulkSession, loadBulkSession } from '../llm/config'
import { createSearchTool, testSearchProvider } from '../llm/search'
import { saveAiNote } from '../llm/notes'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'

import type { DynamicTool } from '@langchain/core/tools'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type {
  AiCoinInfo,
  AiBulkQuery,
  AiSingleQuery,
  Coin,
  LlmConfig,
  LlmErrorInfo,
  LlmBulkProgress,
  LlmExportCoin,
  LlmTestResult,
  LlmQueryResult,
  QueryType
} from '@shared/types'

// ── Constants & tiny utilities ────────────────────────────────────

const BATCH_SIZE = 5
const MIN_INTERVAL_MS = 12000 // OpenRouter free-tier rate limit: 5 req/min
const VALID_QUERY_TYPES = ['prices', 'mintage', 'info'] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** In-flight bulk queries, shared between QUERY_BULK and CANCEL_BULK. */
const activeQueries = new Map<string, { cancel: () => void }>()

// ── Config helpers ────────────────────────────────────────────────

/** Merge stored preferences with renderer overrides (renderer wins). */
export function effectiveConfig(config?: Partial<LlmConfig>): LlmConfig {
  return config ? { ...loadLlmConfig(), ...config } : loadLlmConfig()
}

/**
 * Decide how web search is performed:
 *   'agentic' — manual tool-call loop (tavily/brave/serper/searxng/ddg)
 *   'builtin' — OpenRouter server-side search (fetch-hack in providers.ts)
 *   'none'    — web search disabled
 */
function getSearchPath(config?: Partial<LlmConfig>): 'agentic' | 'builtin' | 'none' {
  const cfg = effectiveConfig(config)
  if (!cfg.enableWebSearch) return 'none'
  if (!cfg.search || cfg.search.provider === 'none') return 'none'
  if (cfg.search.provider === 'openrouter_builtin') return 'builtin'
  return 'agentic'
}

function createSearchToolFromConfig(config?: Partial<LlmConfig>): DynamicTool | null {
  const cfg = effectiveConfig(config)
  if (!cfg.search || cfg.search.provider === 'none' || cfg.search.provider === 'openrouter_builtin') {
    return null
  }
  return createSearchTool(cfg.search)
}

function validateQueryType(qt: string): QueryType {
  if (!VALID_QUERY_TYPES.includes(qt as QueryType)) {
    throw new Error(`Invalid queryType: "${qt}" — expected one of: ${VALID_QUERY_TYPES.join(', ')}`)
  }
  return qt as QueryType
}

// ── Session helpers ───────────────────────────────────────────────

/** Checkpoint: persist bulk-progress so a stopped bulk can be resumed. */
function checkpointSession(
  collectionId: string,
  queryType: QueryType,
  processedIds: Set<string>,
  noteError?: string
): void {
  try {
    saveBulkSession({
      collectionId,
      queryType,
      processedCoinIds: [...processedIds],
      startedAt: Date.now()
    })
  } catch (err) {
    console.error('[llm:ipc] Failed to save bulk session checkpoint:', err)
  }
  if (noteError) {
    console.error('[llm:ipc] Note save error (session still saved):', noteError)
  }
}

/**
 * If NOTHING succeeded and every failure was a non-fatal one ( e.g. bad
 * parse on every coin/batch), surface that error instead of lying to the
 * renderer with a successful empty result ("0 results"). Returns null when
 * the run is a real (possibly partial) success or was cancelled.
 */
function surfaceAllFailedError(
  cancelled: boolean,
  results: AiCoinInfo[],
  coinCount: number,
  lastNonFatal: LlmErrorInfo | null,
  cfg: LlmConfig
): LlmQueryResult<AiCoinInfo[]> | null {
  if (cancelled || results.length > 0 || coinCount === 0) return null
  return {
    ok: false,
    error:
      lastNonFatal ??
      classifyLlmError(new Error('Model returned no usable data for any coin'), cfg)
  }
}

function emitBulkProgress(
  event: Electron.IpcMainInvokeEvent,
  processed: number,
  total: number,
  batchIndex: number,
  totalBatches: number,
  results: AiCoinInfo[]
): void {
  event.sender.send(IPC_CHANNELS.LLM.BULK_PROGRESS, {
    processed,
    total,
    currentBatch: batchIndex + 1,
    totalBatches,
    results
  } satisfies LlmBulkProgress)
}

/** Wait until the next batch is allowed under the OpenRouter rate limit. */
async function rateLimitBatchDelay(elapsedMs: number): Promise<void> {
  const wait = Math.max(0, MIN_INTERVAL_MS - elapsedMs)
  if (wait > 0) {
    console.log(`[llm:ipc] Rate limit: waiting ${(wait / 1000).toFixed(1)}s before next batch`)
    await sleep(wait)
  }
}

// ── Bulk query engines ────────────────────────────────────────────

interface BulkQueryEngineParams {
  event: Electron.IpcMainInvokeEvent
  coins: Coin[]
  queryType: QueryType
  locale: string
  cancelled: () => boolean
  collectionId: string
  processedIds: Set<string>
  cfg: LlmConfig
}

/**
 * Agentic bulk: one coin at a time with tool-calling.
 *
 * Per-coin errors: fatal (connection down, auth, 5xx) aborts the whole bulk
 * with a checkpoint; non-fatal (bad parse, empty answer) skips just that
 * coin so `resume` can retry it.
 */
async function runAgenticQuery(
  params: BulkQueryEngineParams & { model: BaseChatModel; searchTool: DynamicTool }
): Promise<{ results: AiCoinInfo[]; lastNonFatal: LlmErrorInfo | null }> {
  const { event, coins, queryType, locale, cancelled, collectionId, processedIds, cfg, model, searchTool } = params

  const allResults: AiCoinInfo[] = []
  let lastNonFatal: LlmErrorInfo | null = null

  for (let i = 0; i < coins.length; i++) {
    if (cancelled()) {
      console.log('[llm:ipc] Agentic bulk cancelled at coin', i + 1, 'of', coins.length)
      checkpointSession(collectionId, queryType, processedIds)
      break
    }

    const coin = coins[i]
    let result: AiCoinInfo
    try {
      result = await querySingleCoinWithSearch(model, searchTool, coin, queryType, locale)
    } catch (err) {
      const info = classifyLlmError(err, cfg)
      if (isFatalLlmError(info.code)) {
        console.error(`[llm:ipc] Fatal error on coin ${coin.id}, aborting bulk:`, err)
        checkpointSession(collectionId, queryType, processedIds)
        throw err
      }
      lastNonFatal = info
      console.error(`[llm:ipc] Coin ${coin.id} failed, skipping:`, err)
      checkpointSession(collectionId, queryType, processedIds)
      continue
    }

    allResults.push(result)
    processedIds.add(coin.id)

    // Auto-save to DB and session — independent operations.
    let noteError: string | undefined
    try {
      saveAiNote(coin.id, queryType, result.info || JSON.stringify(result))
    } catch (err) {
      noteError = err instanceof Error ? `note: ${err.message}` : String(err)
    }
    checkpointSession(collectionId, queryType, processedIds, noteError)

    emitBulkProgress(event, allResults.length, coins.length, i, coins.length, [result])

    // Rate limit for openrouter provider (applies to every coin)
    if (i < coins.length - 1 && !cancelled() && cfg.provider === 'openrouter') {
      await sleep(MIN_INTERVAL_MS)
    }
  }

  if (!cancelled()) {
    clearBulkSession(collectionId, queryType)
  }
  console.log('[llm:ipc] Agentic bulk complete:', allResults.length, 'results')

  return { results: allResults, lastNonFatal }
}

/**
 * Batched bulk: groups of coins in one call (builtin / no-search paths).
 * Same error-isolation policy as the agentic path.
 */
async function runBatchQuery(
  params: BulkQueryEngineParams & { modelCallback: () => BaseChatModel }
): Promise<{ results: AiCoinInfo[]; lastNonFatal: LlmErrorInfo | null }> {
  const { event, coins, queryType, locale, cancelled, collectionId, processedIds, cfg, modelCallback } = params

  const allResults: AiCoinInfo[] = []
  let lastNonFatal: LlmErrorInfo | null = null

  // Split coins into batches
  const batches: Coin[][] = []
  for (let i = 0; i < coins.length; i += BATCH_SIZE) batches.push(coins.slice(i, i + BATCH_SIZE))

  for (let i = 0; i < batches.length; i++) {
    if (cancelled()) {
      console.log('[llm:ipc] Batched query cancelled at batch', i + 1, 'of', batches.length)
      checkpointSession(collectionId, queryType, processedIds)
      break
    }

    const batchStart = Date.now()
    const model = modelCallback()
    let batchResults: AiCoinInfo[]

    try {
      batchResults = await queryBulkCoins(model, batches[i], queryType, locale)
    } catch (err) {
      const info = classifyLlmError(err, cfg)
      if (isFatalLlmError(info.code)) {
        console.error(`[llm:ipc] Fatal error on batch ${i + 1}, aborting bulk:`, err)
        checkpointSession(collectionId, queryType, processedIds)
        throw err
      }
      lastNonFatal = info
      console.error(`[llm:ipc] Batch ${i + 1} failed, skipping:`, err)
      checkpointSession(collectionId, queryType, processedIds)
      continue
    }

    allResults.push(...batchResults)
    for (const coin of batches[i]) processedIds.add(coin.id)

    // Save checkpoint after each batch
    checkpointSession(collectionId, queryType, processedIds)

    emitBulkProgress(event, allResults.length, coins.length, i, batches.length, batchResults)

    if (i < batches.length - 1 && !cancelled()) {
      await rateLimitBatchDelay(Date.now() - batchStart)
    }
  }

  return { results: allResults, lastNonFatal }
}

// ── Export / import helpers ───────────────────────────────────────

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

// ── Handler: AI bulk query ────────────────────────────────────────

/** Coins to process after excluding already-processed ones from `resume`. */
function loadCoinsForBulk(query: AiBulkQuery): Coin[] {
  let coins = listCoinsByCollection(query.collectionId)
  if (query.excludeCoinIds?.length) {
    const exclude = new Set(query.excludeCoinIds)
    coins = coins.filter((c) => !exclude.has(c.id))
  }
  return coins
}

async function handleQueryBulk(
  event: Electron.IpcMainInvokeEvent,
  query: AiBulkQuery
): Promise<LlmQueryResult<AiCoinInfo[]>> {
  const queryKey = `${query.collectionId}:${query.queryType}`
  console.log('[llm:ipc] QUERY_BULK:', {
    collectionId: query.collectionId,
    queryType: query.queryType,
    excludeCoinIds: query.excludeCoinIds?.length || 0
  })

  let cancelled = false
  activeQueries.set(queryKey, { cancel: () => { cancelled = true } })

  try {
    const queryType = validateQueryType(query.queryType)
    const cfg = effectiveConfig(query.config)

    const coins = loadCoinsForBulk(query)
    console.log('[llm:ipc] coins loaded:', coins.length)

    if (coins.length === 0) {
      clearBulkSession(query.collectionId, queryType)
      return { ok: true, data: [] }
    }

    const locale = query.locale || 'en'
    const processedIds = new Set(query.excludeCoinIds || [])
    const searchPath = getSearchPath(query.config)

    const engineParams: BulkQueryEngineParams = {
      event,
      coins,
      queryType,
      locale,
      cancelled: () => cancelled,
      collectionId: query.collectionId,
      processedIds,
      cfg
    }

    // ── Agentic path ──
    if (searchPath === 'agentic') {
      const searchTool = createSearchToolFromConfig(query.config)
      if (!searchTool) {
        throw new Error('Web search is enabled but no search tool could be created')
      }
      const model = createLlmModel(query.config)
      const { results, lastNonFatal } = await runAgenticQuery({ ...engineParams, model, searchTool })
      const failure = surfaceAllFailedError(cancelled, results, coins.length, lastNonFatal, cfg)
      return failure ?? { ok: true, data: results }
    }

    // ── Builtin / no-search paths: batched ──
    const { results, lastNonFatal } = await runBatchQuery({
      ...engineParams,
      modelCallback: () => createLlmModel(query.config)
    })
    const failure = surfaceAllFailedError(cancelled, results, coins.length, lastNonFatal, cfg)
    return failure ?? { ok: true, data: results }
  } catch (err) {
    return { ok: false, error: classifyLlmError(err, effectiveConfig(query.config)) }
  } finally {
    activeQueries.delete(queryKey)
  }
}

// ── Handler: AI single query ──────────────────────────────────────

async function handleQuerySingle(
  _event: Electron.IpcMainInvokeEvent,
  query: AiSingleQuery
): Promise<LlmQueryResult<AiCoinInfo>> {
  try {
    const queryType = validateQueryType(query.queryType)
    const cfg = effectiveConfig(query.config)
    const coin = getCoin(query.coinId)
    if (!coin) {
      return {
        ok: false,
        error: {
          code: 'unknown',
          provider: cfg.provider,
          baseUrl: cfg.baseUrl,
          model: cfg.model,
          detail: `Coin not found: ${query.coinId}`
        }
      }
    }

    const locale = query.locale || 'en'
    const searchPath = getSearchPath(query.config)

    if (searchPath === 'agentic') {
      const searchTool = createSearchToolFromConfig(query.config)
      if (!searchTool) {
        throw new Error('Web search is enabled but no search tool could be created')
      }
      const model = createLlmModel(query.config)
      const data = await querySingleCoinWithSearch(model, searchTool, coin, queryType, locale)
      return { ok: true, data }
    }

    // builtin / none: plain path (builtin handles search via fetch-hack)
    const model = createLlmModel(query.config)
    const data = await querySingleCoin(model, coin, queryType, locale)
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: classifyLlmError(err, effectiveConfig(query.config)) }
  }
}

// ── Handlers: export / import ─────────────────────────────────────

function makeDefaultFilename(): string {
  const now = new Date()
  const ymd = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((n) => String(n).padStart(2, '0'))
    .join('-')
  return `collection-export-${ymd}.json`
}

function handleExportAll(collectionId: string): Promise<string | null> {
  const exportData = buildExportData(collectionId)

  return dialog
    .showSaveDialog({
      defaultPath: join(homedir(), 'Downloads', makeDefaultFilename()),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    .then((result) => {
      if (result.canceled || !result.filePath) return null
      writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8')
      return result.filePath
    })
}

function isValidImportItem(item: unknown): item is { id: string; info: string } {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as { id: string }).id === 'string' &&
    typeof (item as { info: string }).info === 'string'
  )
}

async function handleImportInfo(): Promise<{ updated: number; skipped: number; filePath: string } | null> {
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

  let updated = 0
  let skipped = 0
  for (const item of parsed.filter(isValidImportItem)) {
    const coin = getCoin(item.id)
    if (!coin) {
      skipped++
      continue
    }
    createCoinNote({ coinId: item.id, title: 'AI Import', content: item.info })
    updated++
  }
  return { updated, skipped, filePath }
}

// ── Handlers: config & bulk session ───────────────────────────────

function handleGetConfig(): Promise<LlmConfig> {
  return Promise.resolve(loadLlmConfig())
}

async function handleSetConfig(config: LlmConfig): Promise<void> {
  saveLlmConfig(config)
}

function handleGetBulkSession(collectionId: string, queryType: string) {
  return Promise.resolve(loadBulkSession(collectionId, validateQueryType(queryType)))
}

async function handleClearBulkSession(collectionId: string, queryType: string): Promise<void> {
  clearBulkSession(collectionId, validateQueryType(queryType))
}

// ── Handler: connection test ──────────────────────────────────────

function logConnectionStart(cfg: LlmConfig): void {
  const hasKey = !!cfg.apiKey && cfg.apiKey.length > 3
  console.log('[llm] Testing connection:', {
    provider: cfg.provider,
    model: cfg.model,
    baseUrl: cfg.baseUrl,
    apiKey: hasKey ? `***${cfg.apiKey.slice(-4)}` : '(missing)'
  })
}

/** Step 1: basic model connectivity. Returns a special-case message when the
 *  invoke hits the known "empty choices" LangChain bug, null on success, or
 *  rethrows the real error for the caller to classify. */
async function runBasicConnectivityCheck(model: BaseChatModel): Promise<string | null> {
  try {
    await model.invoke([new HumanMessage('Reply with just the word "OK"')])
    return null
  } catch (invokeErr) {
    if (invokeErr instanceof TypeError && String(invokeErr.message).includes("reading 'message'")) {
      return 'Model returned empty response. This model may be overloaded or unavailable. Try a different model.'
    }
    throw invokeErr
  }
}

interface ToolDiagnostics {
  toolCallSupported?: boolean
  searchProviderOk?: boolean
  searchProviderError?: string
}

/** Step 2 (agentic only): check search provider connectivity and whether the
 *  model actually supports tool-calling. */
async function runToolCallingDiagnostics(model: BaseChatModel, cfg: LlmConfig): Promise<ToolDiagnostics> {
  const diagnostics: ToolDiagnostics = {}
  const searchTool = createSearchToolFromConfig(cfg)
  if (!searchTool) return diagnostics

  const searchTest = await testSearchProvider(cfg.search!)
  diagnostics.searchProviderOk = searchTest.ok
  diagnostics.searchProviderError = searchTest.error

  if (!model.bindTools) {
    diagnostics.toolCallSupported = false
    return diagnostics
  }

  try {
    const boundModel = model.bindTools([searchTool]) as unknown as BaseChatModel
    const testMessages = [
      new SystemMessage(
        'You are a helpful assistant. Use the web_search function when you need real-time information from the internet.'
      ),
      new HumanMessage('Search the web for "test query" and tell me what you find.')
    ] as unknown as Parameters<BaseChatModel['invoke']>[0]

    const testResponse = await boundModel.invoke(testMessages)

    // LC normalizes tool calls; also inspect raw additional_kwargs for compat
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolCalls: any[] =
      (testResponse as any).tool_calls || testResponse.additional_kwargs?.tool_calls || []
    // LM Studio sometimes returns finish_reason 'tool_calls' even when LC
    // didn't parse tool_calls into the AIMessage
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finishReason = (testResponse as any).response_metadata?.finish_reason
    const hasFinishToolCalls = finishReason === 'tool_calls'

    diagnostics.toolCallSupported = toolCalls.length > 0 || hasFinishToolCalls

    if (!diagnostics.toolCallSupported) {
      // Log what the model actually returned — invaluable when debugging
      const content =
        typeof testResponse.content === 'string'
          ? testResponse.content.slice(0, 300)
          : JSON.stringify(testResponse.content).slice(0, 300)
      console.log(
        '[llm:test] Tool-calling check: model did not emit tool_calls.',
        'Response content:', content,
        'finish_reason:', finishReason || 'unknown'
      )
    }
  } catch {
    diagnostics.toolCallSupported = false
  }

  return diagnostics
}

/** Render a human-friendly message out of any thrown error. */
function describeError(err: unknown): string {
  if (typeof err === 'string') return err
  if (err instanceof Error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (err as any).status
    if (typeof status === 'number') return `HTTP ${status}: ${err.message}`
    return err.message
  }
  return 'Unknown error'
}

async function handleTestConnectionInner(config?: LlmConfig): Promise<LlmTestResult> {
  const cfg = effectiveConfig(config)
  logConnectionStart(cfg)

  const hasKey = !!cfg.apiKey && cfg.apiKey.length > 3
  if (!hasKey) {
    return { ok: false, error: 'API key is not set. Open AI Settings and enter your API key.' }
  }

  const model = createLlmModel(config)

  const basicError = await runBasicConnectivityCheck(model)
  if (basicError) return { ok: false, error: basicError }

  const searchPath = getSearchPath(config)
  const diagnostics = searchPath === 'agentic' ? await runToolCallingDiagnostics(model, cfg) : {}

  return { ok: true, ...diagnostics }
}

async function handleTestConnection(config?: LlmConfig): Promise<LlmTestResult> {
  try {
    return await handleTestConnectionInner(config)
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

    const message = describeError(err)
    console.error('[llm] Connection test failed:', message)
    return { ok: false, error: message, errorInfo: classifyLlmError(err, effectiveConfig(config)) }
  }
}

// ── Registration ──────────────────────────────────────────────────

/**
 * Map every LLM channel to its handler. This is deliberately a plain table —
 * keep it flat so one channel → one focused handler function.
 */
export function registerLlmHandlers(): void {
  // Export / import
  ipcMain.handle(IPC_CHANNELS.LLM.GET_EXPORT_DATA, (_event, collectionId: string) =>
    Promise.resolve(buildExportData(collectionId))
  )
  ipcMain.handle(IPC_CHANNELS.LLM.EXPORT_ALL, (_event, collectionId: string) =>
    handleExportAll(collectionId)
  )
  ipcMain.handle(IPC_CHANNELS.LLM.IMPORT_INFO, () => handleImportInfo())

  // AI queries
  ipcMain.handle(IPC_CHANNELS.LLM.QUERY_BULK, handleQueryBulk)
  ipcMain.handle(IPC_CHANNELS.LLM.QUERY_SINGLE, handleQuerySingle)
  ipcMain.handle(IPC_CHANNELS.LLM.CANCEL_BULK, (_event, collectionId: string) => {
    for (const [key, query] of activeQueries) {
      if (key.startsWith(collectionId)) {
        query.cancel()
        activeQueries.delete(key)
      }
    }
    return Promise.resolve()
  })

  // Config
  ipcMain.handle(IPC_CHANNELS.LLM.GET_CONFIG, handleGetConfig)
  ipcMain.handle(IPC_CHANNELS.LLM.SET_CONFIG, (_event, config: LlmConfig) => handleSetConfig(config))

  // Bulk session (resume)
  ipcMain.handle(IPC_CHANNELS.LLM.GET_BULK_SESSION, (_event, collectionId: string, queryType: string) =>
    handleGetBulkSession(collectionId, queryType)
  )
  ipcMain.handle(IPC_CHANNELS.LLM.CLEAR_BULK_SESSION, (_event, collectionId: string, queryType: string) =>
    handleClearBulkSession(collectionId, queryType)
  )

  // Connection test
  ipcMain.handle(IPC_CHANNELS.LLM.TEST_CONNECTION, (_event, config?: LlmConfig) =>
    handleTestConnection(config)
  )
}