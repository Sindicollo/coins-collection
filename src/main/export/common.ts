import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { app } from 'electron'
import { getCollection, listCoinsByCollection, listPhotos } from '../database/repositories'
import { listCoinNotes } from '../database/repositories/coin-notes'
import type { Photo, CoinNote } from '@shared/types'
import type { CollectOptions, CollectedCollection } from './types'

/**
 * Create /tmp/coin-export/ directory (lazy, one mkdir per export).
 */
let _tmpDirCreated = false

export function getExportTempDir(): string {
  const dir = join(app.getPath('temp'), 'coin-export')
  if (!_tmpDirCreated) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    _tmpDirCreated = true
  }
  return dir
}

/**
 * Build a timestamped filename for an export file.
 *
 * @param prefix — human-readable prefix, e.g. "coin-collection" or "коллекция-монет"
 * @param ext    — file extension (without dot), e.g. "pdf" or "xlsx"
 */
export function buildExportFilename(prefix: string, ext: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${prefix}-${timestamp}.${ext}`
}

/**
 * Collect export data from the database:
 * fetch collections → list coins (optionally filter sold) → load photos.
 *
 * Returns an array of `CollectedCollection` ready for use by any export format.
 */
export async function collectExportData(
  options: CollectOptions
): Promise<CollectedCollection[]> {
  const { collectionIds, includeSold, includeImages, onProgress } = options
  const totalCollections = collectionIds.length
  const result: CollectedCollection[] = []

  for (let ci = 0; ci < totalCollections; ci++) {
    const cid = collectionIds[ci]
    const collection = getCollection(cid)
    if (!collection) continue

    const allCoins = listCoinsByCollection(cid)
    const coins = includeSold ? allCoins : allCoins.filter((c) => !c.sold)

    const photosMap = new Map<string, Photo[]>()
    const notesMap = new Map<string, CoinNote[]>()
    if (includeImages) {
      for (const coin of coins) {
        const coinPhotos = listPhotos(coin.id)
        if (coinPhotos.length > 0) {
          photosMap.set(coin.id, coinPhotos)
        }
        const coinNotes = listCoinNotes(coin.id)
        if (coinNotes.length > 0) {
          notesMap.set(coin.id, coinNotes)
        }
      }
    } else {
      for (const coin of coins) {
        const coinNotes = listCoinNotes(coin.id)
        if (coinNotes.length > 0) {
          notesMap.set(coin.id, coinNotes)
        }
      }
    }

    result.push({ collection, coins, photosMap, notesMap })
    onProgress?.('Preparing', ci + 1, totalCollections, `Collection: ${collection.name}`)
  }

  return result
}
