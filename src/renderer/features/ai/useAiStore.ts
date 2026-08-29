import { create } from 'zustand'
import type { AiCoinInfo, QueryType, BulkSessionState, LlmErrorInfo } from '@shared/types'
import { AI_NOTE_TITLE_PREFIX } from '@shared/types'
import * as aiApi from './api'

interface AiState {
  results: Record<string, AiCoinInfo>
  loading: boolean
  /** Plain-text error (manual JSON input parse failures). */
  error: string | null
  /** Structured bulk-query error for friendly localized messages. */
  llmError: LlmErrorInfo | null
  /** Structured per-coin errors for single queries, keyed by coinId. */
  coinErrors: Record<string, LlmErrorInfo>
  lastQueryType: string | null
  manualInput: string
  bulkProgress: number
  bulkTotal: number
  bulkRunning: boolean
  coinLoading: Record<string, boolean>
  /** Active saved session to resume (if any) */
  resumeSession: BulkSessionState | null
  /** Timestamp when bulk started (for ETA calculation) */
  bulkStartTime: number
  /** Estimated time per coin in ms (from last run) */
  lastCoinTime: number
}

interface AiActions {
  queryBulk: (collectionId: string, queryType: QueryType) => Promise<void>
  /** Resume a bulk query from a saved session */
  resumeBulk: (collectionId: string, queryType: QueryType, excludeCoinIds: string[]) => Promise<void>
  querySingle: (coinId: string, queryType: QueryType) => Promise<AiCoinInfo | null>
  clearResults: () => void
  clearCoinResult: (coinId: string) => void
  appendCoinToNotes: (coinId: string) => Promise<boolean>
  setManualInput: (input: string) => void
  parseManualInput: () => void
  cancelBulk: (collectionId: string) => void
  /** Check for an active saved session for this collection+queryType */
  checkSession: (collectionId: string, queryType: QueryType) => Promise<void>
  /** Discard the active saved session */
  discardSession: (collectionId: string, queryType: QueryType) => Promise<void>
}

type AiStore = AiState & AiActions

function aiInfoToText(info: AiCoinInfo): string {
  const parts: string[] = []
  if (info.info) parts.push(info.info)
  if (info.price) parts.push(`Price: ${info.price}`)
  if (info.mintage) parts.push(`Mintage: ${info.mintage}`)
  if (info.rarity) parts.push(`Rarity: ${info.rarity}`)
  if (info.varieties && info.varieties.length > 0) {
    parts.push(`Varieties: ${info.varieties.join(', ')}`)
  }
  return parts.join('\n')
}

