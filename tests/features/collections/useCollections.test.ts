import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCollectionManager } from '@/features/collections/useCollections'
import * as collectionApi from '@/features/collections/api'

vi.mock('@/features/collections/api', () => ({
  fetchCollections: vi.fn(),
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn()
}))

const mockCollections = [
  { id: '1', name: 'Russia', createdAt: 1000, updatedAt: 1000 },
  { id: '2', name: 'USA', createdAt: 2000, updatedAt: 2000 },
  { id: '3', name: 'Germany', createdAt: 3000, updatedAt: 3000 }
]

describe('useCollectionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadCollections', () => {
    it('should load collections and set loading=false', async () => {
      vi.mocked(collectionApi.fetchCollections).mockResolvedValue(mockCollections)

      const { result } = renderHook(() => useCollectionManager())

      expect(result.current.loading).toBe(false)
      expect(result.current.collections).toEqual([])

      await act(async () => {
        await result.current.loadCollections()
      })

      expect(result.current.collections).toEqual(mockCollections)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should set error on failure', async () => {
      vi.mocked(collectionApi.fetchCollections).mockRejectedValue(new Error('DB Error'))

      const { result } = renderHook(() => useCollectionManager())

      await act(async () => {
        await result.current.loadCollections()
      })

      expect(result.current.error).toBe('countries.errors.loadFailed')
      expect(result.current.loading).toBe(false)
    })
  })

  describe('addCollection', () => {
    it('should add collection to list and select it', async () => {
      vi.mocked(collectionApi.fetchCollections).mockResolvedValue([])
      const newCollection = { id: '4', name: 'France', createdAt: 4000, updatedAt: 4000 }
      vi.mocked(collectionApi.createCollection).mockResolvedValue(newCollection)

      const { result } = renderHook(() => useCollectionManager())

      await act(async () => {
        await result.current.loadCollections()
      })

      await act(async () => {
        const collection = await result.current.addCollection('France')
        expect(collection).toEqual(newCollection)
      })

      expect(result.current.collections).toContainEqual(newCollection)
      expect(result.current.selectedId).toBe('4')
    })

    it('should set error on create failure', async () => {
      vi.mocked(collectionApi.fetchCollections).mockResolvedValue([])
      vi.mocked(collectionApi.createCollection).mockRejectedValue(new Error('DB Error'))

      const { result } = renderHook(() => useCollectionManager())

      await act(async () => {
        await result.current.loadCollections()
      })

      await act(async () => {
        const collection = await result.current.addCollection('Fail')
        expect(collection).toBeNull()
      })

      expect(result.current.error).toBe('countries.errors.createFailed')
    })
  })

  describe('updateCollection', () => {
    it('should update collection name in list', async () => {
      vi.mocked(collectionApi.fetchCollections).mockResolvedValue(mockCollections)
      const updated = { ...mockCollections[0], name: 'Russian Federation' }
      vi.mocked(collectionApi.updateCollection).mockResolvedValue(updated)

      const { result } = renderHook(() => useCollectionManager())

      await act(async () => {
        await result.current.loadCollections()
      })

      await act(async () => {
        const res = await result.current.updateCollection('1', 'Russian Federation')
        expect(res).toEqual(updated)
      })

      expect(result.current.collections.find((c) => c.id === '1')?.name).toBe('Russian Federation')
    })

    it('should return null if update fails', async () => {
      vi.mocked(collectionApi.fetchCollections).mockResolvedValue(mockCollections)
      vi.mocked(collectionApi.updateCollection).mockRejectedValue(new Error('Not found'))

      const { result } = renderHook(() => useCollectionManager())

      await act(async () => {
        await result.current.loadCollections()
      })

      await act(async () => {
        const res = await result.current.updateCollection('1', 'New Name')
        expect(res).toBeNull()
      })

      expect(result.current.error).toBe('countries.errors.updateFailed')
    })
  })

  describe('deleteCollection', () => {
    it('should remove collection and clear selection', async () => {
      vi.mocked(collectionApi.fetchCollections).mockResolvedValue(mockCollections)
      vi.mocked(collectionApi.deleteCollection).mockResolvedValue(true)

      const { result } = renderHook(() => useCollectionManager())

      await act(async () => {
        await result.current.loadCollections()
      })

      // Select the collection first
      act(() => {
        result.current.selectCollection('1')
      })
      expect(result.current.selectedId).toBe('1')

      await act(async () => {
        const success = await result.current.deleteCollection('1')
        expect(success).toBe(true)
      })

      expect(result.current.collections.find((c) => c.id === '1')).toBeUndefined()
      expect(result.current.selectedId).toBeNull()
    })

    it('should not clear selection if deleting different collection', async () => {
      vi.mocked(collectionApi.fetchCollections).mockResolvedValue(mockCollections)
      vi.mocked(collectionApi.deleteCollection).mockResolvedValue(true)

      const { result } = renderHook(() => useCollectionManager())

      await act(async () => {
        await result.current.loadCollections()
      })
      act(() => {
        result.current.selectCollection('1')
      })

      await act(async () => {
        await result.current.deleteCollection('2')
      })

      expect(result.current.selectedId).toBe('1')
    })
  })

  describe('selectCollection', () => {
    it('should update selectedCollectionId', () => {
      const { result } = renderHook(() => useCollectionManager())

      act(() => {
        result.current.selectCollection('2')
      })

      expect(result.current.selectedId).toBe('2')
    })
  })
})
