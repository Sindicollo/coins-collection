import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ExportDialog } from '@/features/export/ExportDialog'
import { useExportStore } from '@/features/export/useExport'
import type { Collection } from '@shared/types'

const mockCollections: Collection[] = [
  { id: 'c1', name: 'Russia', createdAt: 1000, updatedAt: 1000 },
  { id: 'c2', name: 'USA', createdAt: 2000, updatedAt: 2000 }
]

describe('ExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset store
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

    // Mock window.api.collections.list
    window.api.collections.list = vi.fn().mockResolvedValue(mockCollections)
    window.api.export.excel = vi.fn().mockResolvedValue('/tmp/export.xlsx')
    window.api.export.onProgress = vi.fn(() => vi.fn())
  })

  it('renders nothing when dialog is closed', () => {
    const { container } = render(<ExportDialog />)
    // Modal renders empty fragment when closed
    expect(container.innerHTML).toBe('')
  })

  it('renders title and collections when dialog is open', async () => {
    act(() => {
      useExportStore.getState().openDialog()
    })

    render(<ExportDialog />)

    await waitFor(() => {
      expect(screen.getByText('Export to Excel')).toBeDefined()
    })

    await waitFor(() => {
      expect(screen.getByText('Russia')).toBeDefined()
      expect(screen.getByText('USA')).toBeDefined()
    })
  })

  it('shows empty state when no collections exist', async () => {
    window.api.collections.list = vi.fn().mockResolvedValue([])

    act(() => {
      useExportStore.getState().openDialog()
    })

    render(<ExportDialog />)

    await waitFor(() => {
      expect(screen.getByText('No collections found')).toBeDefined()
    })
  })

  it('shows Include images checkbox checked by default', async () => {
    act(() => {
      useExportStore.getState().openDialog()
    })

    render(<ExportDialog />)

    await waitFor(() => {
      const imgCheckbox = screen.getByText('Include images (base64, max 400px height)')
        .closest('label')
        ?.querySelector('input[type="checkbox"]') as HTMLInputElement
      expect(imgCheckbox).toBeDefined()
      expect(imgCheckbox.checked).toBe(true)
    })
  })

  it('shows Include sold coins checkbox unchecked by default', async () => {
    act(() => {
      useExportStore.getState().openDialog()
    })

    render(<ExportDialog />)

    await waitFor(() => {
      const soldCheckbox = screen.getByText('Include sold coins')
        .closest('label')
        ?.querySelector('input[type="checkbox"]') as HTMLInputElement
      expect(soldCheckbox).toBeDefined()
      expect(soldCheckbox.checked).toBe(false)
    })
  })

  it('calls exportExcel when Export button is clicked', async () => {
    const spy = vi.spyOn(useExportStore.getState(), 'exportExcel')

    act(() => {
      useExportStore.getState().openDialog()
      useExportStore.getState().setCollections(mockCollections)
    })

    render(<ExportDialog />)

    await waitFor(() => {
      const exportBtn = screen.getByText('Export')
      expect(exportBtn).toBeDefined()
      fireEvent.click(exportBtn)
    })

    expect(spy).toHaveBeenCalled()
  })

  it('disables Export button when no collections selected', async () => {
    act(() => {
      useExportStore.getState().openDialog()
      useExportStore.getState().setCollections(mockCollections)
      useExportStore.getState().deselectAll()
    })

    render(<ExportDialog />)

    await waitFor(() => {
      const exportBtn = screen.getByText('Export') as HTMLButtonElement
      expect(exportBtn.disabled).toBe(true)
    })
  })

  it('disables Cancel button while exporting', async () => {
    act(() => {
      useExportStore.getState().openDialog()
      useExportStore.getState().setCollections(mockCollections)
      useExportStore.getState().exporting = true
    })

    render(<ExportDialog />)

    await waitFor(() => {
      const cancelBtn = screen.getByText('Cancel') as HTMLButtonElement
      expect(cancelBtn.disabled).toBe(true)
    })
  })

  it('shows progress bar when progress is set', async () => {
    act(() => {
      useExportStore.getState().openDialog()
      useExportStore.setState({
        progress: { stage: 'Processing', current: 2, total: 10, message: '2/10 coins' }
      })
    })

    render(<ExportDialog />)

    await waitFor(() => {
      expect(screen.getByText('Processing')).toBeDefined()
      expect(screen.getByText('2/10 coins')).toBeDefined()
    })
  })

  it('shows error message when store has error', async () => {
    act(() => {
      useExportStore.getState().openDialog()
      useExportStore.setState({ error: 'Something went wrong' })
    })

    render(<ExportDialog />)

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeDefined()
    })
  })

  it('calls closeDialog when Cancel is clicked', async () => {
    const spy = vi.spyOn(useExportStore.getState(), 'closeDialog')

    act(() => {
      useExportStore.getState().openDialog()
    })

    render(<ExportDialog />)

    await waitFor(() => {
      const cancelBtn = screen.getByText('Cancel')
      fireEvent.click(cancelBtn)
    })

    expect(spy).toHaveBeenCalled()
  })

  it('renders Select all and Deselect all buttons', async () => {
    act(() => {
      useExportStore.getState().openDialog()
    })

    render(<ExportDialog />)

    await waitFor(() => {
      expect(screen.getByText('Select all')).toBeDefined()
      expect(screen.getByText('Deselect all')).toBeDefined()
    })
  })
})
