import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LlmTools } from '@/features/coins/LlmTools'

const mockExportData = [
  {
    id: 'c1',
    country: 'Russia',
    denomination: '1 рубль',
    year: 1999,
    condition: 'UNC'
  },
  {
    id: 'c2',
    country: 'USA',
    denomination: '1 dollar',
    year: 1880,
    condition: 'VF'
  }
]

describe('LlmTools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(window.api.llm.getExportData).mockResolvedValue(mockExportData)
    vi.mocked(window.api.llm.exportAll).mockResolvedValue(null)
    vi.mocked(window.api.llm.importInfo).mockResolvedValue(null)
  })

  it('renders Export and Import buttons', async () => {
    render(<LlmTools collectionId="col1" />)

    expect(screen.getByText('Export for LLM')).toBeDefined()
    expect(screen.getByText('Import from LLM')).toBeDefined()
  })

  it('fetches export data on mount', async () => {
    render(<LlmTools collectionId="col1" />)

    await waitFor(() => {
      expect(window.api.llm.getExportData).toHaveBeenCalledWith('col1')
    })
  })

  it('shows prompt template when data is available', async () => {
    render(<LlmTools collectionId="col1" />)

    await waitFor(() => {
      expect(screen.getByText('LLM Prompt Template')).toBeDefined()
    })
  })

  it('shows prompt text containing coin data', async () => {
    render(<LlmTools collectionId="col1" />)

    // Expand the details element
    await waitFor(() => {
      const summary = screen.getByText('LLM Prompt Template')
      expect(summary).toBeDefined()
    })

    // The prompt text should contain the JSON data
    const pre = document.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre!.textContent).toContain('1 рубль')
    expect(pre!.textContent).toContain('1 dollar')
    expect(pre!.textContent).toContain('"id"')
    expect(pre!.textContent).toContain('"info"')
    expect(pre!.textContent).toContain('Example response format')
  })

  it('copy button copies prompt to clipboard', async () => {
    // Mock clipboard
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<LlmTools collectionId="col1" />)

    await waitFor(() => {
      expect(screen.getByText('LLM Prompt Template')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Copy prompt'))

    expect(writeText).toHaveBeenCalled()
    const copiedText = writeText.mock.calls[0][0]
    expect(copiedText).toContain('1 рубль')
    expect(copiedText).toContain('c1')
    expect(copiedText).toContain('Example response format')
  })

  it('shows "Copied!" after copy button is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<LlmTools collectionId="col1" />)

    await waitFor(() => {
      expect(screen.getByText('LLM Prompt Template')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Copy prompt'))

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeDefined()
    })
  })

  it('calls exportAll when Export button is clicked', async () => {
    vi.mocked(window.api.llm.exportAll).mockResolvedValue('/tmp/test.json')

    render(<LlmTools collectionId="col1" />)

    fireEvent.click(screen.getByText('Export for LLM'))

    await waitFor(() => {
      expect(window.api.llm.exportAll).toHaveBeenCalledWith('col1')
    })
  })

  it('shows filename after export', async () => {
    vi.mocked(window.api.llm.exportAll).mockResolvedValue('/tmp/test.json')

    render(<LlmTools collectionId="col1" />)

    fireEvent.click(screen.getByText('Export for LLM'))

    await waitFor(() => {
      expect(screen.getByText('test.json')).toBeDefined()
    })
  })

  it('calls importInfo and onImported when Import button is clicked', async () => {
    vi.mocked(window.api.llm.importInfo).mockResolvedValue({
      updated: 3,
      skipped: 1,
      filePath: '/tmp/result.json'
    })
    const onImported = vi.fn()

    render(<LlmTools collectionId="col1" onImported={onImported} />)

    fireEvent.click(screen.getByText('Import from LLM'))

    await waitFor(() => {
      expect(window.api.llm.importInfo).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(onImported).toHaveBeenCalledWith(3, 1)
    })
  })

  it('shows result after import', async () => {
    vi.mocked(window.api.llm.importInfo).mockResolvedValue({
      updated: 2,
      skipped: 0,
      filePath: '/tmp/result.json'
    })

    render(<LlmTools collectionId="col1" />)

    fireEvent.click(screen.getByText('Import from LLM'))

    await waitFor(() => {
      expect(screen.getByText('2 updated, 0 skipped')).toBeDefined()
    })
  })

  it('refetches export data when collectionId changes', async () => {
    const { rerender } = render(<LlmTools collectionId="col1" />)

    await waitFor(() => {
      expect(window.api.llm.getExportData).toHaveBeenCalledWith('col1')
    })

    vi.clearAllMocks()
    vi.mocked(window.api.llm.getExportData).mockResolvedValue(mockExportData)

    rerender(<LlmTools collectionId="col2" />)

    await waitFor(() => {
      expect(window.api.llm.getExportData).toHaveBeenCalledWith('col2')
    })
  })
})
