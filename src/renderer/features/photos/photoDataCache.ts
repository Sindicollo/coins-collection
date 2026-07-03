// Module-level cache for photo data URLs (base64-encoded image data) and photo lists.
// Survives component remounts across collection switches — eliminates repeated
// IPC reads from disk when navigating back to a previously loaded coin.

import type { Photo } from '@shared/types'

// --- photo data URL cache (photoId → base64 data URL) ---

const dataCache = new Map<string, string>()

/** Get cached data URL for a photo, if already fetched. */
export function getCachedPhotoData(photoId: string): string | undefined {
  return dataCache.get(photoId)
}

/** Fetch photo data from main process, with cache-first strategy. */
export async function fetchAndCachePhotoData(photoId: string): Promise<string | null> {
  const cached = dataCache.get(photoId)
  if (cached) return cached

  const data = await window.api.photos.getPhotoData(photoId)
  if (data && data.startsWith('data:image/')) {
    dataCache.set(photoId, data)
  }
  return data
}

/** Remove cached entries for given photo IDs (e.g., after deletion). */
export function invalidatePhotoDataCache(photoIds: string[]): void {
  for (const id of photoIds) {
    dataCache.delete(id)
  }
}

// --- photo list cache (coinId → Photo[]) ---

const listCache = new Map<string, Photo[]>()

/** Get cached photo list for a coin, if already fetched. Returns a copy to prevent caller mutation. */
export function getCachedPhotoList(coinId: string): Photo[] | undefined {
  return listCache.get(coinId)?.slice()
}

/** Fetch photo list from main process, with cache-first strategy. */
export async function fetchAndCachePhotoList(coinId: string): Promise<Photo[]> {
  const cached = listCache.get(coinId)
  if (cached) return cached

  const photos = await window.api.photos.list(coinId)
  listCache.set(coinId, photos)
  return photos
}

/** Invalidate list cache for a coin (e.g., after adding/removing photos). */
export function invalidatePhotoListCache(coinId: string): void {
  listCache.delete(coinId)
}

// --- bulk clear ---

/** Clear all caches. */
export function clearPhotoDataCache(): void {
  dataCache.clear()
  listCache.clear()
}
