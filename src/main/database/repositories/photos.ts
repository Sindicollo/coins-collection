import { uuidv4 } from './uuid'
import { getDatabase } from '..'
import type { Photo, CreatePhotoInput } from '@shared/types'

interface PhotoRow {
  id: string
  coin_id: string
  filename: string
  original_name: string | null
  position: number
  created_at: number
}

function toPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    coinId: row.coin_id,
    filename: row.filename,
    originalName: row.original_name,
    position: row.position,
    createdAt: row.created_at
  }
}

export function listPhotos(coinId: string): Photo[] {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM photos WHERE coin_id = ? ORDER BY position')
    .all(coinId) as PhotoRow[]
  return rows.map(toPhoto)
}

export function getPhotoPath(id: string): string | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT filename FROM photos WHERE id = ?').get(id) as
    | { filename: string }
    | undefined
  return row?.filename
}

export function createPhoto(input: CreatePhotoInput): Photo {
  const db = getDatabase()
  const now = Date.now()
  const position = input.position ?? getNextPosition(input.coinId)
  const photo: Photo = {
    id: uuidv4(),
    coinId: input.coinId,
    filename: input.filename,
    originalName: input.originalName ?? null,
    position,
    createdAt: now
  }

  db.prepare(
    'INSERT INTO photos (id, coin_id, filename, original_name, position, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(photo.id, photo.coinId, photo.filename, photo.originalName, photo.position, photo.createdAt)

  return photo
}

export function deletePhoto(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM photos WHERE id = ?').run(id)
  return result.changes > 0
}

export function reorderPhotos(_coinId: string, photoIds: string[]): void {
  const db = getDatabase()
  const updateStmt = db.prepare('UPDATE photos SET position = ? WHERE id = ?')

  db.transaction(() => {
    photoIds.forEach((id, index) => {
      updateStmt.run(index, id)
    })
  })()
}

function getNextPosition(coinId: string): number {
  const db = getDatabase()
  const row = db
    .prepare('SELECT MAX(position) as max_pos FROM photos WHERE coin_id = ?')
    .get(coinId) as { max_pos: number | null }
  return (row.max_pos ?? -1) + 1
}
