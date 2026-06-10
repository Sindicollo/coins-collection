import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ExportPdfDialog } from '@/features/export-pdf/ExportPdfDialog'
import { useExportPdfStore } from '@/features/export-pdf/useExportPdf'
import type { Collection } from '@shared/types'

const mockCollections: Collection[] = [
  { id: 'c1', name: 'Russia', createdAt: 1000, updatedAt: 1000 },
  { id: 'c2', name: 'USA', createdAt: 2000, updatedAt: 2000 }
]

describe('ExportPdfDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset store
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

    // Mock APIs
    window.api.collections.list = vi.fn().mockResolvedValue(mockCollections)
    window.api.export.pdf = vi.fn().mockResolvedValue('/tmp/export.pdf')
    window.api.export.onProgress = vi.fn(() => vi.fn())
  })

  // ── Rendering ────────────────────────────────────────────
  it('renders nothing when dialog is closed', () => {
    const { container } = render(<ExportPdfDialog />)
    expect(container.innerHTML).toBe('')
  })

  it('renders title and collections when dialog is open', async () => {
    act(() => { useExportPdfStore.getState().openDialog() })
    render(<ExportPdfDialog />)

    await waitFor(() => {
      expect(screen.getByText('Export to PDF')).toBeDefined()
    })
    await waitFor(() => {
      expect(screen.getByText('Russia')).toBeDefined()
      expect(screen.getByText('USA')).toBeDefined()
    })
  })

  it('shows empty state when no collections exist', async () => {
    window.api.collections.list = vi.fn().mockResolvedValue([])
    act(() => { useExportPdfStore.getState().openDialog() })
    render(<ExportPdfDialog />)

    await waitFor(() => {
      expect(screen.getByText('No collections found')).toBeDefined()
    })
  })

  // ── Checkboxes / radios ─────────────────────────────────
  it('shows Include photos checkbox checked by default', async () => {
    act(() => { useExportPdfStore.getState().openDialog() })
    render(<ExportPdfDialog />)

    await waitFor(() => {
      const cb = screen.getByText('Include photos')
        .closest('label')
        ?.querySelector('input[type="checkbox"]') as HTMLInputElement
      expect(cb).toBeDefined()
      expect(cb.checked).toBe(true)
    })
  })

  it('shows Include sold coins checkbox unchecked by default', async () => {
    act(() => { useExportPdfStore.getState().openDialog() })
    render(<ExportPdfDialog />)

    await waitFor(() => {
      const cb = screen.getByText('Include sold coins')
        .closest('label')
        ?.querySelector('input[type="checkbox"]') as HTMLInputElement
      expect(cb).toBeDefined()
      expect(cb.checked).toBe(false)
    })
  })

  it('shows purchase info radio grouped with default "Without purchase info"', async () => {
    act(() => { useExportPdfStore.getState().openDialog() })
    render(<ExportPdfDialog />)

    await waitFor(() => {
      const without = screen.getByText(
        'Without purchase info (denomination, year, country, condition, notes)'
      )
      const withInfo = screen.getByText(
        'With purchase info (add price, date, place in gray text)'
      )
      expect(without).toBeDefined()
      expect(withInfo).toBeDefined()

      // "Without" radio should be checked by default
      const radioWithout = without.closest('label')
        ?.querySelector('input[type="radio"]') as HTMLInputElement
      expect(radioWithout.checked).toBe(true)

      const radioWith = withInfo.closest('label')
        ?.querySelector('input[type="radio"]') as HTMLInputElement
      expect(radioWith.checked).toBe(false)
    })
  })

  // ── Actions ──────────────────────────────────────────────
  it('calls exportPdf when Export PDF button is clicked', async () => {
    const spy = vi.spyOn(useExportPdfStore.getState(), 'exportPdf')

    act(() => {
      useExportPdfStore.getState().openDialog()
      useExportPdfStore.getState().setCollections(mockCollections)
    })
    render(<ExportPdfDialog />)

    await waitFor(() => {
      const btn = screen.getByText('Export PDF')
      expect(btn).toBeDefined()
      fireEvent.click(btn)
    })

    expect(spy).toHaveBeenCalled()
  })

  it('disables Export button when no collections selected', async () => {
    act(() => {
      useExportPdfStore.getState().openDialog()
      useExportPdfStore.getState().setCollections(mockCollections)
      useExportPdfStore.getState().deselectAll()
    })
    render(<ExportPdfDialog />)

    await waitFor(() => {
      const btn = screen.getByText('Export PDF') as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })
  })

  it('disables Cancel button while exporting', async () => {
    act(() => {
      useExportPdfStore.getState().openDialog()
      useExportPdfStore.getState().setCollections(mockCollections)
      useExportPdfStore.setState({ exporting: true })
    })
    render(<ExportPdfDialog />)

    await waitFor(() => {
      const btn = screen.getByText('Cancel') as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })
  })

  it('shows progress bar when progress is set', async () => {
    act(() => {
      useExportPdfStore.getState().openDialog()
      useExportPdfStore.setState({
        progress: { stage: 'Generating', current: 2, total: 10, message: '2/10 coins' }
      })
    })
    render(<ExportPdfDialog />)

    await waitFor(() => {
      expect(screen.getByText('Generating')).toBeDefined()
      expect(screen.getByText('2/10 coins')).toBeDefined()
    })
  })

  it('shows error message when store has error', async () => {
    act(() => {
      useExportPdfStore.getState().openDialog()
      useExportPdfStore.setState({ error: 'Disk full' })
    })
    render(<ExportPdfDialog />)

    await waitFor(() => {
      expect(screen.getByText('Disk full')).toBeDefined()
    })
  })

  it('calls closeDialog when Cancel is clicked', async () => {
    const spy = vi.spyOn(useExportPdfStore.getState(), 'closeDialog')

    act(() => { useExportPdfStore.getState().openDialog() })
    render(<ExportPdfDialog />)

    await waitFor(() => {
      const btn = screen.getByText('Cancel')
      fireEvent.click(btn)
    })

    expect(spy).toHaveBeenCalled()
  })

  it('renders Select all and Deselect all buttons', async () => {
    act(() => { useExportPdfStore.getState().openDialog() })
    render(<ExportPdfDialog />)

    await waitFor(() => {
      expect(screen.getByText('Select all')).toBeDefined()
      expect(screen.getByText('Deselect all')).toBeDefined()
    })
  })
})
