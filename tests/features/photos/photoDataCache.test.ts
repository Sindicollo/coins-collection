import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getCachedPhotoData,
  fetchAndCachePhotoData,
  invalidatePhotoDataCache,
  getCachedPhotoList,
  fetchAndCachePhotoList,
  invalidatePhotoListCache,
  clearPhotoDataCache
} from '@/features/photos/photoDataCache'
import type { Photo } from '@shared/types'

const mockPhotos: Photo[] = [
  { id: 'p1', coinId: 'c1', filename: 'a.jpg', originalName: 'front.jpg', position: 0, createdAt: 1000 },
  { id: 'p2', coinId: 'c1', filename: 'b.jpg', originalName: 'back.jpg', position: 1, createdAt: 2000 }
]

describe('photoDataCache', () => {
  beforeEach(() => {
    clearPhotoDataCache()
    vi.clearAllMocks()
  })

  // --- data cache ---

  describe('fetchAndCachePhotoData', () => {
    it('fetches photo data from IPC on cache miss and caches it', async () => {
      window.api.photos.getPhotoData = vi.fn().mockResolvedValue('data:image/jpeg;base64,/9j/4AAQ')

      const result = await fetchAndCachePhotoData('p1')

      expect(result).toBe('data:image/jpeg;base64,/9j/4AAQ')
      expect(window.api.photos.getPhotoData).toHaveBeenCalledWith('p1')
      // Second call uses cache
      const cached = getCachedPhotoData('p1')
      expect(cached).toBe('data:image/jpeg;base64,/9j/4AAQ')
    })

    it('returns cached value without calling IPC on cache hit', async () => {
      // First call to populate cache
      window.api.photos.getPhotoData = vi.fn().mockResolvedValue('data:image/jpeg;base64,/9j/4AAQ')
      await fetchAndCachePhotoData('p1')

      // Reset mock to detect second call
      vi.mocked(window.api.photos.getPhotoData).mockClear()

      // Second call — should use cache
      const result = await fetchAndCachePhotoData('p1')

      expect(result).toBe('data:image/jpeg;base64,/9j/4AAQ')
      expect(window.api.photos.getPhotoData).not.toHaveBeenCalled()
    })

    it('does not cache data that is not a valid image data URL', async () => {
      window.api.photos.getPhotoData = vi.fn().mockResolvedValue('data:text/html,<script>alert(1)</script>')

      const result = await fetchAndCachePhotoData('p1')

      expect(result).toBe('data:text/html,<script>alert(1)</script>')
      // Should NOT be cached
      expect(getCachedPhotoData('p1')).toBeUndefined()
    })

    it('returns null when IPC returns null', async () => {
      window.api.photos.getPhotoData = vi.fn().mockResolvedValue(null)

      const result = await fetchAndCachePhotoData('p1')

      expect(result).toBeNull()
      expect(getCachedPhotoData('p1')).toBeUndefined()
    })
  })

  describe('invalidatePhotoDataCache', () => {
    it('removes cached entries for given photo IDs', async () => {
      window.api.photos.getPhotoData = vi.fn().mockResolvedValue('data:image/jpeg;base64,abc')
      await fetchAndCachePhotoData('p1')
      await fetchAndCachePhotoData('p2')

      invalidatePhotoDataCache(['p1'])

      expect(getCachedPhotoData('p1')).toBeUndefined()
      expect(getCachedPhotoData('p2')).toBeDefined()
    })
  })

  // --- list cache ---

  describe('fetchAndCachePhotoList', () => {
    it('fetches photo list from IPC on cache miss and caches it', async () => {
      window.api.photos.list = vi.fn().mockResolvedValue(mockPhotos)

      const result = await fetchAndCachePhotoList('c1')

      expect(result).toEqual(mockPhotos)
      expect(window.api.photos.list).toHaveBeenCalledWith('c1')
      expect(getCachedPhotoList('c1')).toEqual(mockPhotos)
    })

    it('returns cached list without calling IPC on cache hit', async () => {
      // First call
      window.api.photos.list = vi.fn().mockResolvedValue(mockPhotos)
      await fetchAndCachePhotoList('c1')

      // Verify cached
      vi.mocked(window.api.photos.list).mockClear()

      const result = await fetchAndCachePhotoList('c1')

      expect(result).toEqual(mockPhotos)
      expect(window.api.photos.list).not.toHaveBeenCalled()
    })
  })

  describe('getCachedPhotoList', () => {
    it('returns a copy of the cached list, preventing mutation', async () => {
      window.api.photos.list = vi.fn().mockResolvedValue(mockPhotos)
      await fetchAndCachePhotoList('c1')

      const list1 = getCachedPhotoList('c1')
      const list2 = getCachedPhotoList('c1')

      expect(list1).toEqual(mockPhotos)
      // Should be different references
      expect(list1).not.toBe(list2)
    })

    it('returns undefined when no cached list exists', () => {
      expect(getCachedPhotoList('unknown')).toBeUndefined()
    })
  })

  describe('invalidatePhotoListCache', () => {
    it('removes cached list for the given coin ID', async () => {
      window.api.photos.list = vi.fn().mockResolvedValue(mockPhotos)
      await fetchAndCachePhotoList('c1')

      invalidatePhotoListCache('c1')

      expect(getCachedPhotoList('c1')).toBeUndefined()
    })
  })

  // --- bulk clear ---

  describe('clearPhotoDataCache', () => {
    it('clears both data and list caches', async () => {
      window.api.photos.getPhotoData = vi.fn().mockResolvedValue('data:image/jpeg;base64,abc')
      window.api.photos.list = vi.fn().mockResolvedValue(mockPhotos)

      await fetchAndCachePhotoData('p1')
      await fetchAndCachePhotoList('c1')

      clearPhotoDataCache()

      expect(getCachedPhotoData('p1')).toBeUndefined()
      expect(getCachedPhotoList('c1')).toBeUndefined()
    })
  })
})
