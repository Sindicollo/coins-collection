import type { Photo } from '@shared/types'

export async function fetchPhotos(coinId: string): Promise<Photo[]> {
  return window.api.photos.list(coinId)
}

export async function uploadPhoto(coinId: string): Promise<Photo[]> {
  return window.api.photos.create(coinId) as Promise<Photo[]>
}

export async function uploadPhotosFromPaths(coinId: string, filePaths: string[]): Promise<Photo[]> {
  return window.api.photos.createFromPaths(coinId, filePaths) as Promise<Photo[]>
}

export async function deletePhoto(id: string): Promise<boolean> {
  return window.api.photos.delete(id)
}

export async function reorderPhotos(coinId: string, photoIds: string[]): Promise<void> {
  return window.api.photos.reorder(coinId, photoIds)
}