export const useAiStore = create<AiStore>((set, get) => {
  // Shared progress listener for bulk queries
  function subscribeBulkProgress(): () => void {
    return window.api.llm.onBulkProgress((data) => {
      set((state) => {
        const newResults = { ...state.results }
        const queryType = (state.lastQueryType as QueryType | null) ?? undefined
        for (const item of data.results) {
          newResults[item.id] = { ...item, queryType }
        }
        const elapsed = Date.now() - state.bulkStartTime
        const perCoin = data.processed > 0 ? elapsed / data.processed : 0
        return {
          results: newResults,
          bulkProgress: data.processed,
          bulkTotal: data.total,
          lastCoinTime: perCoin
        }
      })
    })
  }

  return {
    results: {},
  loading: false,
  error: null,
  llmError: null,
  coinErrors: {},
  lastQueryType: null,
  manualInput: '',
  bulkProgress: 0,
  bulkTotal: 0,
  bulkRunning: false,
  coinLoading: {},
  resumeSession: null,
  bulkStartTime: 0,
  lastCoinTime: 0,

  queryBulk: async (collectionId: string, queryType: QueryType) => {
    console.log('[useAiStore] queryBulk start:', { collectionId, queryType })

    // Clear previous results and set up progress
    set({
      loading: true,
      error: null,
      llmError: null,
      lastQueryType: queryType,
      bulkProgress: 0,
      bulkTotal: 0,
      bulkRunning: true,
      resumeSession: null,
      bulkStartTime: Date.now()
    })

    // Listen for progress events
    const unsubscribe = subscribeBulkProgress()

    try {
      const result = await aiApi.queryBulk(collectionId, queryType)
      if (!result.ok) {
        set({ loading: false, bulkRunning: false, llmError: result.error })
        return
      }
      console.log('[useAiStore] queryBulk complete:', result.data.length, 'coins')
      set((state) => {
        const newResults = { ...state.results }
        for (const item of result.data) {
          newResults[item.id] = { ...item, queryType }
        }
        return { results: newResults, loading: false, bulkRunning: false, lastCoinTime: 0 }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[useAiStore] queryBulk error:', message, err)
      set({
        error: message || 'Failed to query LLM',
        loading: false,
        bulkRunning: false
      })
    } finally {
      unsubscribe()
    }
  },

  resumeBulk: async (collectionId: string, queryType: QueryType, excludeCoinIds: string[]) => {
    console.log('[useAiStore] resumeBulk:', { collectionId, queryType, excludeCount: excludeCoinIds.length })

    set({
      loading: true,
      error: null,
      llmError: null,
      lastQueryType: queryType,
      bulkProgress: 0,
      bulkTotal: 0,
      bulkRunning: true,
      resumeSession: null,
      bulkStartTime: Date.now()
    })

    const unsubscribe = subscribeBulkProgress()

    try {
      const result = await aiApi.queryBulk(collectionId, queryType, excludeCoinIds)
      if (!result.ok) {
        set({ loading: false, bulkRunning: false, llmError: result.error })
        return
      }
      console.log('[useAiStore] resumeBulk complete:', result.data.length, 'coins')
      set((state) => {
        const newResults = { ...state.results }
        for (const item of result.data) {
          newResults[item.id] = { ...item, queryType }
        }
        return { results: newResults, loading: false, bulkRunning: false, lastCoinTime: 0 }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[useAiStore] resumeBulk error:', message, err)
      set({ error: message || 'Failed to resume', loading: false, bulkRunning: false })
    } finally {
      unsubscribe()
    }
  },

  querySingle: async (coinId: string, queryType: QueryType) => {
    set((state) => {
      const coinErrors = { ...state.coinErrors }
      delete coinErrors[coinId]
      return {
        error: null,
        coinLoading: { ...state.coinLoading, [coinId]: true },
        coinErrors
      }
    })
    try {
      const result = await aiApi.querySingle(coinId, queryType)
      if (!result.ok) {
        set((state) => ({
          coinLoading: { ...state.coinLoading, [coinId]: false },
          coinErrors: { ...state.coinErrors, [coinId]: result.error }
        }))
        return null
      }
      set((state) => {
        const coinErrors = { ...state.coinErrors }
        delete coinErrors[coinId]
        return {
          results: { ...state.results, [coinId]: { ...result.data, queryType } },
          coinLoading: { ...state.coinLoading, [coinId]: false },
          coinErrors
        }
      })
      return result.data
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set((state) => ({
        error: message || 'Failed to query LLM',
        coinLoading: { ...state.coinLoading, [coinId]: false }
      }))
      return null
    }
  },

  clearResults: () => set({ results: {}, error: null, llmError: null, coinErrors: {}, lastQueryType: null, bulkProgress: 0, bulkTotal: 0, bulkRunning: false, coinLoading: {} }),

  cancelBulk: (collectionId: string) => {
    window.api.llm.cancelBulk(collectionId)
    set({ bulkRunning: false, loading: false })
  },

  checkSession: async (collectionId: string, queryType: QueryType) => {
    try {
      const session = await aiApi.getBulkSession(collectionId, queryType)
      set({ resumeSession: session })
    } catch {
      // Silently ignore — no resume available
    }
  },

  discardSession: async (collectionId: string, queryType: QueryType) => {
    await aiApi.clearBulkSession(collectionId, queryType)
    set({ resumeSession: null })
  },

  clearCoinResult: (coinId: string) => {
    set((state) => {
      const newResults = { ...state.results }
      delete newResults[coinId]
      const coinErrors = { ...state.coinErrors }
      delete coinErrors[coinId]
      return { results: newResults, coinErrors }
    })
  },

  appendCoinToNotes: async (coinId: string) => {
    const { results } = get()
    const info = results[coinId]
    if (!info) return false

    const text = aiInfoToText(info)
    if (!text) return false

    try {
      // Notes live in the coin_notes table (migration V9) — mirror the
      // upsert semantics of saveAiNote in the main process: one AI note
      // per query type, titled "AI: <queryType>".
      const queryType = info.queryType ?? 'info'
      const title = `${AI_NOTE_TITLE_PREFIX}${queryType}`

      const notes = await window.api.notes.list(coinId)
      const existing = notes.find(
        (n) => n.title === title || (queryType === 'info' && n.title === 'AI Import')
      )

      const saved = existing
        ? await window.api.notes.update({ id: existing.id, content: text })
        : await window.api.notes.create({ coinId, title, content: text })

      return saved != null
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[useAiStore] Failed to append AI info to notes for coin', coinId, message)
      return false
    }
  },

  setManualInput: (input: string) => set({ manualInput: input }),

  parseManualInput: () => {
    const { manualInput } = get()
    if (!manualInput.trim()) return

    try {
      const parsed = JSON.parse(manualInput)
      if (!Array.isArray(parsed)) {
        set({ error: 'Expected a JSON array' })
        return
      }

      const newResults: Record<string, AiCoinInfo> = {}
      for (const item of parsed) {
        if (item && typeof item === 'object' && typeof item.id === 'string') {
          newResults[item.id] = {
            id: item.id,
            info: typeof item.info === 'string' ? item.info : undefined,
            price: typeof item.price === 'string' ? item.price : undefined,
            mintage: typeof item.mintage === 'string' ? item.mintage : undefined,
            rarity: typeof item.rarity === 'string' ? item.rarity : undefined,
            varieties: Array.isArray(item.varieties) ? item.varieties : undefined
          }
        }
      }

      set((state) => ({
        results: { ...state.results, ...newResults },
        manualInput: '',
        error: null
      }))
    } catch {
      set({ error: 'Invalid JSON format' })
    }
  }
  }
})
