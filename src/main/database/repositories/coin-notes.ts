import { uuidv4 } from './uuid'
import { getDatabase } from '..'
import type { CoinNote, CreateCoinNoteInput, UpdateCoinNoteInput } from '@shared/types'

function toCoinNote(row: Record<string, unknown>): CoinNote {
  return {
    id: row.id as string,
    coinId: row.coin_id as string,
    title: (row.title as string) ?? null,
    content: row.content as string,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number
  }
}

export function listCoinNotes(coinId: string): CoinNote[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      'SELECT * FROM coin_notes WHERE coin_id = ? ORDER BY updated_at DESC'
    )
    .all(coinId) as Array<Record<string, unknown>>

  return rows.map(toCoinNote)
}

export function getCoinNote(id: string): CoinNote | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM coin_notes WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? toCoinNote(row) : undefined
}

export function createCoinNote(input: CreateCoinNoteInput): CoinNote {
  const db = getDatabase()
  const now = Date.now()
  const id = uuidv4()

  db.prepare(
    'INSERT INTO coin_notes (id, coin_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    input.coinId,
    input.title ?? null,
    input.content,
    now,
    now
  )

  return {
    id,
    coinId: input.coinId,
    title: input.title ?? null,
    content: input.content,
    createdAt: now,
    updatedAt: now
  }
}

export function updateCoinNote(input: UpdateCoinNoteInput): CoinNote | undefined {
  const existing = getCoinNote(input.id)
  if (!existing) return undefined

  const db = getDatabase()
  const now = Date.now()

  const title = input.title !== undefined ? input.title : existing.title
  const content = input.content !== undefined ? input.content : existing.content

  db.prepare(
    'UPDATE coin_notes SET title = ?, content = ?, updated_at = ? WHERE id = ?'
  ).run(title, content, now, input.id)

  return {
    ...existing,
    title,
    content,
    updatedAt: now
  }
}

export function deleteCoinNote(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM coin_notes WHERE id = ?').run(id)
  return result.changes > 0
}

export function countNotesByCoin(coinId: string): number {
  const db = getDatabase()
  const row = db.prepare('SELECT COUNT(*) as count FROM coin_notes WHERE coin_id = ?').get(coinId) as { count: number }
  return row.count
}
