import type { Photo } from '@shared/types'

export async function fetchPhotos(coinId: string): Promise<Photo[]> {
  return window.api.photos.list(coinId)
}

export async function getPhotoData(id: string): Promise<string | null> {
  return window.api.photos.getPhotoData(id)
}

export async function uploadPhoto(coinId: string): Promise<Photo | null> {
  return window.api.photos.create(coinId)
}

export async function deletePhoto(id: string): Promise<boolean> {
  return window.api.photos.delete(id)
}

export async function reorderPhotos(coinId: string, photoIds: string[]): Promise<void> {
  return window.api.photos.reorder(coinId, photoIds)
}
