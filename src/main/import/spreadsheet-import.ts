import { app } from 'electron'
import { join, extname } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import {
  parseSpreadsheet,
  detectColumns,
  parseCoinRow,
  type CoinData
} from './xlsx-parser'
import * as collectionRepo from '../database/repositories/collections'
import * as coinRepo from '../database/repositories/coins'
import * as photoRepo from '../database/repositories/photos'
import { getDatabase } from '../database'
import { uuidv4 } from '../database/repositories/uuid'
import type { Collection } from '@shared/types'

// --- Types ---

export interface ImportPreview {
  filePath: string
  sheets: Array<{
    name: string
    coinCount: number
    photoCount: number
    embeddedPhotoCount: number
    sampleRows: CoinData[]
  }>
}

export interface ImportResult {
  countriesCreated: number
  countriesSkipped: number
  coinsCreated: number
  photosImported: number
  errors: string[]
}

// --- Helpers ---

function getPhotosDir(): string {
  const dir = join(app.getPath('userData'), 'photos')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function extractImageFromZip(filePath: string, imagePath: string): Buffer | null {
  try {
    return execSync(
      `unzip -p "${filePath}" "${imagePath}" 2>/dev/null`,
      { maxBuffer: 10 * 1024 * 1024 }
    )
  } catch {
    return null
  }
}

// --- Preview ---

export function getImportPreview(filePath: string, options?: { includeAllRows?: boolean }): ImportPreview {
  const data = parseSpreadsheet(filePath, options)

  const sheets = data.sheets.map((sheet) => {
    const mapping = detectColumns(sheet)
    const coins = sheet.rows.map((row) =>
      parseCoinRow(row, mapping, sheet.name, sheet.images)
    )

    // Count embedded images (one image per coin)
    const embeddedPhotoCount = coins.reduce(
      (sum, c) => sum + c.embeddedImages.length,
      0
    )

    return {
      name: sheet.name,
      coinCount: coins.length,
      photoCount: embeddedPhotoCount,
      embeddedPhotoCount,
      sampleRows: coins.slice(0, 5)
    }
  })

  return { filePath, sheets }
}

// --- Import ---

export async function importSpreadsheet(
  filePath: string,
  countryOverrides: Record<string, string> = {},
  importPhotos = true,
  onProgress?: (message: string) => void,
  options?: { includeAllRows?: boolean }
): Promise<ImportResult> {
  const data = parseSpreadsheet(filePath, options)
  const result: ImportResult = {
    countriesCreated: 0,
    countriesSkipped: 0,
    coinsCreated: 0,
    photosImported: 0,
    errors: []
  }

  const db = getDatabase()
  const photosDir = getPhotosDir()

  for (const sheet of data.sheets) {
    const collectionName = countryOverrides[sheet.name] ?? sheet.name
    onProgress?.(`Обработка "${collectionName}"...`)

    // Get or create collection
    let collection: Collection
    const existing = db
      .prepare('SELECT * FROM collections WHERE name = ?')
      .get(collectionName) as { id: string; name: string } | undefined

    if (existing) {
      collection = { id: existing.id, name: existing.name, createdAt: 0, updatedAt: 0 }
      result.countriesSkipped++
    } else {
      collection = collectionRepo.createCollection({ name: collectionName })
      result.countriesCreated++
    }

    // Parse coins with embedded images
    const mapping = detectColumns(sheet)

    // Sheet-specific denomination overrides
    const DENOMINATION_OVERRIDES: Record<string, string> = {
      shillings: 'Шиллинг',
      '3 pences': '3 пенса'
    }
    const denomOverride = DENOMINATION_OVERRIDES[sheet.name] ?? null

    const allCoins = sheet.rows.map((row) => {
      const coin = parseCoinRow(row, mapping, sheet.name, sheet.images)
      if (denomOverride) {
        coin.denomination = denomOverride
      }
      return coin
    })

    // Filter: only import rows that have a year and some data
    const importableCoins = allCoins.filter(
      (c) => c.year && (c.price !== null || c.notes || c.purchasePlace)
    )

    const totalPhotos = importableCoins.reduce(
      (sum, c) => sum + c.embeddedImages.length,
      0
    )
    onProgress?.(
      `Импорт ${importableCoins.length} монет, ${totalPhotos} фото...`
    )

    // Import coins + photos in a transaction
    db.transaction(() => {
      for (const coin of importableCoins) {
        try {
          const created = coinRepo.createCoin({
            collectionId: collection.id,
            denomination: coin.denomination,
            year: coin.year,
            price: coin.price,
            shippingCost: coin.shippingCost,
            purchaseDate: coin.purchaseDate,
            purchasePlace: coin.purchasePlace,
            notes: coin.notes,
            currency: 'RUB'
          })
          result.coinsCreated++

          // Import embedded images from xlsx
          if (importPhotos) {
            for (let pi = 0; pi < coin.embeddedImages.length; pi++) {
              const img = coin.embeddedImages[pi]
              try {
                const imgBuffer = extractImageFromZip(filePath, img.imagePath)
                if (!imgBuffer || imgBuffer.length < 100) continue

                const ext = extname(img.imagePath).toLowerCase() || '.jpg'
                const filename = `${uuidv4()}${ext}`
                writeFileSync(join(photosDir, filename), imgBuffer)

                photoRepo.createPhoto({
                  coinId: created.id,
                  filename,
                  originalName: img.imagePath,
                  position: pi
                })
                result.photosImported++
              } catch (err) {
                result.errors.push(
                  `Ошибка извлечения фото для ${coin.denomination}: ${err}`
                )
              }
            }
          }
        } catch (err) {
          result.errors.push(`Ошибка импорта монеты ${coin.denomination}: ${err}`)
        }
      }
    })()
  }

  onProgress?.(`Импорт завершён.`)
  return result
}

// --- One-time import: coins without year (ancient coins, etc.) ---

export async function importSpreadsheetNoYear(
  filePath: string,
  countryOverrides: Record<string, string> = {},
  importPhotos = true,
  onProgress?: (message: string) => void
): Promise<ImportResult> {
  const data = parseSpreadsheet(filePath, { includeAllRows: true })
  const result: ImportResult = {
    countriesCreated: 0,
    countriesSkipped: 0,
    coinsCreated: 0,
    photosImported: 0,
    errors: []
  }

  const db = getDatabase()
  const photosDir = getPhotosDir()

  for (const sheet of data.sheets) {
    const collectionName = countryOverrides[sheet.name] ?? sheet.name
    onProgress?.(`Обработка "${collectionName}" (только монеты без года)...`)

    // Get or create collection
    let collection: Collection
    const existing = db
      .prepare('SELECT * FROM collections WHERE name = ?')
      .get(collectionName) as { id: string; name: string } | undefined

    if (existing) {
      collection = { id: existing.id, name: existing.name, createdAt: 0, updatedAt: 0 }
      result.countriesSkipped++
    } else {
      collection = collectionRepo.createCollection({ name: collectionName })
      result.countriesCreated++
    }

    // Parse coins with embedded images
    const mapping = detectColumns(sheet)

    // Sheet-specific denomination overrides
    const DENOMINATION_OVERRIDES: Record<string, string> = {
      shillings: 'Шиллинг',
      '3 pences': '3 пенса'
    }
    const denomOverride = DENOMINATION_OVERRIDES[sheet.name] ?? null

    const allCoins = sheet.rows.map((row) => {
      const coin = parseCoinRow(row, mapping, sheet.name, sheet.images)
      if (denomOverride) {
        coin.denomination = denomOverride
      }
      return coin
    })

    // Filter: only coins WITHOUT a year that have some data
    const noYearCoins = allCoins.filter(
      (c) => c.year === null && (c.price !== null || c.notes || c.purchasePlace)
    )

    // Query existing coins in this collection to avoid duplicates
    const existingCoins = db
      .prepare('SELECT denomination, year FROM coins WHERE collection_id = ?')
      .all(collection.id) as Array<{ denomination: string; year: number | null }>

    // Build a set of existing (denomination, year) pairs for quick lookup
    const existingSet = new Set(
      existingCoins.map((c) => `${c.denomination}::${c.year ?? '__NULL__'}`)
    )

    // Filter out duplicates
    const importableCoins = noYearCoins.filter((c) => {
      const key = `${c.denomination}::__NULL__`
      return !existingSet.has(key)
    })

    const skipped = noYearCoins.length - importableCoins.length
    if (skipped > 0) {
      onProgress?.(`Пропущено ${skipped} дубликатов в "${collectionName}"`)
    }

    const totalPhotos = importableCoins.reduce(
      (sum, c) => sum + c.embeddedImages.length,
      0
    )
    onProgress?.(
      `Импорт ${importableCoins.length} монет без года, ${totalPhotos} фото...`
    )

    // Import coins + photos in a transaction
    db.transaction(() => {
      for (const coin of importableCoins) {
        try {
          const created = coinRepo.createCoin({
            collectionId: collection.id,
            denomination: coin.denomination,
            year: coin.year,
            price: coin.price,
            shippingCost: coin.shippingCost,
            purchaseDate: coin.purchaseDate,
            purchasePlace: coin.purchasePlace,
            notes: coin.notes,
            currency: 'RUB'
          })
          result.coinsCreated++

          // Import embedded images from xlsx
          if (importPhotos) {
            for (let pi = 0; pi < coin.embeddedImages.length; pi++) {
              const img = coin.embeddedImages[pi]
              try {
                const imgBuffer = extractImageFromZip(filePath, img.imagePath)
                if (!imgBuffer || imgBuffer.length < 100) continue

                const ext = extname(img.imagePath).toLowerCase() || '.jpg'
                const filename = `${uuidv4()}${ext}`
                writeFileSync(join(photosDir, filename), imgBuffer)

                photoRepo.createPhoto({
                  coinId: created.id,
                  filename,
                  originalName: img.imagePath,
                  position: pi
                })
                result.photosImported++
              } catch (err) {
                result.errors.push(
                  `Ошибка извлечения фото для ${coin.denomination}: ${err}`
                )
              }
            }
          }
        } catch (err) {
          result.errors.push(`Ошибка импорта монеты ${coin.denomination}: ${err}`)
        }
      }
    })()
  }

  onProgress?.(`Импорт завершён.`)
  return result
}
