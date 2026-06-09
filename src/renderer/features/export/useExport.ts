import { create } from 'zustand'
import type { Collection } from '@shared/types'

interface ExportProgress {
  stage: string
  current: number
  total: number
  message: string
}

interface ExportState {
  open: boolean
  collections: Collection[]
  selectedIds: string[]
  includeSold: boolean
  includeImages: boolean
  progress: ExportProgress | null
  exporting: boolean
  error: string | null
}

interface ExportActions {
  openDialog: () => void
  closeDialog: () => void
  setCollections: (collections: Collection[]) => void
  toggleCollection: (id: string) => void
  selectAll: () => void
  deselectAll: () => void
  setIncludeSold: (v: boolean) => void
  setIncludeImages: (v: boolean) => void
  exportExcel: () => Promise<void>
  setProgress: (p: ExportProgress | null) => void
}

const initialState: ExportState = {
  open: false,
  collections: [],
  selectedIds: [],
  includeSold: false,
  includeImages: true,
  progress: null,
  exporting: false,
  error: null
}

export const useExportStore = create<ExportState & ExportActions>((set, get) => ({
  ...initialState,

  openDialog: () => {
    set({ open: true, error: null, progress: null, exporting: false })
  },

  closeDialog: () => {
    if (get().exporting) return // don't close while exporting
    set(initialState)
  },

  setCollections: (collections) => {
    set({
      collections,
      selectedIds: collections.map((c) => c.id)
    })
  },

  toggleCollection: (id) => {
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((sid) => sid !== id)
        : [...state.selectedIds, id]
    }))
  },

  selectAll: () => {
    set((state) => ({ selectedIds: state.collections.map((c) => c.id) }))
  },

  deselectAll: () => {
    set({ selectedIds: [] })
  },

  setIncludeSold: (v) => set({ includeSold: v }),
  setIncludeImages: (v) => set({ includeImages: v }),

  setProgress: (p) => set({ progress: p }),

  exportExcel: async () => {
    const state = get()
    if (state.selectedIds.length === 0) return

    set({ exporting: true, error: null, progress: null })

    // Listen for progress events
    const unsub = window.api.export.onProgress((data) => {
      get().setProgress(data)
    })

    try {
      const result = await window.api.export.excel({
        collectionIds: state.selectedIds,
        includeSold: state.includeSold,
        includeImages: state.includeImages,
        locale: navigator.language.startsWith('ru') ? 'ru' : 'en'
      })

      if (result) {
        set({ exporting: false, progress: null })
        // Close dialog on success
        setTimeout(() => set(initialState), 500)
      } else {
        // Cancelled by user
        set({ exporting: false, progress: null, error: null })
      }
    } catch (err) {
      set({
        exporting: false,
        error: err instanceof Error ? err.message : String(err),
        progress: null
      })
    } finally {
      unsub()
    }
  }
}))
