import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useCoinStore } from '@/features/coins/useCoins'
import * as coinApi from '@/features/coins/api'
import type { Coin, PaginatedResult } from '@shared/types'

vi.mock('@/features/coins/api', () => ({
  fetchCoins: vi.fn(),
  getCoin: vi.fn(),
  createCoin: vi.fn(),
  updateCoin: vi.fn(),
  deleteCoin: vi.fn()
}))

const mockCoin: Coin = {
  id: 'c1',
  collectionId: 'ru',
  denomination: '1 рубль',
  year: 1999,
  condition: 'UNC',
  purchaseDate: null,
  purchasePlace: null,
  price: 50,
  shippingCost: null,
  currency: 'RUB',
  country: null,
  notes: 'Test coin',
  extraData: null,
  sold: false,
  createdAt: 1000,
  updatedAt: 1000,
  composition: null,
  onAuction: false,
  auctionPrice: null,
  salePrice: null
}

const mockResult: PaginatedResult<Coin> = {
  items: [mockCoin],
  nextCursor: null,
  hasMore: false
}

describe('useCoinStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    act(() => {
      useCoinStore.getState().reset()
    })
  })

  describe('loadCoins', () => {
    it('should load coins for a collection', async () => {
      vi.mocked(coinApi.fetchCoins).mockResolvedValue(mockResult)

      await act(async () => {
        await useCoinStore.getState().loadCoins('ru')
      })

      const state = useCoinStore.getState()
      expect(state.coins).toEqual([mockCoin])
      expect(state.hasMore).toBe(false)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should set error on failure', async () => {
      vi.mocked(coinApi.fetchCoins).mockRejectedValue(new Error('fail'))

      await act(async () => {
        await useCoinStore.getState().loadCoins('ru')
      })

      expect(useCoinStore.getState().error).toBe('coins.errors.loadFailed')
      expect(useCoinStore.getState().loading).toBe(false)
    })
  })

  describe('addCoin', () => {
    it('should add coin at top of list', async () => {
      vi.mocked(coinApi.fetchCoins).mockResolvedValue(mockResult)
      const newCoin = { ...mockCoin, id: 'c2', denomination: '5 рублей' }
      vi.mocked(coinApi.createCoin).mockResolvedValue(newCoin)

      await act(async () => {
        await useCoinStore.getState().loadCoins('ru')
      })

      await act(async () => {
        const result = await useCoinStore.getState().addCoin({
          collectionId: 'ru',
          denomination: '5 рублей',
          year: 1999
        })
        expect(result).toEqual(newCoin)
      })

      const state = useCoinStore.getState()
      expect(state.coins[0].id).toBe('c2')
      expect(state.coins).toHaveLength(2)
    })
  })

  describe('updateCoin', () => {
    it('should update coin in list', async () => {
      vi.mocked(coinApi.fetchCoins).mockResolvedValue(mockResult)
      const updated = { ...mockCoin, denomination: '2 рубля' }
      vi.mocked(coinApi.updateCoin).mockResolvedValue(updated)

      await act(async () => {
        await useCoinStore.getState().loadCoins('ru')
      })

      await act(async () => {
        const result = await useCoinStore.getState().updateCoin({
          id: 'c1',
          denomination: '2 рубля'
        })
        expect(result).toEqual(updated)
      })

      expect(useCoinStore.getState().coins[0].denomination).toBe('2 рубля')
      expect(useCoinStore.getState().coins).toHaveLength(1)
    })

    it('should remove coin from list when collectionId changes', async () => {
      vi.mocked(coinApi.fetchCoins).mockResolvedValue(mockResult)
      const movedCoin = { ...mockCoin, collectionId: 'us' }
      vi.mocked(coinApi.updateCoin).mockResolvedValue(movedCoin)

      await act(async () => {
        await useCoinStore.getState().loadCoins('ru')
      })

      await act(async () => {
        const result = await useCoinStore.getState().updateCoin({
          id: 'c1',
          collectionId: 'us'
        })
        expect(result).toEqual(movedCoin)
      })

      // Coin should be removed from the current list since it moved to another collection
      expect(useCoinStore.getState().coins).toHaveLength(0)
    })

    it('should handle update error', async () => {
      vi.mocked(coinApi.fetchCoins).mockResolvedValue(mockResult)
      vi.mocked(coinApi.updateCoin).mockRejectedValue(new Error('fail'))

      await act(async () => {
        await useCoinStore.getState().loadCoins('ru')
      })

      await act(async () => {
        const result = await useCoinStore.getState().updateCoin({
          id: 'c1',
          denomination: 'test'
        })
        expect(result).toBeNull()
      })

      expect(useCoinStore.getState().error).toBe('coins.errors.updateFailed')
    })
  })

  describe('deleteCoin', () => {
    it('should remove coin from list', async () => {
      vi.mocked(coinApi.fetchCoins).mockResolvedValue(mockResult)
      vi.mocked(coinApi.deleteCoin).mockResolvedValue(true)

      await act(async () => {
        await useCoinStore.getState().loadCoins('ru')
      })

      await act(async () => {
        const result = await useCoinStore.getState().deleteCoin('c1')
        expect(result).toBe(true)
      })

      expect(useCoinStore.getState().coins).toHaveLength(0)
    })
  })
})
