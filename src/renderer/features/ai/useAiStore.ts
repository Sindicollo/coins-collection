import { create } from 'zustand'
import type { AiCoinInfo } from '@shared/types'
import * as aiApi from './api'

interface AiState {
  results: Record<string, AiCoinInfo>
  loading: boolean
  error: string | null
  lastQueryType: string | null
  manualInput: string
  configLoading: boolean
  configLoaded: boolean
}

interface AiActions {
  queryBulk: (collectionId: string, queryType: string) => Promise<void>
  querySingle: (coinId: string, queryType: string) => Promise<AiCoinInfo | null>
  clearResults: () => void
  clearCoinResult: (coinId: string) => void
  appendCoinToNotes: (coinId: string) => Promise<boolean>
  setManualInput: (input: string) => void
  parseManualInput: () => void
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

export const useAiStore = create<AiStore>((set, get) => ({
  results: {},
  loading: false,
  error: null,
  lastQueryType: null,
  manualInput: '',
  configLoading: false,
  configLoaded: false,

  queryBulk: async (collectionId: string, queryType: string) => {
    set({ loading: true, error: null, lastQueryType: queryType })
    try {
      const results = await aiApi.queryBulk(collectionId, queryType)
      set((state) => {
        const newResults = { ...state.results }
        for (const item of results) {
          newResults[item.id] = item
        }
        return { results: newResults, loading: false }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({
        error: message || 'Failed to query LLM',
        loading: false
      })
    }
  },

  querySingle: async (coinId: string, queryType: string) => {
    set({ loading: true, error: null })
    try {
      const result = await aiApi.querySingle(coinId, queryType)
      set((state) => ({
        results: { ...state.results, [coinId]: result },
        loading: false
      }))
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({
        error: message || 'Failed to query LLM',
        loading: false
      })
      return null
    }
  },

  clearResults: () => set({ results: {}, error: null, lastQueryType: null }),

  clearCoinResult: (coinId: string) => {
    set((state) => {
      const newResults = { ...state.results }
      delete newResults[coinId]
      return { results: newResults }
    })
  },

  appendCoinToNotes: async (coinId: string) => {
    const { results } = get()
    const info = results[coinId]
    if (!info) return false

    const text = aiInfoToText(info)
    if (!text) return false

    try {
      const coin = await window.api.coins.get(coinId)
      if (!coin) return false

      const existingNotes = coin.notes || ''
      const newNotes = existingNotes ? existingNotes + '\n\n---\n' + text : text

      await window.api.coins.update({
        id: coinId,
        notes: newNotes
      })

      // Clear the result after appending
      const newResults = { ...get().results }
      delete newResults[coinId]
      set({ results: newResults })

      return true
    } catch {
      console.error('Failed to append AI info to notes for coin', coinId)
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
}))
