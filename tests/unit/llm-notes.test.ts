/**
 * Unit tests for src/main/llm/notes.ts — AI-note upsert (one note per query
 * type) and the hasAiNoteForQuery check, including legacy "AI Import" compat.
 *
 * The coin-notes repository is mocked.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCoinNote, updateCoinNote, listCoinNotes } from '../../src/main/database/repositories/coin-notes'
import { saveAiNote, hasAiNoteForQuery } from '../../src/main/llm/notes'
import type { CoinNote } from '@shared/types'

vi.mock('../../src/main/database/repositories/coin-notes', () => ({
  createCoinNote: vi.fn(),
  updateCoinNote: vi.fn(),
  listCoinNotes: vi.fn()
}))

const mockList = vi.mocked(listCoinNotes)
const mockCreate = vi.mocked(createCoinNote)
const mockUpdate = vi.mocked(updateCoinNote)

function makeNote(partial: Partial<CoinNote>): CoinNote {
  return {
    id: 'note-1',
    coinId: 'coin-1',
    title: 'AI: info',
    content: 'old',
    createdAt: 1,
    updatedAt: 1,
    ...partial
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockList.mockReturnValue([])
})

describe('saveAiNote', () => {
  it('creates a note titled "AI: <queryType>" when none exists', () => {
    saveAiNote('coin-1', 'prices', 'Price: 10-20 $')

    expect(mockCreate).toHaveBeenCalledWith({
      coinId: 'coin-1',
      title: 'AI: prices',
      content: 'Price: 10-20 $'
    })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('updates the existing note with the same title instead of duplicating', () => {
    mockList.mockReturnValue([makeNote({ id: 'note-9', title: 'AI: prices' })])

    saveAiNote('coin-1', 'prices', 'new content')

    expect(mockUpdate).toHaveBeenCalledWith({ id: 'note-9', content: 'new content' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('treats a legacy "AI Import" note as the info query type', () => {
    mockList.mockReturnValue([makeNote({ id: 'legacy-1', title: 'AI Import' })])

    saveAiNote('coin-1', 'info', 'new info')

    expect(mockUpdate).toHaveBeenCalledWith({ id: 'legacy-1', content: 'new info' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('does not reuse a legacy "AI Import" note for a non-info query type', () => {
    mockList.mockReturnValue([makeNote({ id: 'legacy-1', title: 'AI Import' })])

    saveAiNote('coin-1', 'mintage', 'Mintage: 5M')

    expect(mockCreate).toHaveBeenCalledWith({
      coinId: 'coin-1',
      title: 'AI: mintage',
      content: 'Mintage: 5M'
    })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('keeps one note per query type (info vs prices are independent)', () => {
    mockList.mockReturnValue([makeNote({ id: 'info-note', title: 'AI: info' })])

    saveAiNote('coin-1', 'prices', 'Price: 5 $')

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'AI: prices', coinId: 'coin-1' })
    )
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('hasAiNoteForQuery', () => {
  it('returns true when a matching "AI: <type>" note exists', () => {
    mockList.mockReturnValue([makeNote({ title: 'AI: info' })])

    expect(hasAiNoteForQuery('coin-1', 'info')).toBe(true)
  })

  it('returns true for a legacy "AI Import" note when checking info', () => {
    mockList.mockReturnValue([makeNote({ title: 'AI Import' })])

    expect(hasAiNoteForQuery('coin-1', 'info')).toBe(true)
  })

  it('returns false when only unrelated notes exist', () => {
    mockList.mockReturnValue([
      makeNote({ title: 'AI: info' }),
      makeNote({ title: 'Manual note', id: 'm1' })
    ])

    expect(hasAiNoteForQuery('coin-1', 'prices')).toBe(false)
    expect(hasAiNoteForQuery('coin-1', 'mintage')).toBe(false)
  })

  it('returns false when the coin has no notes', () => {
    expect(hasAiNoteForQuery('coin-1', 'info')).toBe(false)
  })
})
