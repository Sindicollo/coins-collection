/**
 * Unit tests for src/renderer/features/notes/CoinNotesList.tsx — the AI
 * "query and save as note" flow.
 *
 * Covers the fix-ui change: `querySingle` now returns `LlmQueryResult`, so the
 * component must render `formatLlmError(...)` on `ok:false` instead of reading
 * fields off a bare result.
 *
 * Happy path: a successful response is written as a note.
 * Edge cases: structured per-query error; AI response with no usable fields.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CoinNotesList } from '@/features/notes/CoinNotesList'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(window.api.notes.list).mockResolvedValue([])
})

function renderList(): void {
  render(<CoinNotesList coinId="coin-1" onCountChange={vi.fn()} />)
}

describe('CoinNotesList AI query', () => {
  it('creates a note from a successful AI response', async () => {
    vi.mocked(window.api.llm.querySingle).mockResolvedValue({
      ok: true,
      data: { id: 'coin-1', info: 'Noble', price: '12.5', mintage: '500' }
    })

    renderList()
    fireEvent.click(await screen.findByText(/eBay price/))

    await waitFor(() => {
      expect(window.api.notes.create).toHaveBeenCalled()
    })
    const payload = vi.mocked(window.api.notes.create).mock.calls[0][0]
    expect(payload).toEqual(
      expect.objectContaining({
        coinId: 'coin-1',
        title: expect.any(String)
      })
    )
    // The note content is a joined string of the AI fields — not the raw
    // LlmQueryResult object
    expect(typeof payload.content).toBe('string')
    expect(payload.content).toContain('Noble')
    expect(payload.content).toContain('Price: 12.5')
    expect(payload.content).toContain('Mintage: 500')
  })

  it('shows a friendly localized error (and creates nothing) when the query fails', async () => {
    vi.mocked(window.api.llm.querySingle).mockResolvedValue({
      ok: false,
      error: {
        code: 'connection_refused',
        provider: 'lmstudio',
        baseUrl: 'http://localhost:1234/v1',
        model: 'qwen'
      }
    })

    renderList()
    fireEvent.click(await screen.findByText(/eBay price/))

    expect(await screen.findByText(/Cannot connect to LM Studio/)).toBeDefined()
    expect(window.api.notes.create).not.toHaveBeenCalled()
  })

  it('shows an empty-data hint when the AI returns no usable fields', async () => {
    vi.mocked(window.api.llm.querySingle).mockResolvedValue({
      ok: true,
      data: { id: 'coin-1' }
    })

    renderList()
    fireEvent.click(await screen.findByText(/eBay price/))

    expect(await screen.findByText(/AI returned no data/i)).toBeDefined()
    expect(window.api.notes.create).not.toHaveBeenCalled()
  })
})