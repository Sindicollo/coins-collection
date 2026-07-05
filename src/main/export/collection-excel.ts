import { join } from 'path'
import { existsSync } from 'fs'
import ExcelJS from 'exceljs'
import sharp from 'sharp'
import { app } from 'electron'
import { t } from './l10n'
import { collectExportData, getExportTempDir, buildExportFilename } from './common'
import type { ProgressCallback } from './types'
import type { Coin, CoinNote } from '@shared/types'

// ── Constants ───────────────────────────────────────────
const IMAGE_MAX_HEIGHT = 400
const SHEET_MAX_NAME = 31

function getPhotosDir(): string {
  return join(app.getPath('userData'), 'photos')
}

// ── Pure helpers (exported for testing) ──────────────────

/**
 * Sanitize a sheet name for Excel (max 31 chars, remove forbidden chars).
 */
export function sanitizeSheetName(name: string): string {
  return (
    name
      // eslint-disable-next-line no-useless-escape
      .replace(/[\[\]:*?\\\/]/g, '')
      .trim()
      .slice(0, SHEET_MAX_NAME)
      .replace(/\s+/g, ' ') || 'Sheet'
  )
}

/**
 * Format a timestamp (ms) as YYYY-MM-DD string.
 */
export function formatDate(ts: number | null): string {
  if (!ts) return ''
  return new Date(ts).toISOString().slice(0, 10)
}

/**
 * Build a flat row data object from a coin for the Excel sheet.
 */
export function buildExcelRow(coin: Coin, notesText = ''): Record<string, string | number | null> {
  return {
    denomination: coin.denomination,
    year: coin.year ?? '',
    condition: coin.condition ?? '',
    country: coin.country ?? '',
    purchaseDate: formatDate(coin.purchaseDate),
    purchasePlace: coin.purchasePlace ?? '',
    price: coin.price ?? '',
    shippingCost: coin.shippingCost ?? '',
    currency: coin.currency ?? '',
    totalCost: (coin.price ?? 0) + (coin.shippingCost ?? 0),
    notes: notesText,
    sold: coin.sold ? '\u2713' : '',
    onAuction: coin.onAuction ? '\u2713' : '',
    auctionPrice: coin.auctionPrice ?? '',
    salePrice: coin.salePrice ?? ''
  }
}

/**
 * Concatenate notes into a single text block.
 */
function formatNotes(notes: CoinNote[]): string {
  if (notes.length === 0) return ''
  return notes
    .map((n) => {
      const title = n.title ? `[${n.title}]\n` : ''
      return `${title}${n.content}`
    })
    .join('\n\n---\n\n')
}

/**
 * Get the image extension for ExcelJS based on the original filename.
 */
export function getExtension(filename: string): 'jpeg' | 'png' | 'gif' {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'png') return 'png'
  if (ext === 'gif') return 'gif'
  return 'jpeg'
}

// ── Options ─────────────────────────────────────────────
export interface ExportOptions {
  collectionIds: string[]
  includeSold: boolean
  includeImages: boolean
  locale: 'en' | 'ru'
  onProgress?: ProgressCallback
}

// ── Main export function ────────────────────────────────
export async function exportCollectionsToExcel(options: ExportOptions): Promise<string> {
  const { includeImages, locale, onProgress } = options
  const photosDir = getPhotosDir()

  // Collect data using shared logic
  const collectionsData = await collectExportData(options)

  const wb = new ExcelJS.Workbook()

  // Build columns based on locale
  const columns: Partial<ExcelJS.Column>[] = [
    { header: t(locale, 'denomination'), key: 'denomination', width: 20 },
    { header: t(locale, 'year'), key: 'year', width: 6 },
    { header: t(locale, 'condition'), key: 'condition', width: 8 },
    { header: t(locale, 'country'), key: 'country', width: 15 },
    { header: t(locale, 'purchaseDate'), key: 'purchaseDate', width: 12 },
    { header: t(locale, 'purchasePlace'), key: 'purchasePlace', width: 15 },
    { header: t(locale, 'price'), key: 'price', width: 12 },
    { header: t(locale, 'shipping'), key: 'shippingCost', width: 12 },
    { header: t(locale, 'currency'), key: 'currency', width: 8 },
    { header: t(locale, 'totalCost'), key: 'totalCost', width: 12 },
    {
      header: t(locale, 'notes'),
      key: 'notes',
      width: 35,
      style: { alignment: { wrapText: true, vertical: 'top' } }
    },
    { header: t(locale, 'sold'), key: 'sold', width: 6 },
    { header: t(locale, 'onAuction'), key: 'onAuction', width: 6 },
    { header: t(locale, 'auctionPrice'), key: 'auctionPrice', width: 12 },
    { header: t(locale, 'salePrice'), key: 'salePrice', width: 12 }
  ]

  if (includeImages) {
    columns.push(
      { header: t(locale, 'obverse'), key: 'obverse', width: 25 },
      { header: t(locale, 'reverse'), key: 'reverse', width: 25 }
    )
  }

  const totalCollections = collectionsData.length

    for (let ci = 0; ci < totalCollections; ci++) {
    const { collection, coins, photosMap, notesMap } = collectionsData[ci]

    const name = sanitizeSheetName(collection.name)
    const ws = wb.addWorksheet(name)
    ws.columns = columns

    // Style header row
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    for (let ri = 0; ri < coins.length; ri++) {
      const coin = coins[ri]
      const rowNum = ri + 2 // 1-indexed + header

      const coinNotes = notesMap.get(coin.id) ?? []
      const notesText = formatNotes(coinNotes)
      const rowData = buildExcelRow(coin, notesText)

      if (includeImages) {
        rowData.obverse = ''
        rowData.reverse = ''
      }

      const row = ws.addRow(rowData)

      // Calculate row height based on text length in Notes
      const baseHeight = 20
      const notesHeight =
        notesText.length > 60
          ? 20 + Math.ceil(notesText.length / 50) * 15
          : baseHeight

      // Embed photos if requested — up to 2 per coin (obverse + reverse)
      if (includeImages) {
        const coinPhotos = photosMap.get(coin.id) ?? []

        for (let pi = 0; pi < coinPhotos.length && pi < 2; pi++) {
          const photo = coinPhotos[pi]
          const photoPath = join(photosDir, photo.filename)
          if (!existsSync(photoPath)) continue

          try {
            const resized = await sharp(photoPath)
              .resize({ height: IMAGE_MAX_HEIGHT, withoutEnlargement: true })
              .toBuffer()

            const imageId = wb.addImage({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              buffer: resized as any,
              extension: getExtension(photo.filename)
            })

            // First photo → second-to-last image column, second → last
            const col = columns.length - 2 + pi
            ws.addImage(imageId, {
              tl: { col, row: rowNum - 1 },
              ext: { width: 150, height: 150 }
            })
          } catch {
            // skip images that can't be processed
          }
        }

        row.height = Math.max(110, notesHeight)
      }

      // Progress report every 10 coins
      if (onProgress && (ri + 1) % 10 === 0) {
        onProgress(
          `Collection: ${collection.name}`,
          ri + 1,
          coins.length,
          `${ri + 1}/${coins.length}`
        )
      }
    }

    onProgress?.(
      `Exporting ${collection.name}`,
      ci + 1,
      totalCollections,
      `Collection ${ci + 1}/${totalCollections} done`
    )
  }

  // Write to temp file using shared helpers
  const tmpDir = getExportTempDir()
  const filePath = join(tmpDir, buildExportFilename('coin-collection-export', 'xlsx'))

  await wb.xlsx.writeFile(filePath)

  return filePath
}
