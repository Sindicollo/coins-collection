/**
 * AI note helpers for persisting LLM-generated content.
 *
 * Uses the `AI: ` title prefix to distinguish AI-generated notes
 * from user-created ones. For backward compat, legacy `AI Import`
 * notes are treated as `info` query type.
 */

import { createCoinNote, updateCoinNote, listCoinNotes } from '../database/repositories/coin-notes'
import { AI_NOTE_TITLE_PREFIX } from '@shared/types'
import type { QueryType } from '@shared/types'

function titleForQuery(queryType: QueryType): string {
  return `${AI_NOTE_TITLE_PREFIX}${queryType}`
}

/**
 * Save or update an AI-generated note for a coin.
 * If a note with the same query type already exists, updates it.
 */
export function saveAiNote(coinId: string, queryType: QueryType, content: string): void {
  const title = titleForQuery(queryType)
  const existing = listCoinNotes(coinId).find(
    (n) => n.title === title || (queryType === 'info' && n.title === 'AI Import')
  )

  if (existing) {
    updateCoinNote({ id: existing.id, content })
  } else {
    createCoinNote({ coinId, title, content })
  }
}

/**
 * Check if a coin already has an AI-generated note for the given query type.
 *
 * Backward compat: `AI Import` notes are treated as `info` type.
 */
export function hasAiNoteForQuery(coinId: string, queryType: QueryType): boolean {
  const notes = listCoinNotes(coinId)
  const expectedTitle = titleForQuery(queryType)

  return notes.some((n) => {
    if (n.title === expectedTitle) return true
    // Legacy compat: 'AI Import' = info
    if (queryType === 'info' && n.title === 'AI Import') return true
    return false
  })
}
