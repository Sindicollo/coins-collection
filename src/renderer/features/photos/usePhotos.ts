import { create } from 'zustand'
import type { Photo } from '@shared/types'
import * as photoApi from './api'

interface PhotoState {
  photos: Photo[]
  loading: boolean
  error: string | null
}

interface PhotoActions {
  loadPhotos: (coinId: string) => Promise<void>
  uploadPhoto: (coinId: string) => Promise<void>
  deletePhoto: (id: string) => Promise<void>
  reset: () => void
}

const initialState: PhotoState = {
  photos: [],
  loading: false,
  error: null
}

export const usePhotoStore = create<PhotoState & PhotoActions>((set) => ({
  ...initialState,

  loadPhotos: async (coinId: string) => {
    set({ loading: true, error: null })
    try {
      const photos = await photoApi.fetchPhotos(coinId)
      set({ photos, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  uploadPhoto: async (coinId: string) => {
    set({ error: null })
    try {
      const photo = await photoApi.uploadPhoto(coinId)
      if (photo) {
        set((state) => ({ photos: [...state.photos, photo] }))
      }
    } catch (err) {
      set({ error: String(err) })
    }
  },

  deletePhoto: async (id: string) => {
    set({ error: null })
    try {
      await photoApi.deletePhoto(id)
      set((state) => ({ photos: state.photos.filter((p) => p.id !== id) }))
    } catch (err) {
      set({ error: String(err) })
    }
  },

  reset: () => set(initialState)
}))
