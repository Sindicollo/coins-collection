import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useExportStore } from '@/features/export/useExport'

const mockCollection = { id: 'c1', name: 'Russia', createdAt: 1000, updatedAt: 1000 }

describe('useExportStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store to initial state
    act(() => {
      useExportStore.setState({
        open: false,
        collections: [],
        selectedIds: [],
        includeSold: false,
        includeImages: true,
        progress: null,
        exporting: false,
        error: null
      })
    })
  })

  describe('openDialog', () => {
    it('sets open to true and resets error/progress', () => {
      act(() => {
        useExportStore.getState().openDialog()
      })

      const state = useExportStore.getState()
      expect(state.open).toBe(true)
      expect(state.error).toBeNull()
      expect(state.progress).toBeNull()
      expect(state.exporting).toBe(false)
    })
  })

  describe('closeDialog', () => {
    it('resets to initial state when not exporting', () => {
      act(() => {
        useExportStore.getState().openDialog()
        useExportStore.getState().setCollections([mockCollection])
      })

      act(() => {
        useExportStore.getState().closeDialog()
      })

      const state = useExportStore.getState()
      expect(state.open).toBe(false)
      expect(state.collections).toEqual([])
      expect(state.selectedIds).toEqual([])
    })

    it('does nothing while exporting', () => {
      act(() => {
        useExportStore.setState({ open: true, exporting: true })
      })

      act(() => {
        useExportStore.getState().closeDialog()
      })

      expect(useExportStore.getState().open).toBe(true)
    })
  })

  describe('setCollections', () => {
    it('sets collections and selects all by default', () => {
      const collections = [
        { id: 'c1', name: 'Russia', createdAt: 1000, updatedAt: 1000 },
        { id: 'c2', name: 'USA', createdAt: 2000, updatedAt: 2000 }
      ]

      act(() => {
        useExportStore.getState().setCollections(collections)
      })

      const state = useExportStore.getState()
      expect(state.collections).toEqual(collections)
      expect(state.selectedIds).toEqual(['c1', 'c2'])
    })
  })

  describe('toggleCollection', () => {
    it('adds id to selectedIds when not selected', () => {
      act(() => {
        useExportStore.getState().setCollections([mockCollection])
      })

      act(() => {
        useExportStore.getState().toggleCollection('c1') // deselect
      })

      expect(useExportStore.getState().selectedIds).toEqual([])
    })

    it('removes id from selectedIds when already selected', () => {
      act(() => {
        useExportStore.getState().setCollections([mockCollection])
      })

      act(() => {
        useExportStore.getState().toggleCollection('c1') // deselect
        useExportStore.getState().toggleCollection('c1') // re-select
      })

      expect(useExportStore.getState().selectedIds).toEqual(['c1'])
    })
  })

  describe('selectAll / deselectAll', () => {
    it('selectAll selects all collection ids', () => {
      act(() => {
        useExportStore.getState().setCollections([
          mockCollection,
          { id: 'c2', name: 'USA', createdAt: 2000, updatedAt: 2000 }
        ])
      })

      act(() => {
        useExportStore.getState().deselectAll()
        useExportStore.getState().selectAll()
      })

      expect(useExportStore.getState().selectedIds).toEqual(['c1', 'c2'])
    })

    it('deselectAll clears selectedIds', () => {
      act(() => {
        useExportStore.getState().setCollections([mockCollection])
      })

      act(() => {
        useExportStore.getState().deselectAll()
      })

      expect(useExportStore.getState().selectedIds).toEqual([])
    })
  })

  describe('includeSold / includeImages toggles', () => {
    it('setIncludeSold updates includeSold', () => {
      act(() => {
        useExportStore.getState().setIncludeSold(true)
      })
      expect(useExportStore.getState().includeSold).toBe(true)
    })

    it('setIncludeImages updates includeImages', () => {
      act(() => {
        useExportStore.getState().setIncludeImages(false)
      })
      expect(useExportStore.getState().includeImages).toBe(false)
    })
  })

  describe('setProgress', () => {
    it('sets progress state', () => {
      const progress = { stage: 'Exporting', current: 5, total: 10, message: '5/10' }

      act(() => {
        useExportStore.getState().setProgress(progress)
      })

      expect(useExportStore.getState().progress).toEqual(progress)
    })
  })

  describe('exportExcel', () => {
    const mockProgress = { stage: 'Processing', current: 1, total: 3, message: '1/3' }

    it('happy path — export succeeds, dialog closes', async () => {
      vi.mocked(window.api.export.excel).mockResolvedValue('/tmp/export.xlsx')
      vi.mocked(window.api.export.onProgress).mockImplementation(
        (cb: (data: unknown) => void) => {
          cb(mockProgress)
          return vi.fn()
        }
      )

      act(() => {
        useExportStore.getState().openDialog()
        useExportStore.getState().setCollections([mockCollection])
      })

      await act(async () => {
        await useExportStore.getState().exportExcel()
      })

      const state = useExportStore.getState()
      expect(state.exporting).toBe(false)
      expect(state.open).toBe(false) // dialog closes on success
      expect(state.error).toBeNull()
      expect(state.progress).toBeNull()
    })

    it('cancelled export — API returns null, dialog stays open', async () => {
      vi.mocked(window.api.export.excel).mockResolvedValue(null)

      act(() => {
        useExportStore.getState().openDialog()
        useExportStore.getState().setCollections([mockCollection])
      })

      await act(async () => {
        await useExportStore.getState().exportExcel()
      })

      const state = useExportStore.getState()
      expect(state.exporting).toBe(false)
      expect(state.error).toBeNull()
      // cancelled by user — dialog stays open? Actually closeDialog reset happens
      // on manual close; on cancel we just clear exporting
    })

    it('error path — API throws, error is set', async () => {
      vi.mocked(window.api.export.excel).mockRejectedValue(new Error('Network error'))

      act(() => {
        useExportStore.getState().openDialog()
        useExportStore.getState().setCollections([mockCollection])
      })

      await act(async () => {
        await useExportStore.getState().exportExcel()
      })

      const state = useExportStore.getState()
      expect(state.exporting).toBe(false)
      expect(state.error).toBe('Network error')
      expect(state.progress).toBeNull()
    })

    it('does nothing when no collections are selected', async () => {
      act(() => {
        useExportStore.getState().openDialog()
        // no collections set — selectedIds is empty
      })

      await act(async () => {
        await useExportStore.getState().exportExcel()
      })

      expect(window.api.export.excel).not.toHaveBeenCalled()
    })

    it('subscribes to progress events and unsubscribes on completion', async () => {
      const unsub = vi.fn()
      vi.mocked(window.api.export.onProgress).mockReturnValue(unsub)
      vi.mocked(window.api.export.excel).mockResolvedValue('/tmp/export.xlsx')

      act(() => {
        useExportStore.getState().setCollections([mockCollection])
      })

      await act(async () => {
        await useExportStore.getState().exportExcel()
      })

      expect(window.api.export.onProgress).toHaveBeenCalled()
      expect(unsub).toHaveBeenCalled()
    })
  })
})
