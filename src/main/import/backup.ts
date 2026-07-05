import { join } from 'path'
import { existsSync, copyFileSync, statSync, rmSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import AdmZip from 'adm-zip'
import { getDatabase, createDatabaseAt } from '../database'
import { getLocalStats } from '../database/repositories/export'
import type Database from 'better-sqlite3'
import type { BackupManifest, BackupPreview, ImportResult } from '@shared/types'
import { uuidv4 } from '../database/repositories/uuid'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ImportOptions {
  /** Override the photos destination directory. Defaults to app.getPath('userData')/photos. */
  photosDir?: string
  /** Override the database path to import into. Creates the DB if it doesn't exist. */
  dbPath?: string
  /** Override the temp directory for extraction. Defaults to OS tmpdir. */
  tmpBaseDir?: string
  onProgress?: (stage: string, current: number, total: number, message: string) => void
}

// ---------------------------------------------------------------------------
// Backup JSON shapes
// ---------------------------------------------------------------------------

interface BackupCollection {
  id: string; name: string; createdAt: number; updatedAt: number
}

interface BackupCoin {
  id: string; collectionId: string; denomination: string
  year: number | null; condition: string | null
  purchaseDate: number | null; purchasePlace: string | null
  price: number | null; shippingCost: number | null
  currency: string | null; country: string | null
  extraData: string | null; composition: string | null
  sold: boolean; createdAt: number; updatedAt: number
  onAuction?: boolean; auctionPrice?: number | null; salePrice?: number | null
  /** @deprecated legacy field from old backups — written to dead column */
  notes?: string | null
}

interface BackupNote {
  id: string; coinId: string; title: string | null
  content: string; createdAt: number; updatedAt: number
}

interface BackupPhoto {
  id: string; coinId: string; filename: string
  originalName: string | null; position: number; createdAt: number
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function getDefaultPhotosDir(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron')
  return join(app.getPath('userData'), 'photos')
}

function getDb(options?: ImportOptions): { db: Database.Database; closeDb: boolean } {
  if (options?.dbPath) {
    return { db: createDatabaseAt(options.dbPath), closeDb: true }
  }
  return { db: getDatabase(), closeDb: false }
}

/** Read and parse all JSON files from the extracted backup directory. */
function readBackupData(tmpDir: string): { collections: BackupCollection[]; coins: BackupCoin[]; photos: BackupPhoto[]; notes: BackupNote[] } {
  const collections: BackupCollection[] = JSON.parse(
    readFileSync(join(tmpDir, 'collections.json'), 'utf-8')
  )
  const coins: BackupCoin[] = JSON.parse(
    readFileSync(join(tmpDir, 'coins.json'), 'utf-8')
  )
  const photos: BackupPhoto[] = JSON.parse(
    readFileSync(join(tmpDir, 'photos.json'), 'utf-8')
  )
  // notes.json may not exist in older backups
  let notes: BackupNote[] = []
  const notesPath = join(tmpDir, 'notes.json')
  if (existsSync(notesPath)) {
    notes = JSON.parse(readFileSync(notesPath, 'utf-8'))
  }
  return { collections, coins, photos, notes }
}

// ---------------------------------------------------------------------------
// Merge-import for each entity type
// ---------------------------------------------------------------------------

function importCollections(
  db: Database.Database,
  collections: BackupCollection[],
  result: ImportResult,
  onProgress: ImportOptions['onProgress']
): void {
  let processed = 0
  onProgress?.('importing-collections', 0, collections.length, 'Importing collections...')

  const insert = db.prepare(
    'INSERT OR IGNORE INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
  )
  const update = db.prepare(
    'UPDATE collections SET name = ?, updated_at = ? WHERE id = ?'
  )

  db.transaction(() => {
    for (const col of collections) {
      const existing = db.prepare('SELECT id FROM collections WHERE id = ?').get(col.id) as { id: string } | undefined
      if (existing) {
        update.run(col.name, col.updatedAt, col.id)
        result.updated.collections++
      } else {
        insert.run(col.id, col.name, col.createdAt, col.updatedAt)
        result.imported.collections++
      }
      processed++
    }
  })()

  onProgress?.('importing-collections', processed, collections.length, 'Collections done.')
}

function importCoins(
  db: Database.Database,
  coins: BackupCoin[],
  result: ImportResult,
  onProgress: ImportOptions['onProgress']
): void {
  let processed = 0
  onProgress?.('importing-coins', 0, coins.length, 'Importing coins...')

  const insert = db.prepare(
    `INSERT OR IGNORE INTO coins
     (id, collection_id, denomination, year, condition, purchase_date,
      purchase_place, price, shipping_cost, currency, country, notes, extra_data,
      sold, on_auction, auction_price, sale_price, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const update = db.prepare(
    `UPDATE coins SET
     collection_id = ?, denomination = ?, year = ?, condition = ?,
     purchase_date = ?, purchase_place = ?, price = ?, shipping_cost = ?,
     currency = ?, country = ?, notes = ?, extra_data = ?, sold = ?,
     on_auction = ?, auction_price = ?, sale_price = ?,
     updated_at = ?
     WHERE id = ?`
  )

  db.transaction(() => {
    for (const coin of coins) {
      try {
        const existing = db.prepare('SELECT id FROM coins WHERE id = ?').get(coin.id) as { id: string } | undefined
        const sold = coin.sold ? 1 : 0
        const onAuction = coin.onAuction ? 1 : 0
        const values = [
          coin.collectionId, coin.denomination, coin.year, coin.condition,
          coin.purchaseDate, coin.purchasePlace, coin.price, coin.shippingCost,
          coin.currency, coin.country, coin.notes, coin.extraData, sold,
          onAuction, coin.auctionPrice ?? null, coin.salePrice ?? null,
          coin.updatedAt, coin.id
        ]
        if (existing) {
          update.run(...values)
          result.updated.coins++
        } else {
          insert.run(coin.id, coin.collectionId, coin.denomination, coin.year, coin.condition,
            coin.purchaseDate, coin.purchasePlace, coin.price, coin.shippingCost,
            coin.currency, coin.country, coin.notes, coin.extraData, sold,
            onAuction, coin.auctionPrice ?? null, coin.salePrice ?? null,
            coin.createdAt, coin.updatedAt)
          result.imported.coins++
        }
        processed++
      } catch (err) {
        result.errors.push(`Failed to import coin ${coin.id}: ${err}`)
      }
    }
  })()

  onProgress?.('importing-coins', processed, coins.length, 'Coins done.')
}

function importPhotos(
  db: Database.Database,
  photos: BackupPhoto[],
  result: ImportResult,
  onProgress: ImportOptions['onProgress']
): void {
  let processed = 0
  onProgress?.('importing-photos', 0, photos.length, 'Importing photos...')

  const insert = db.prepare(
    'INSERT OR IGNORE INTO photos (id, coin_id, filename, original_name, position, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const update = db.prepare(
    'UPDATE photos SET original_name = ?, position = ? WHERE id = ?'
  )

  db.transaction(() => {
    for (const photo of photos) {
      try {
        const existing = db.prepare('SELECT id FROM photos WHERE id = ?').get(photo.id) as { id: string } | undefined
        if (existing) {
          update.run(photo.originalName, photo.position, photo.id)
          result.updated.photos++
        } else {
          insert.run(photo.id, photo.coinId, photo.filename, photo.originalName, photo.position, photo.createdAt)
          result.imported.photos++
        }
        processed++
      } catch (err) {
        result.errors.push(`Failed to import photo ${photo.id}: ${err}`)
      }
    }
  })()

  onProgress?.('importing-photos', processed, photos.length, 'Photo metadata done.')
}

function importNotes(
  db: Database.Database,
  notes: BackupNote[],
  result: ImportResult,
  onProgress: ImportOptions['onProgress']
): void {
  if (notes.length === 0) return

  let processed = 0
  onProgress?.('importing-notes', 0, notes.length, 'Importing notes...')

  const insert = db.prepare(
    'INSERT OR IGNORE INTO coin_notes (id, coin_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const update = db.prepare(
    'UPDATE coin_notes SET title = ?, content = ?, updated_at = ? WHERE id = ?'
  )

  db.transaction(() => {
    for (const note of notes) {
      try {
        const existing = db.prepare('SELECT id FROM coin_notes WHERE id = ?').get(note.id) as { id: string } | undefined
        if (existing) {
          update.run(note.title, note.content, note.updatedAt, note.id)
          result.updated.notes++
        } else {
          insert.run(note.id, note.coinId, note.title, note.content, note.createdAt, note.updatedAt)
          result.imported.notes++
        }
        processed++
      } catch (err) {
        result.errors.push(`Failed to import note ${note.id}: ${err}`)
      }
    }
  })()

  onProgress?.('importing-notes', processed, notes.length, 'Notes done.')
}

// ---------------------------------------------------------------------------
// Photo file copying
// ---------------------------------------------------------------------------

function copyPhotoFiles(
  tmpDir: string,
  photosDir: string,
  photos: BackupPhoto[],
  onProgress: ImportOptions['onProgress']
): void {
  const backupPhotosDir = join(tmpDir, 'photos')
  if (!existsSync(backupPhotosDir)) return

  const photoFiles = photos.filter((p) => existsSync(join(backupPhotosDir, p.filename)))
  if (photoFiles.length === 0) return

  let copied = 0
  onProgress?.('copying-files', 0, photoFiles.length, 'Copying photo files...')

  for (const photo of photoFiles) {
    const srcPath = join(backupPhotosDir, photo.filename)
    const destPath = join(photosDir, photo.filename)

    if (existsSync(destPath)) {
      const srcSize = statSync(srcPath).size
      const destSize = statSync(destPath).size
      if (srcSize === destSize) {
        copied++
        continue
      }
    }

    copyFileSync(srcPath, destPath)
    copied++
    if (copied % 10 === 0) {
      onProgress?.('copying-files', copied, photoFiles.length, `Copying photo files (${copied}/${photoFiles.length})...`)
    }
  }

  onProgress?.('copying-files', copied, photoFiles.length, 'Photo files done.')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Preview a backup ZIP without importing.
 */
export function previewBackup(zipPath: string): BackupPreview {
  const zip = new AdmZip(zipPath)
  const manifestEntry = zip.getEntry('manifest.json')
  if (!manifestEntry) {
    throw new Error('Invalid backup: missing manifest.json')
  }

  const manifest: BackupManifest = JSON.parse(manifestEntry.getData().toString('utf-8'))

  if (manifest.version !== 1) {
    throw new Error(`Unsupported backup version: ${manifest.version}. Expected 1.`)
  }

  const localStats = getLocalStats()

  return {
    manifest,
    isNewerThanLocal: manifest.exportedAt > 0, // Always consider merge-safe
    localStats
  }
}

/**
 * Import a backup ZIP with merge strategy.
 */
export async function importBackup(
  zipPath: string,
  options?: ImportOptions
): Promise<ImportResult> {
  const { db, closeDb } = getDb(options)
  const photosDir = options?.photosDir ?? getDefaultPhotosDir()
  const tmpBase = options?.tmpBaseDir ?? tmpdir()
  const tmpDir = join(tmpBase, `coin-import-${uuidv4()}`)
  const onProgress = options?.onProgress

  const result: ImportResult = {
    success: false,
    imported: { collections: 0, coins: 0, photos: 0, notes: 0 },
    updated: { collections: 0, coins: 0, photos: 0, notes: 0 },
    errors: []
  }

  try {
    // Extract ZIP
    onProgress?.('extracting', 0, 1, 'Extracting backup...')
    new AdmZip(zipPath).extractAllTo(tmpDir, true)

    // Fast validation: manifest must be parseable JSON
    JSON.parse(readFileSync(join(tmpDir, 'manifest.json'), 'utf-8'))

    // Parse backup data
    const { collections, coins, photos, notes } = readBackupData(tmpDir)

    // Merge each entity type
    importCollections(db, collections, result, onProgress)
    importCoins(db, coins, result, onProgress)
    importPhotos(db, photos, result, onProgress)
    importNotes(db, notes, result, onProgress)
    copyPhotoFiles(tmpDir, photosDir, photos, onProgress)

    onProgress?.('done', 1, 1, 'Import complete!')
    result.success = true
    return result
  } catch (err) {
    result.errors.push(`Import failed: ${String(err)}`)
    result.success = false
    return result
  } finally {
    if (closeDb) {
      try { db.close() } catch { /* ignore */ }
    }
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
}
