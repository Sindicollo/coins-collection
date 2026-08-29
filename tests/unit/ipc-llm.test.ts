/**
 * Unit tests for src/main/ipc/llm.ts — the LLM IPC handlers.
 *
 * Focused on the changes in the fix-ui branch:
 *   - QUERY_BULK returns `LlmQueryResult` instead of throwing,
 *     fatal errors abort the bulk, per-coin/batch non-fatal failures are
 *     skipped (and surfaced when EVERYTHING fails),
 *     an empty collection is a successful empty result.
 *   - runBatchQuery isolates errors per batch (no cross-batch abort on a
 *     single bad JSON response), checkpoints before aborting/skipping.
 *   - QUERY_SINGLE returns structured errors (including "coin not found").
 *   - TEST_CONNECTION attaches `errorInfo` on failure.
 *
 * `genuine errors.ts` classified HERE — only infra (electron, chains,
 * config, providers, search, notes, repos) is mocked.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { registerLlmHandlers } from '../../src/main/ipc/llm'
import { listCoinsByCollection, getCoin } from '../../src/main/database/repositories/coins'
import { queryBulkCoins, querySingleCoin, querySingleCoinWithSearch } from '../../src/main/llm/chains'
import {
  loadLlmConfig,
  saveBulkSession,
  clearBulkSession
} from '../../src/main/llm/config'
import { createLlmModel } from '../../src/main/llm/providers'
import { createSearchTool } from '../../src/main/llm/search'
import type { AiBulkQuery, AiSingleQuery, AiCoinInfo, Coin, LlmConfig, LlmQueryResult, LlmTestResult } from '@shared/types'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: {}
}))
vi.mock('../../src/main/database/repositories/coins', () => ({
  listCoinsByCollection: vi.fn(),
  getCoin: vi.fn()
}))
vi.mock('../../src/main/database/repositories/coin-notes', () => ({
  createCoinNote: vi.fn()
}))
vi.mock('../../src/main/llm/providers', () => ({ createLlmModel: vi.fn() }))
vi.mock('../../src/main/llm/chains', () => ({
  queryBulkCoins: vi.fn(),
  querySingleCoin: vi.fn(),
  querySingleCoinWithSearch: vi.fn()
}))
vi.mock('../../src/main/llm/config', () => ({
  loadLlmConfig: vi.fn(),
  saveLlmConfig: vi.fn(),
  saveBulkSession: vi.fn(),
  clearBulkSession: vi.fn(),
  loadBulkSession: vi.fn()
}))
vi.mock('../../src/main/llm/search', () => ({
  createSearchTool: vi.fn(),
  testSearchProvider: vi.fn()
}))
vi.mock('../../src/main/llm/notes', () => ({ saveAiNote: vi.fn() }))
vi.mock('@langchain/core/messages', () => ({
  HumanMessage: class HumanMessage {},
  SystemMessage: class SystemMessage {}
}))

// ── Fixtures ──────────────────────────────────────────────────────

function makeConfig(overrides: Partial<LlmConfig> = {}): LlmConfig {
  return {
    // lmstudio (not openrouter) → the agentic rate-limit sleep is skipped,
    // and batched-path tests below advance timers explicitly where needed.
    provider: 'lmstudio',
    model: 'qwen2.5',
    baseUrl: 'http://localhost:1234/v1',
    apiKey: 'lm-studio',
    enableWebSearch: false, // searchPath == 'none' unless overridden
    search: { provider: 'none', apiKeys: {}, baseUrl: '', maxResults: 5 },
    ...overrides
  }
}

function makeCoin(id: string): Coin {
  return {
    id,
    collectionId: 'col-1',
    denomination: '1 рубль',
    year: 1999,
    condition: 'UNC',
    country: 'Russia',
    createdAt: 1,
    updatedAt: 1,
    purchaseDate: null,
    purchasePlace: null,
    price: null,
    shippingCost: null,
    currency: null,
    composition: null,
    extraData: null,
    sold: false,
    onAuction: false,
    auctionPrice: null,
    salePrice: null
  }
}

const connectionError = new Error('fetch failed')
;(connectionError as Error & { cause: unknown }).cause = { code: 'ECONNREFUSED' }

const schemaError = new Error('LLM response does not match expected schema: not an array')

// ── Handler capture ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (...args: any[]) => unknown
const handlers = new Map<string, Handler>()

const fakeEvent = { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent

beforeEach(() => {
  // resetAllMocks (not clearAllMocks): also wipes `mockResolvedValueOnce` /
  // `mockRejectedValueOnce` leftovers, which otherwise leak between tests.
  vi.resetAllMocks()
  handlers.clear()
  vi.useFakeTimers()

  vi.mocked(ipcMain.handle).mockImplementation(((channel: string, fn: Handler) => {
    handlers.set(channel, fn)
  }) as unknown as typeof ipcMain.handle)

  vi.mocked(loadLlmConfig).mockReturnValue(makeConfig())
  vi.mocked(createSearchTool).mockReturnValue(
    // A truthy tool so the agentic path gets past the "no search tool" guard
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {} as any
  )

  registerLlmHandlers()
})

afterEach(() => {
  vi.useRealTimers()
})

function bulkHandler(): Handler {
  const h = handlers.get(IPC_CHANNELS.LLM.QUERY_BULK)
  if (!h) throw new Error('QUERY_BULK handler not registered')
  return h
}

function singleHandler(): Handler {
  const h = handlers.get(IPC_CHANNELS.LLM.QUERY_SINGLE)
  if (!h) throw new Error('QUERY_SINGLE handler not registered')
  return h
}

function bulkQuery(config: LlmConfig = makeConfig()): AiBulkQuery {
  return { collectionId: 'col-1', queryType: 'prices', locale: 'en', config }
}

/** Typed invocations — the captured handlers are `(...args: unknown[])`, so
 *  results must be re-cast to the handler's declared return type. */
