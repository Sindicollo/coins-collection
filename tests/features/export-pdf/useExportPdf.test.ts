import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useExportPdfStore } from '@/features/export-pdf/useExportPdf'

const mockCollection = { id: 'c1', name: 'Russia', createdAt: 1000, updatedAt: 1000 }

describe('useExportPdfStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    act(() => {
      useExportPdfStore.setState({
        open: false,
        collections: [],
        selectedIds: [],
        includeSold: false,
        includeImages: true,
        includePurchaseInfo: false,
        progress: null,
        exporting: false,
        error: null
      })
    })
  })

  // ── Dialog open/close ───────────────────────────────────
  describe('openDialog', () => {
    it('sets open to true and resets error/progress', () => {
      act(() => {
        useExportPdfStore.getState().openDialog()
      })
      const s = useExportPdfStore.getState()
      expect(s.open).toBe(true)
      expect(s.error).toBeNull()
      expect(s.progress).toBeNull()
      expect(s.exporting).toBe(false)
    })
  })

  describe('closeDialog', () => {
    it('resets to initial state when not exporting', () => {
      act(() => {
        useExportPdfStore.getState().openDialog()
        useExportPdfStore.getState().setCollections([mockCollection])
      })
      act(() => {
        useExportPdfStore.getState().closeDialog()
      })
      const s = useExportPdfStore.getState()
      expect(s.open).toBe(false)
      expect(s.collections).toEqual([])
      expect(s.selectedIds).toEqual([])
    })

    it('does nothing while exporting', () => {
      act(() => {
        useExportPdfStore.setState({ open: true, exporting: true })
      })
      act(() => {
        useExportPdfStore.getState().closeDialog()
      })
      expect(useExportPdfStore.getState().open).toBe(true)
    })
  })

  // ── Collection selection ────────────────────────────────
  describe('setCollections', () => {
    it('sets collections and selects all by default', () => {
      const cols = [
        { id: 'c1', name: 'Russia', createdAt: 1000, updatedAt: 1000 },
        { id: 'c2', name: 'USA', createdAt: 2000, updatedAt: 2000 }
      ]
      act(() => { useExportPdfStore.getState().setCollections(cols) })
      const s = useExportPdfStore.getState()
      expect(s.collections).toEqual(cols)
      expect(s.selectedIds).toEqual(['c1', 'c2'])
    })
  })

  describe('toggleCollection / selectAll / deselectAll', () => {
    it('toggles a single collection on and off', () => {
      act(() => { useExportPdfStore.getState().setCollections([mockCollection]) })
      act(() => { useExportPdfStore.getState().toggleCollection('c1') })
      expect(useExportPdfStore.getState().selectedIds).toEqual([])
      act(() => { useExportPdfStore.getState().toggleCollection('c1') })
      expect(useExportPdfStore.getState().selectedIds).toEqual(['c1'])
    })

    it('selectAll selects all, deselectAll clears', () => {
      act(() => {
        useExportPdfStore.getState().setCollections([
          mockCollection,
          { id: 'c2', name: 'USA', createdAt: 2000, updatedAt: 2000 }
        ])
      })
      act(() => { useExportPdfStore.getState().deselectAll() })
      expect(useExportPdfStore.getState().selectedIds).toEqual([])
      act(() => { useExportPdfStore.getState().selectAll() })
      expect(useExportPdfStore.getState().selectedIds).toEqual(['c1', 'c2'])
    })
  })

  // ── Toggles ─────────────────────────────────────────────
  describe('toggle booleans', () => {
    it('setIncludeSold updates includeSold', () => {
      act(() => { useExportPdfStore.getState().setIncludeSold(true) })
      expect(useExportPdfStore.getState().includeSold).toBe(true)
    })

    it('setIncludeImages updates includeImages', () => {
      act(() => { useExportPdfStore.getState().setIncludeImages(false) })
      expect(useExportPdfStore.getState().includeImages).toBe(false)
    })

    it('setIncludePurchaseInfo updates includePurchaseInfo', () => {
      expect(useExportPdfStore.getState().includePurchaseInfo).toBe(false)
      act(() => { useExportPdfStore.getState().setIncludePurchaseInfo(true) })
      expect(useExportPdfStore.getState().includePurchaseInfo).toBe(true)
    })
  })

  // ── setProgress ─────────────────────────────────────────
  describe('setProgress', () => {
    it('sets progress state', () => {
      const p = { stage: 'Exporting', current: 5, total: 10, message: '5/10' }
      act(() => { useExportPdfStore.getState().setProgress(p) })
      expect(useExportPdfStore.getState().progress).toEqual(p)
    })
  })

  // ── exportPdf ───────────────────────────────────────────
  describe('exportPdf', () => {
    it('happy path — export succeeds, dialog closes', async () => {
      vi.mocked(window.api.export.pdf).mockResolvedValue('/tmp/export.pdf')
      vi.mocked(window.api.export.onProgress).mockImplementation((cb) => {
        cb({ stage: 'Processing', current: 1, total: 3, message: '1/3' })
        return vi.fn()
      })

      act(() => {
        useExportPdfStore.getState().openDialog()
        useExportPdfStore.getState().setCollections([mockCollection])
      })

      await act(async () => {
        await useExportPdfStore.getState().exportPdf()
      })

      const s = useExportPdfStore.getState()
      expect(s.exporting).toBe(false)
      expect(s.open).toBe(false)
      expect(s.error).toBeNull()
      expect(s.progress).toBeNull()
    })

    it('edge case — API returns null (cancelled), exporting stops', async () => {
      vi.mocked(window.api.export.pdf).mockResolvedValue(null)

      act(() => {
        useExportPdfStore.getState().openDialog()
        useExportPdfStore.getState().setCollections([mockCollection])
      })

      await act(async () => {
        await useExportPdfStore.getState().exportPdf()
      })

      const s = useExportPdfStore.getState()
      expect(s.exporting).toBe(false)
      expect(s.error).toBeNull()
      // dialog stays open on cancel
      expect(s.open).toBe(true)
    })

    it('edge case — API throws, error is set', async () => {
      vi.mocked(window.api.export.pdf).mockRejectedValue(new Error('Export failed'))

      act(() => {
        useExportPdfStore.getState().openDialog()
        useExportPdfStore.getState().setCollections([mockCollection])
      })

      await act(async () => {
        await useExportPdfStore.getState().exportPdf()
      })

      const s = useExportPdfStore.getState()
      expect(s.exporting).toBe(false)
      expect(s.error).toBe('Export failed')
      expect(s.progress).toBeNull()
    })

    it('does nothing when no collections selected', async () => {
      await act(async () => {
        await useExportPdfStore.getState().exportPdf()
      })
      expect(window.api.export.pdf).not.toHaveBeenCalled()
    })
  })
})
