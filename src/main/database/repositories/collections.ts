import { uuidv4 } from './uuid'
import { getDatabase } from '..'
import type { Collection, CreateCollectionInput, UpdateCollectionInput } from '@shared/types'

interface CollectionRow {
  id: string
  name: string
  created_at: number
  updated_at: number
}

function toCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listCollections(): Collection[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM collections ORDER BY name').all() as CollectionRow[]
  return rows.map(toCollection)
}

export function getCollection(id: string): Collection | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as CollectionRow | undefined
  return row ? toCollection(row) : undefined
}

export function createCollection(input: CreateCollectionInput): Collection {
  const db = getDatabase()
  const now = Date.now()
  const collection: Collection = {
    id: uuidv4(),
    name: input.name,
    createdAt: now,
    updatedAt: now
  }
  db.prepare('INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    collection.id,
    collection.name,
    collection.createdAt,
    collection.updatedAt
  )
  return collection
}

export function updateCollection(input: UpdateCollectionInput): Collection | undefined {
  const db = getDatabase()
  const existing = getCollection(input.id)
  if (!existing) return undefined

  const now = Date.now()
  db.prepare('UPDATE collections SET name = ?, updated_at = ? WHERE id = ?').run(
    input.name,
    now,
    input.id
  )
  return { ...existing, name: input.name, updatedAt: now }
}

export function deleteCollection(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM collections WHERE id = ?').run(id)
  return result.changes > 0
}
