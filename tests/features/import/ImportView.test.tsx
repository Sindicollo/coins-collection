import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ImportView } from '@/features/import/ImportView'

const mockPreview = {
  filePath: '/tmp/test.xlsx',
  sheets: [
    {
      name: 'Russia',
      coinCount: 3,
      photoCount: 1,
      embeddedPhotoCount: 2,
      sampleRows: [
        {
          year: 1990,
          denomination: '10 рублей',
          price: 500,
          shippingCost: 50,
          purchaseDate: null,
          purchasePlace: 'eBay',
          notes: 'Nice coin',
          photoUrls: [],
          embeddedImages: [{ rowIndex: 0, colIndex: 5, imagePath: 'photo.png' }]
        }
      ]
    }
  ]
}

const mockResult = {
  collectionsCreated: 1,
  collectionsSkipped: 0,
  coinsCreated: 3,
  photosImported: 2,
  errors: []
}

describe('ImportView', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(window.api.import.selectFile).mockResolvedValue('/tmp/test.xlsx')
    vi.mocked(window.api.import.preview).mockResolvedValue(mockPreview)
    vi.mocked(window.api.import.execute).mockResolvedValue(mockResult)
    vi.mocked(window.api.import.executeNoYear).mockResolvedValue(mockResult)
  })

  // --- Happy path: full flow ---

  it('renders select step when open', () => {
    render(<ImportView {...defaultProps} />)

    expect(screen.getByText('import.title')).toBeInTheDocument()
    expect(screen.getByText('import.selectHint')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('import.selectFile')).toBeInTheDocument()
  })

  it('transitions through select → preview → importing → done', async () => {
    vi.mocked(window.api.import.execute).mockImplementationOnce(async () => {
      // Small delay so the importing state is observable
      await new Promise((r) => setTimeout(r, 10))
      return mockResult
    })

    render(<ImportView {...defaultProps} />)

    // Step 1: Select
    await act(async () => {
      fireEvent.click(screen.getByText('import.selectFile'))
    })

    // Step 2: Preview
    expect(screen.getByText('import.previewHint')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Russia')).toBeInTheDocument()

    // Step 3: Start import
    act(() => {
      fireEvent.click(screen.getByText('import.start'))
    })

    // Show importing spinner (before the delay resolves)
    expect(screen.getByText('import.importing')).toBeInTheDocument()

    // Wait for import to complete
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    // Step 4: Done (spinner is gone)
    expect(screen.queryByText('import.importing')).not.toBeInTheDocument()
    expect(screen.getByText('import.complete')).toBeInTheDocument()
    expect(screen.getByText(/collectionsCreated.*1/)).toBeInTheDocument()
    expect(screen.getByText(/coinsCreated.*3/)).toBeInTheDocument()
  })

  // --- Edge case: cancel during select step ---

  it('calls onClose when Cancel is clicked on select step', () => {
    const onClose = vi.fn()
    render(<ImportView {...defaultProps} onClose={onClose} />)

    fireEvent.click(screen.getByText('Cancel'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // --- Edge case: import failure returns to preview ---

  it('returns to preview step when import fails', async () => {
    vi.mocked(window.api.import.execute).mockRejectedValue(new Error('Parse error'))

    render(<ImportView {...defaultProps} />)

    // Go to preview
    await act(async () => {
      fireEvent.click(screen.getByText('import.selectFile'))
    })

    // Start import (will fail)
    await act(async () => {
      fireEvent.click(screen.getByText('import.start'))
    })

    // Should be back on preview with error
    expect(screen.getByText('import.previewHint')).toBeInTheDocument()
    expect(screen.getByText('Parse error')).toBeInTheDocument()
  })

  // --- Edge case: import with executeNoYear ---

  it('calls executeNoYear when import with no year button is clicked', async () => {
    render(<ImportView {...defaultProps} />)

    await act(async () => {
      fireEvent.click(screen.getByText('import.selectFile'))
    })

    await act(async () => {
      fireEvent.click(screen.getByText('import.importNoYear'))
    })

    // Done step
    expect(screen.getByText('import.complete')).toBeInTheDocument()
    expect(vi.mocked(window.api.import.execute)).not.toHaveBeenCalled()
    expect(vi.mocked(window.api.import.executeNoYear)).toHaveBeenCalledWith({
      filePath: '/tmp/test.xlsx',
      collectionOverrides: {},
      downloadPhotos: true
    })
  })

  // --- Edge case: select file returns no path ---

  it('stays on select step when file selection is cancelled', async () => {
    vi.mocked(window.api.import.selectFile).mockResolvedValue(null)

    render(<ImportView {...defaultProps} />)

    await act(async () => {
      fireEvent.click(screen.getByText('import.selectFile'))
    })

    // Still on select step
    expect(screen.getByText('import.selectHint')).toBeInTheDocument()
  })

  // --- Edge case: preview step shows collection name input ---

  it('allows overriding collection names on preview step', async () => {
    render(<ImportView {...defaultProps} />)

    await act(async () => {
      fireEvent.click(screen.getByText('import.selectFile'))
    })

    const input = screen.getByDisplayValue('Russia') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'USSR' } })

    expect(input.value).toBe('USSR')
  })

  // --- Edge case: import with errors in result ---

  it('shows import errors when result contains errors', async () => {
    vi.mocked(window.api.import.execute).mockResolvedValue({
      ...mockResult,
      errors: ['Row 5: invalid year format', 'Row 12: missing denomination']
    })

    render(<ImportView {...defaultProps} />)

    await act(async () => {
      fireEvent.click(screen.getByText('import.selectFile'))
    })

    await act(async () => {
      fireEvent.click(screen.getByText('import.start'))
    })

    expect(screen.getByText(/Row 5/)).toBeInTheDocument()
    expect(screen.getByText(/Row 12/)).toBeInTheDocument()
  })
})
