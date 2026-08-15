/**
 * Tests for useAiStore — appendCoinToNotes (AI result → coin_notes table)
 * and queryType stamping on results.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAiStore } from '@/features/ai/useAiStore'
import type { CoinNote } from '@shared/types'

function makeNote(partial: Partial<CoinNote>): CoinNote {
  return {
    id: 'note-1',
    coinId: 'coin-1',
    title: null,
    content: 'old content',
    createdAt: 1,
    updatedAt: 1,
    ...partial
  }
}

describe('useAiStore.appendCoinToNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAiStore.setState({
      results: {},
      error: null,
      lastQueryType: null
    })
  })

  it('creates a new note titled "AI: <queryType>" when none exists', async () => {
    useAiStore.setState({
      results: {
        'coin-1': { id: 'coin-1', info: 'KM# 190. Silver 0.900', price: '10-20 $', queryType: 'info' }
      }
    })
    vi.mocked(window.api.notes.list).mockResolvedValue([])
    vi.mocked(window.api.notes.create).mockResolvedValue(makeNote({ title: 'AI: info' }))

    const ok = await useAiStore.getState().appendCoinToNotes('coin-1')

    expect(ok).toBe(true)
    expect(window.api.notes.create).toHaveBeenCalledWith({
      coinId: 'coin-1',
      title: 'AI: info',
      content: 'KM# 190. Silver 0.900\nPrice: 10-20 $'
    })
    expect(window.api.notes.update).not.toHaveBeenCalled()
  })

  it('updates the existing AI note for the same query type instead of duplicating', async () => {
    useAiStore.setState({
      results: { 'coin-1': { id: 'coin-1', price: '30-50 $', queryType: 'prices' } }
    })
    const existing = makeNote({ id: 'note-9', title: 'AI: prices' })
    vi.mocked(window.api.notes.list).mockResolvedValue([existing])
    vi.mocked(window.api.notes.update).mockResolvedValue({ ...existing, content: 'Price: 30-50 $' })

    const ok = await useAiStore.getState().appendCoinToNotes('coin-1')

    expect(ok).toBe(true)
    expect(window.api.notes.update).toHaveBeenCalledWith({
      id: 'note-9',
      content: 'Price: 30-50 $'
    })
    expect(window.api.notes.create).not.toHaveBeenCalled()
  })

  it('treats a legacy "AI Import" note as the info query type', async () => {
    useAiStore.setState({
      results: { 'coin-1': { id: 'coin-1', info: 'new info', queryType: 'info' } }
    })
    const legacy = makeNote({ id: 'note-legacy', title: 'AI Import' })
    vi.mocked(window.api.notes.list).mockResolvedValue([legacy])
    vi.mocked(window.api.notes.update).mockResolvedValue({ ...legacy, content: 'new info' })

    const ok = await useAiStore.getState().appendCoinToNotes('coin-1')

    expect(ok).toBe(true)
    expect(window.api.notes.update).toHaveBeenCalledWith({ id: 'note-legacy', content: 'new info' })
  })

  it('falls back to "AI: info" when the result has no stamped queryType', async () => {
    useAiStore.setState({
      results: { 'coin-1': { id: 'coin-1', info: 'manual paste' } }
    })
    vi.mocked(window.api.notes.list).mockResolvedValue([])
    vi.mocked(window.api.notes.create).mockResolvedValue(makeNote({ title: 'AI: info' }))

    const ok = await useAiStore.getState().appendCoinToNotes('coin-1')

    expect(ok).toBe(true)
    expect(window.api.notes.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'AI: info' })
    )
  })

  it('returns false when there is no result for the coin', async () => {
    const ok = await useAiStore.getState().appendCoinToNotes('missing-coin')

    expect(ok).toBe(false)
    expect(window.api.notes.list).not.toHaveBeenCalled()
  })

  it('returns false when the notes API fails', async () => {
    useAiStore.setState({
      results: { 'coin-1': { id: 'coin-1', info: 'text', queryType: 'info' } }
    })
    vi.mocked(window.api.notes.list).mockRejectedValue(new Error('db is locked'))

    const ok = await useAiStore.getState().appendCoinToNotes('coin-1')

    expect(ok).toBe(false)
  })
})

describe('useAiStore.querySingle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAiStore.setState({ results: {}, coinLoading: {}, error: null })
  })

  it('stamps the queryType onto the stored result', async () => {
    vi.mocked(window.api.llm.querySingle).mockResolvedValue({
      id: 'coin-1',
      info: 'Some info'
    })

    const result = await useAiStore.getState().querySingle('coin-1', 'mintage')

    expect(result).not.toBeNull()
    expect(useAiStore.getState().results['coin-1']).toEqual({
      id: 'coin-1',
      info: 'Some info',
      queryType: 'mintage'
    })
  })
})
