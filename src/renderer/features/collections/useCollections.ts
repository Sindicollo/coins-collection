import { useCallback } from 'react'
import { create } from 'zustand'
import type { Collection } from '@shared/types'
import * as collectionApi from './api'

interface CollectionState {
  collections: Collection[]
  selectedCollectionId: string | null
  loading: boolean
  error: string | null
}

interface CollectionActions {
  selectCollection: (id: string) => void
  loadCollections: () => Promise<void>
  addCollection: (name: string) => Promise<Collection | null>
  updateCollection: (id: string, name: string) => Promise<Collection | null>
  deleteCollection: (id: string) => Promise<boolean>
}

type CollectionStore = CollectionState & CollectionActions

const useCollectionStore = create<CollectionStore>((set) => ({
  collections: [],
  selectedCollectionId: null,
  loading: false,
  error: null,

  selectCollection: (id: string) => set({ selectedCollectionId: id }),

  loadCollections: async () => {
    set({ loading: true, error: null })
    try {
      const collections = await collectionApi.fetchCollections()
      set({ collections, loading: false })
    } catch {
      set({ error: 'countries.errors.loadFailed', loading: false })
    }
  },

  addCollection: async (name: string) => {
    set({ error: null })
    try {
      const collection = await collectionApi.createCollection(name)
      set((state) => ({
        collections: [...state.collections, collection],
        selectedCollectionId: collection.id
      }))
      return collection
    } catch {
      set({ error: 'countries.errors.createFailed' })
      return null
    }
  },

  updateCollection: async (id: string, name: string) => {
    set({ error: null })
    try {
      const updated = await collectionApi.updateCollection(id, name)
      if (updated) {
        set((state) => ({
          collections: state.collections.map((c) => (c.id === id ? updated : c))
        }))
      }
      return updated
    } catch {
      set({ error: 'countries.errors.updateFailed' })
      return null
    }
  },

  deleteCollection: async (id: string) => {
    set({ error: null })
    try {
      const success = await collectionApi.deleteCollection(id)
      if (success) {
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== id),
          selectedCollectionId: state.selectedCollectionId === id ? null : state.selectedCollectionId
        }))
      }
      return success
    } catch {
      set({ error: 'countries.errors.deleteFailed' })
      return false
    }
  }
}))

export function useCollectionManager() {
  const {
    collections,
    selectedCollectionId,
    loading,
    error,
    selectCollection,
    loadCollections,
    addCollection,
    updateCollection,
    deleteCollection
  } = useCollectionStore()

  return {
    collections,
    selectedId: selectedCollectionId,
    loading,
    error,
    selectCollection: useCallback((id: string) => selectCollection(id), [selectCollection]),
    loadCollections: useCallback(() => loadCollections(), [loadCollections]),
    addCollection: useCallback((name: string) => addCollection(name), [addCollection]),
    updateCollection: useCallback((id: string, name: string) => updateCollection(id, name), [updateCollection]),
    deleteCollection: useCallback((id: string) => deleteCollection(id), [deleteCollection])
  }
}
