import { create } from 'zustand'
import type { Coin, CreateCoinInput, UpdateCoinInput } from '@shared/types'
import * as coinApi from './api'

interface CoinState {
  coins: Coin[]
  cursors: string[]
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
  error: string | null
  loadedCollectionId: string | null
  scrollPositions: Record<string, number>
}

interface CoinActions {
  loadCoins: (collectionId: string) => Promise<void>
  loadMore: (collectionId: string) => Promise<void>
  addCoin: (input: CreateCoinInput) => Promise<Coin | null>
  updateCoin: (input: UpdateCoinInput) => Promise<Coin | null>
  deleteCoin: (id: string) => Promise<boolean>
  saveScrollPosition: (collectionId: string, position: number) => void
  reset: () => void
}

type CoinStore = CoinState & CoinActions

export const useCoinStore = create<CoinStore>((set, get) => ({
  coins: [],
  cursors: [],
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  loadedCollectionId: null,
  scrollPositions: {},

  loadCoins: async (collectionId: string) => {
    const { loadedCollectionId } = get()
    // Don't clear coins if we already have them for this collection
    if (loadedCollectionId !== collectionId) {
      set({ loading: true, error: null, coins: [], cursors: [], hasMore: false, loadedCollectionId: collectionId })
    } else {
      set({ loading: true, error: null })
    }
    try {
      const result = await coinApi.fetchCoins({ collectionId, cursor: null })
      // Discard stale response when collection changed during fetch
      if (get().loadedCollectionId !== collectionId) return
      set({
        coins: result.items,
        cursors: result.nextCursor ? [result.nextCursor] : [],
        hasMore: result.hasMore,
        loading: false,
        loadedCollectionId: collectionId
      })
    } catch {
      set({ error: 'coins.errors.loadFailed', loading: false })
    }
  },

  saveScrollPosition: (collectionId: string, position: number) => {
    set((state) => ({
      scrollPositions: { ...state.scrollPositions, [collectionId]: position }
    }))
  },

  loadMore: async (collectionId: string) => {
    const { cursors, loadingMore, hasMore } = get()
    if (loadingMore || !hasMore || cursors.length === 0) return

    const cursor = cursors[cursors.length - 1]
    set({ loadingMore: true })

    try {
      const result = await coinApi.fetchCoins({ collectionId, cursor })
      // Discard stale response when collection changed during fetch
      if (get().loadedCollectionId !== collectionId) return
      set((state) => ({
        coins: [...state.coins, ...result.items],
        cursors: result.nextCursor
          ? [...state.cursors, result.nextCursor]
          : state.cursors,
        hasMore: result.hasMore,
        loadingMore: false
      }))
    } catch {
      set({ error: 'coins.errors.loadFailed', loadingMore: false })
    }
  },

  addCoin: async (input: CreateCoinInput) => {
    set({ error: null })
    try {
      const coin = await coinApi.createCoin(input)
      set((state) => ({
        coins: [coin, ...state.coins]
      }))
      return coin
    } catch {
      set({ error: 'coins.errors.createFailed' })
      return null
    }
  },

  updateCoin: async (input: UpdateCoinInput) => {
    set({ error: null })
    try {
      const updated = await coinApi.updateCoin(input)
      if (updated) {
        set((state) => {
          const oldCoin = state.coins.find((c) => c.id === input.id)
          // If the collection changed, remove the coin from the current list
          if (oldCoin && oldCoin.collectionId !== updated.collectionId) {
            return { coins: state.coins.filter((c) => c.id !== input.id) }
          }
          return { coins: state.coins.map((c) => (c.id === input.id ? updated : c)) }
        })
      }
      return updated
    } catch {
      set({ error: 'coins.errors.updateFailed' })
      return null
    }
  },

  deleteCoin: async (id: string) => {
    set({ error: null })
    try {
      const success = await coinApi.deleteCoin(id)
      if (success) {
        set((state) => ({
          coins: state.coins.filter((c) => c.id !== id)
        }))
      }
      return success
    } catch {
      set({ error: 'coins.errors.deleteFailed' })
      return false
    }
  },

  reset: () => set({ coins: [], cursors: [], hasMore: false, loading: false, error: null, loadedCollectionId: null })
}))