function callBulk(query: AiBulkQuery): Promise<LlmQueryResult<AiCoinInfo[]>> {
  return bulkHandler()(fakeEvent, query) as Promise<LlmQueryResult<AiCoinInfo[]>>
}

function callSingle(query: AiSingleQuery): Promise<LlmQueryResult<AiCoinInfo>> {
  return singleHandler()(fakeEvent, query) as Promise<LlmQueryResult<AiCoinInfo>>
}

function callTestConnection(config: LlmConfig): Promise<LlmTestResult> {
  const h = handlers.get(IPC_CHANNELS.LLM.TEST_CONNECTION)
  if (!h) throw new Error('TEST_CONNECTION handler not registered')
  return h(fakeEvent, config) as Promise<LlmTestResult>
}

/** Assertion helpers that also narrow the `LlmQueryResult` discriminated
 *  union, so `.data` / `.error` type-check after the check. */
type OkResult<T> = Extract<LlmQueryResult<T>, { ok: true }>
type ErrResult<T> = Extract<LlmQueryResult<T>, { ok: false }>

function assertOk<T>(result: LlmQueryResult<T>): asserts result is OkResult<T> {
  expect(result.ok).toBe(true)
}

function assertError<T>(result: LlmQueryResult<T>): asserts result is ErrResult<T> {
  expect(result.ok).toBe(false)
}

// ── QUERY_BULK — agentic path ─────────────────────────────────────

describe('QUERY_BULK (agentic path)', () => {
  const agenticCfg = makeConfig({ enableWebSearch: true, search: { provider: 'tavily', apiKeys: {}, baseUrl: '', maxResults: 5 } })

  it('returns structured success with results and clears the resume session', async () => {
    vi.mocked(listCoinsByCollection).mockReturnValue([makeCoin('coin-1'), makeCoin('coin-2')])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(querySingleCoinWithSearch).mockImplementation(async (_m, _t, coin): Promise<any> => ({
      id: coin.id,
      info: `about ${coin.id}`
    }))

    const result = await callBulk(bulkQuery(agenticCfg))

    assertOk(result)
    expect(result.data).toHaveLength(2)
    expect(result.data[0]).toEqual(expect.objectContaining({ id: 'coin-1' }))
    expect(result.data[1]).toEqual(expect.objectContaining({ id: 'coin-2' }))
    // successful run clears the saved session
    expect(clearBulkSession).toHaveBeenCalled()
  })

  it('aborts the whole bulk on a fatal network error and returns a classified error', async () => {
    vi.mocked(listCoinsByCollection).mockReturnValue([makeCoin('coin-1'), makeCoin('coin-2')])
    vi.mocked(querySingleCoinWithSearch).mockRejectedValue(connectionError)

    const result = await callBulk(bulkQuery(agenticCfg))

    assertError(result)
    expect(result.error.code).toBe('connection_refused')
    // checkpoint the successful prefix before aborting so resume can continue
    expect(saveBulkSession).toHaveBeenCalled()
  })

  it('skips non-fatal per-coin failures and returns the successes', async () => {
    vi.mocked(listCoinsByCollection).mockReturnValue([makeCoin('coin-1'), makeCoin('coin-2')])
    vi.mocked(querySingleCoinWithSearch)
      .mockRejectedValueOnce(schemaError)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ id: 'coin-2', info: 'coin 2 ok' } as any)

    const result = await callBulk(bulkQuery(agenticCfg))

    assertOk(result)
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toEqual(expect.objectContaining({ id: 'coin-2' }))
    expect(clearBulkSession).toHaveBeenCalled()
  })

  it('surfaces a non-fatal error when EVERY coin failed (instead of "0 results")', async () => {
    vi.mocked(listCoinsByCollection).mockReturnValue([makeCoin('coin-1'), makeCoin('coin-2')])
    vi.mocked(querySingleCoinWithSearch).mockRejectedValue(schemaError)

    const result = await callBulk(bulkQuery(agenticCfg))

    assertError(result)
    expect(result.error.code).toBe('invalid_response')
    // The error branch carries no `data` field at all
    expect('data' in result).toBe(false)
  })

  it('returns an empty success for a collection without coins', async () => {
    vi.mocked(listCoinsByCollection).mockReturnValue([])

    const result = await callBulk(bulkQuery(agenticCfg))

    expect(result).toEqual({ ok: true, data: [] })
    expect(clearBulkSession).toHaveBeenCalled()
  })
})

