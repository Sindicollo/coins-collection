import { create } from 'zustand'
import type { Photo } from '@shared/types'
import * as photoApi from './api'

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

interface PhotoState {
  photos: Photo[]
  loading: boolean
  error: string | null
}

interface PhotoActions {
  loadPhotos: (coinId: string) => Promise<void>
  uploadPhoto: (coinId: string) => Promise<void>
  uploadPhotosFromPaths: (coinId: string, filePaths: string[]) => Promise<void>
  uploadFromFiles: (coinId: string, files: Array<{ originalName: string; dataUrl: string }>) => Promise<void>
  deletePhoto: (id: string) => Promise<void>
  reorderPhotos: (coinId: string, photoIds: string[]) => Promise<void>
  reset: () => void
}

type Store = PhotoState & PhotoActions

const initialState: PhotoState = {
  photos: [],
  loading: false,
  error: null
}

export const usePhotoStore = create<Store>((set) => {
  function appendUploadedPhotos(photos: Photo[]) {
    if (photos.length > 0) {
      set((state) => ({ photos: [...state.photos, ...photos] }))
    }
  }

  return {
    ...initialState,

    loadPhotos: async (coinId: string) => {
      set({ loading: true, error: null })
      try {
        const photos = await photoApi.fetchPhotos(coinId)
        set({ photos, loading: false })
      } catch (err) {
        set({ error: toErrorMessage(err), loading: false })
      }
    },

    uploadPhoto: async (coinId: string) => {
      set({ error: null })
      try {
        const photos = await photoApi.uploadPhoto(coinId)
        appendUploadedPhotos(photos)
      } catch (err) {
        set({ error: toErrorMessage(err) })
      }
    },

    uploadPhotosFromPaths: async (coinId: string, filePaths: string[]) => {
      set({ error: null })
      try {
        const photos = await photoApi.uploadPhotosFromPaths(coinId, filePaths)
        appendUploadedPhotos(photos)
      } catch (err) {
        set({ error: toErrorMessage(err) })
      }
    },

    uploadFromFiles: async (coinId: string, files: Array<{ originalName: string; dataUrl: string }>) => {
      set({ error: null })
      try {
        const photos = await photoApi.uploadFromFiles(coinId, files)
        appendUploadedPhotos(photos)
      } catch (err) {
        set({ error: toErrorMessage(err) })
      }
    },

    deletePhoto: async (id: string) => {
      set({ error: null })
      try {
        const deleted = await photoApi.deletePhoto(id)
        if (!deleted) {
          set({ error: 'Не удалось удалить фото' })
          return
        }
        set((state) => ({ photos: state.photos.filter((p) => p.id !== id) }))
      } catch (err) {
        set({ error: toErrorMessage(err) })
      }
    },

    reorderPhotos: async (coinId: string, photoIds: string[]) => {
      set({ error: null })
      try {
        await photoApi.reorderPhotos(coinId, photoIds)
        set((state) => {
          const photoMap = new Map(state.photos.map((p) => [p.id, p]))
          const reordered = photoIds
            .map((id) => photoMap.get(id))
            .filter((p): p is typeof state.photos[0] => p !== undefined)
          return { photos: reordered }
        })
      } catch (err) {
        set({ error: toErrorMessage(err) })
      }
    },

    reset: () => set(initialState)
  }
})
