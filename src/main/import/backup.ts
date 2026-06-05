import { app } from 'electron'
import { join } from 'path'
import { existsSync, copyFileSync, statSync, rmSync, readFileSync } from 'fs'
import AdmZip from 'adm-zip'
import { getDatabase } from '../database'
import { getLocalStats } from '../database/repositories/export'
import type { BackupManifest, BackupPreview, ImportResult } from '@shared/types'
import { uuidv4 } from '../database/repositories/uuid'

function getPhotosDir(): string {
  return join(app.getPath('userData'), 'photos')
}

export interface ImportCallbacks {
  onProgress?: (stage: string, current: number, total: number, message: string) => void
}

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
  callbacks?: ImportCallbacks
): Promise<ImportResult> {
  const db = getDatabase()
  const photosDir = getPhotosDir()
  const tmpDir = join(app.getPath('temp'), `coin-import-${uuidv4()}`)
  const { onProgress } = callbacks ?? {}

  const result: ImportResult = {
    success: false,
    imported: { collections: 0, coins: 0, photos: 0 },
    updated: { collections: 0, coins: 0, photos: 0 },
    errors: []
  }

  try {
    // Extract ZIP
    onProgress?.('extracting', 0, 1, 'Extracting backup...')
    const zip = new AdmZip(zipPath)
    zip.extractAllTo(tmpDir, true)

    // Read manifest (already validated in preview)
    JSON.parse(readFileSync(join(tmpDir, 'manifest.json'), 'utf-8'))

    // Read JSON files
    const collectionsRaw = readFileSync(join(tmpDir, 'collections.json'), 'utf-8')
    const collections = JSON.parse(collectionsRaw) as Array<{
      id: string; name: string; createdAt: number; updatedAt: number
    }>

    const coinsRaw = readFileSync(join(tmpDir, 'coins.json'), 'utf-8')
    const coins = JSON.parse(coinsRaw) as Array<{
      id: string; collectionId: string; denomination: string
      year: number | null; condition: string | null
      purchaseDate: number | null; purchasePlace: string | null
      price: number | null; shippingCost: number | null
      currency: string | null; country: string | null
      notes: string | null; extraData: string | null
      sold: boolean; createdAt: number; updatedAt: number
    }>

    const photosRaw = readFileSync(join(tmpDir, 'photos.json'), 'utf-8')
    const photos = JSON.parse(photosRaw) as Array<{
      id: string; coinId: string; filename: string
      originalName: string | null; position: number; createdAt: number
    }>

    // Import collections (merge)
    let processed = 0
    onProgress?.('importing-collections', 0, collections.length, 'Importing collections...')

    const insertCollection = db.prepare(
      'INSERT OR IGNORE INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    )
    const updateCollection = db.prepare(
      'UPDATE collections SET name = ?, updated_at = ? WHERE id = ?'
    )

    db.transaction(() => {
      for (const col of collections) {
        const existing = db.prepare('SELECT id FROM collections WHERE id = ?').get(col.id) as { id: string } | undefined
        if (existing) {
          // Update existing
          updateCollection.run(col.name, col.updatedAt, col.id)
          result.updated.collections++
        } else {
          // Insert new with original id
          insertCollection.run(col.id, col.name, col.createdAt, col.updatedAt)
          result.imported.collections++
        }
        processed++
      }
    })()
    onProgress?.('importing-collections', processed, collections.length, 'Collections done.')

    // Import coins (merge)
    processed = 0
    onProgress?.('importing-coins', 0, coins.length, 'Importing coins...')

    const insertCoin = db.prepare(
      `INSERT OR IGNORE INTO coins
       (id, collection_id, denomination, year, condition, purchase_date,
        purchase_place, price, shipping_cost, currency, country, notes, extra_data,
        sold, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const updateCoin = db.prepare(
      `UPDATE coins SET
       collection_id = ?, denomination = ?, year = ?, condition = ?,
       purchase_date = ?, purchase_place = ?, price = ?, shipping_cost = ?,
       currency = ?, country = ?, notes = ?, extra_data = ?, sold = ?,
       updated_at = ?
       WHERE id = ?`
    )

    db.transaction(() => {
      for (const coin of coins) {
        try {
          const existing = db.prepare('SELECT id FROM coins WHERE id = ?').get(coin.id) as { id: string } | undefined
          const sold = coin.sold ? 1 : 0
          if (existing) {
            // Update existing
            updateCoin.run(
              coin.collectionId, coin.denomination, coin.year, coin.condition,
              coin.purchaseDate, coin.purchasePlace, coin.price, coin.shippingCost,
              coin.currency, coin.country, coin.notes, coin.extraData, sold,
              coin.updatedAt, coin.id
            )
            result.updated.coins++
          } else {
            // Insert new
            insertCoin.run(
              coin.id, coin.collectionId, coin.denomination, coin.year, coin.condition,
              coin.purchaseDate, coin.purchasePlace, coin.price, coin.shippingCost,
              coin.currency, coin.country, coin.notes, coin.extraData, sold,
              coin.createdAt, coin.updatedAt
            )
            result.imported.coins++
          }
          processed++
        } catch (err) {
          result.errors.push(`Failed to import coin ${coin.id}: ${err}`)
        }
      }
    })()
    onProgress?.('importing-coins', processed, coins.length, 'Coins done.')

    // Import photos metadata (merge)
    processed = 0
    onProgress?.('importing-photos', 0, photos.length, 'Importing photos...')

    const insertPhoto = db.prepare(
      'INSERT OR IGNORE INTO photos (id, coin_id, filename, original_name, position, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const updatePhoto = db.prepare(
      'UPDATE photos SET original_name = ?, position = ? WHERE id = ?'
    )

    db.transaction(() => {
      for (const photo of photos) {
        try {
          const existing = db.prepare('SELECT id FROM photos WHERE id = ?').get(photo.id) as { id: string } | undefined
          if (existing) {
            updatePhoto.run(photo.originalName, photo.position, photo.id)
            result.updated.photos++
          } else {
            insertPhoto.run(photo.id, photo.coinId, photo.filename, photo.originalName, photo.position, photo.createdAt)
            result.imported.photos++
          }
          processed++
        } catch (err) {
          result.errors.push(`Failed to import photo ${photo.id}: ${err}`)
        }
      }
    })()
    onProgress?.('importing-photos', processed, photos.length, 'Photo metadata done.')

    // Copy photo files with conflict detection
    const backupPhotosDir = join(tmpDir, 'photos')
    if (existsSync(backupPhotosDir)) {
      const photoFiles = photos.filter((p) => {
        const srcPath = join(backupPhotosDir, p.filename)
        return existsSync(srcPath)
      })

      let copied = 0
      onProgress?.('copying-files', 0, photoFiles.length, 'Copying photo files...')

      for (const photo of photoFiles) {
        const srcPath = join(backupPhotosDir, photo.filename)
        const destPath = join(photosDir, photo.filename)

        if (existsSync(destPath)) {
          // Compare file size
          const srcSize = statSync(srcPath).size
          const destSize = statSync(destPath).size
          if (srcSize === destSize) {
            // Same size — skip
            copied++
            continue
          }
          // Different size — overwrite
        }

        copyFileSync(srcPath, destPath)
        copied++
        if (copied % 10 === 0) {
          onProgress?.('copying-files', copied, photoFiles.length, `Copying photo files (${copied}/${photoFiles.length})...`)
        }
      }
      onProgress?.('copying-files', copied, photoFiles.length, 'Photo files done.')
    }

    // Finalize
    onProgress?.('done', 1, 1, 'Import complete!')
    result.success = true
    return result
  } catch (err) {
    result.errors.push(`Import failed: ${String(err)}`)
    result.success = false
    return result
  } finally {
    // Cleanup temp directory
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
}
