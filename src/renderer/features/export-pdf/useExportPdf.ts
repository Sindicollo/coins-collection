import { create } from 'zustand'
import i18n from '@/lib/i18n'
import type { Collection } from '@shared/types'

interface ExportProgress {
  stage: string
  current: number
  total: number
  message: string
}

interface ExportPdfState {
  open: boolean
  collections: Collection[]
  selectedIds: string[]
  includeSold: boolean
  includeImages: boolean
  includePurchaseInfo: boolean
  progress: ExportProgress | null
  exporting: boolean
  error: string | null
}

interface ExportPdfActions {
  openDialog: () => void
  closeDialog: () => void
  setCollections: (collections: Collection[]) => void
  toggleCollection: (id: string) => void
  selectAll: () => void
  deselectAll: () => void
  setIncludeSold: (v: boolean) => void
  setIncludeImages: (v: boolean) => void
  setIncludePurchaseInfo: (v: boolean) => void
  exportPdf: () => Promise<void>
  setProgress: (p: ExportProgress | null) => void
}

const initialState: ExportPdfState = {
  open: false,
  collections: [],
  selectedIds: [],
  includeSold: false,
  includeImages: true,
  includePurchaseInfo: false,
  progress: null,
  exporting: false,
  error: null
}

export const useExportPdfStore = create<ExportPdfState & ExportPdfActions>((set, get) => ({
  ...initialState,

  openDialog: () => {
    set({ open: true, error: null, progress: null, exporting: false })
  },

  closeDialog: () => {
    if (get().exporting) return
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
  setIncludePurchaseInfo: (v) => set({ includePurchaseInfo: v }),

  setProgress: (p) => set({ progress: p }),

  exportPdf: async () => {
    const state = get()
    if (state.selectedIds.length === 0) return

    set({ exporting: true, error: null, progress: null })

    let unsub: (() => void) | null = null
    try {
      unsub = window.api.export.onProgress((data) => {
        set({ progress: data })
      })

      const result = await window.api.export.pdf({
        collectionIds: state.selectedIds,
        includeSold: state.includeSold,
        includeImages: state.includeImages,
        includePurchaseInfo: state.includePurchaseInfo,
        locale: i18n.language.startsWith('ru') ? 'ru' : 'en'
      })

      if (result) {
        set({ exporting: false, progress: null, open: false })
      } else {
        set({ exporting: false, progress: null, error: null })
      }
    } catch (err) {
      set({
        exporting: false,
        error: err instanceof Error ? err.message : String(err),
        progress: null
      })
    } finally {
      unsub?.()
    }
  }
}))