// ── QUERY_BULK — batched paths (runBatchQuery isolation) ──────────

describe('QUERY_BULK (batched paths)', () => {
  // searchPath == 'none' (no web search) → runBatchQuery
  it('returns structured success for a clean run', async () => {
    vi.mocked(listCoinsByCollection).mockReturnValue([makeCoin('c1'), makeCoin('c2')])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(queryBulkCoins).mockResolvedValue([{ id: 'c1', info: 'ok' }] as any)

    const result = await callBulk(bulkQuery(makeConfig()))

    assertOk(result)
    expect(result.data).toHaveLength(1)
  })

  it('aborts on a fatal batch error, checkpointing the already-processed prefix', async () => {
    vi.mocked(listCoinsByCollection).mockReturnValue(
      [1, 2, 3, 4, 5, 6].map((n) => makeCoin(`c${n}`)) // BATCH_SIZE=5 → 2 batches max
    )
    vi.mocked(queryBulkCoins)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([{ id: 'c1', info: 'ok' }] as any)
      .mockRejectedValueOnce(connectionError)

    // The batching loop sleeps between batches — advance the fake timers past it
    const pending = callBulk(bulkQuery(makeConfig()))
    await vi.advanceTimersByTimeAsync(20000)
    const result = await pending

    assertError(result)
    expect(result.error.code).toBe('connection_refused')
    // The checkpoint includes batch 1 successes so resume retries only batch 2
    expect(saveBulkSession).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionId: 'col-1',
        queryType: 'prices',
        processedCoinIds: expect.arrayContaining(['c1'])
      })
    )
  })

  it('skips a non-fatal failed batch and keeps the successful results', async () => {
    vi.mocked(listCoinsByCollection).mockReturnValue(
      [1, 2, 3, 4, 5, 6].map((n) => makeCoin(`c${n}`))
    )
    vi.mocked(queryBulkCoins)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce([{ id: 'c1', info: 'ok' }, { id: 'c2', info: 'ok' }] as any)
      .mockRejectedValueOnce(schemaError)

    const pending = callBulk(bulkQuery(makeConfig()))
    await vi.advanceTimersByTimeAsync(20000)
    const result = await pending

    assertOk(result)
    expect(result.data).toHaveLength(2)
  })

  it('surfaces a non-fatal error when all batches failed', async () => {
    vi.mocked(listCoinsByCollection).mockReturnValue([makeCoin('c1'), makeCoin('c2')])
    vi.mocked(queryBulkCoins).mockRejectedValue(schemaError)

    const result = await callBulk(bulkQuery(makeConfig()))

    assertError(result)
    expect(result.error.code).toBe('invalid_response')
  })
})

// ── QUERY_SINGLE ──────────────────────────────────────────────────

describe('QUERY_SINGLE', () => {
  it('returns structured success on the happy path', async () => {
    vi.mocked(getCoin).mockReturnValue(makeCoin('coin-1'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(querySingleCoin).mockResolvedValue({ info: 'single info' } as any)

    const query: AiSingleQuery = { coinId: 'coin-1', queryType: 'info', locale: 'en' }
    const result = await callSingle(query)

    assertOk(result)
    expect(result.data).toEqual(expect.objectContaining({ info: 'single info' }))
  })

  it('returns a structured error (not a thrown IPC rejection) when the coin does not exist', async () => {
    vi.mocked(getCoin).mockReturnValue(undefined as unknown as Coin)

    const query: AiSingleQuery = { coinId: 'missing', queryType: 'info', locale: 'en' }
    const result = await callSingle(query)

    assertError(result)
    expect(result.error.code).toBe('unknown')
    expect(result.error.detail).toContain('missing')
  })

  it('classifies a connection failure into a structured error', async () => {
    vi.mocked(getCoin).mockReturnValue(makeCoin('coin-1'))
    vi.mocked(querySingleCoin).mockRejectedValue(connectionError)

    const query: AiSingleQuery = { coinId: 'coin-1', queryType: 'info', locale: 'en' }
    const result = await callSingle(query)

    assertError(result)
    expect(result.error.code).toBe('connection_refused')
  })
})

// ── TEST_CONNECTION ───────────────────────────────────────────────

describe('TEST_CONNECTION', () => {
  it('attaches classified errorInfo when the model cannot be created', async () => {
    vi.mocked(createLlmModel).mockImplementation(() => {
      throw connectionError
    })

    const result = await callTestConnection(makeConfig({ apiKey: 'sk-test' }))

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/fetch failed/i)
    expect(result.errorInfo).toEqual(expect.objectContaining({ code: 'connection_refused' }))
  })
})