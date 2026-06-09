import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import ExcelJS from 'exceljs'
import sharp from 'sharp'
import * as collectionRepo from '../database/repositories/collections'
import * as coinRepo from '../database/repositories/coins'
import * as photoRepo from '../database/repositories/photos'
import { app } from 'electron'

const IMAGE_MAX_HEIGHT = 400
const SHEET_MAX_NAME = 31

function getPhotosDir(): string {
  return join(app.getPath('userData'), 'photos')
}

function sanitizeSheetName(name: string): string {
  return name
    // eslint-disable-next-line no-useless-escape
    .replace(/[\[\]:*?\\\/]/g, '')
    .trim()
    .slice(0, SHEET_MAX_NAME)
    .replace(/\s+/g, ' ')
    || `Sheet`
}

function formatDate(ts: number | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toISOString().slice(0, 10)
}

export interface ExportOptions {
  collectionIds: string[]
  includeSold: boolean
  includeImages: boolean
  locale: string
  onProgress?: (stage: string, current: number, total: number, message: string) => void
}

const L10N: Record<string, Record<string, string>> = {
  en: {
    denomination: 'Denomination',
    year: 'Year',
    condition: 'Condition',
    country: 'Country',
    purchaseDate: 'Purchase Date',
    purchasePlace: 'Purchase Place',
    price: 'Price',
    shipping: 'Shipping',
    currency: 'Currency',
    totalCost: 'Total Cost',
    notes: 'Notes',
    sold: 'Sold',
    obverse: 'Obverse',
    reverse: 'Reverse'
  },
  ru: {
    denomination: 'Номинал',
    year: 'Год',
    condition: 'Состояние',
    country: 'Страна',
    purchaseDate: 'Дата покупки',
    purchasePlace: 'Место покупки',
    price: 'Цена',
    shipping: 'Доставка',
    currency: 'Валюта',
    totalCost: 'Общая стоимость',
    notes: 'Заметки',
    sold: 'Продан',
    obverse: 'Аверс',
    reverse: 'Реверс'
  }
}

function t(locale: string, key: string): string {
  return L10N[locale]?.[key] ?? L10N.en[key] ?? key
}

export async function exportCollectionsToExcel(options: ExportOptions): Promise<string> {
  const { collectionIds, includeSold, includeImages, locale, onProgress } = options
  const photosDir = getPhotosDir()
  const totalCollections = collectionIds.length

  const wb = new ExcelJS.Workbook()

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
      header: t(locale, 'notes'), key: 'notes', width: 35,
      style: { alignment: { wrapText: true, vertical: 'top' } }
    },
    { header: t(locale, 'sold'), key: 'sold', width: 6 }
  ]

  if (includeImages) {
    columns.push(
      { header: t(locale, 'obverse'), key: 'obverse', width: 25 },
      { header: t(locale, 'reverse'), key: 'reverse', width: 25 }
    )
  }

  for (let ci = 0; ci < totalCollections; ci++) {
    const cid = collectionIds[ci]
    const collection = collectionRepo.getCollection(cid)
    if (!collection) continue

    const name = sanitizeSheetName(collection.name) || `Sheet${ci + 1}`
    const allCoins = coinRepo.listCoinsByCollection(cid)
    const coins = includeSold ? allCoins : allCoins.filter((c) => !c.sold)

    const ws = wb.addWorksheet(name)
    ws.columns = columns

    // Style header row
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    for (let ri = 0; ri < coins.length; ri++) {
      const coin = coins[ri]
      const rowNum = ri + 2 // 1-indexed + header

      const rowData: Record<string, string | number | null> = {
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
        notes: coin.notes ?? '',
        sold: coin.sold ? '\u2713' : ''
      }

      if (includeImages) {
        rowData.obverse = ''
        rowData.reverse = ''
      }

      const row = ws.addRow(rowData)

      // Calculate row height based on text length in Notes
      const notesText = coin.notes ?? ''
      const baseHeight = 20
      const notesHeight = notesText.length > 60
        ? 20 + Math.ceil(notesText.length / 50) * 15
        : baseHeight

      // Embed photos if requested — up to 2 per coin (obverse + reverse)
      if (includeImages) {
        const photos = photoRepo.listPhotos(coin.id).slice(0, 2)

        for (let pi = 0; pi < photos.length; pi++) {
          const photo = photos[pi]
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
      } else {
        row.height = notesHeight
      }

      // Progress report every 10 photos
      if (onProgress && (ri + 1) % 10 === 0) {
        onProgress(
          `Collection: ${collection.name}`,
          ri + 1,
          coins.length,
          `Photos: ${ri + 1}/${coins.length}`
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

  // Write to temp file
  const tmpDir = join(app.getPath('temp'), 'coin-export')
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filePath = join(tmpDir, `coin-collection-export-${timestamp}.xlsx`)

  await wb.xlsx.writeFile(filePath)

  return filePath
}

function getExtension(filename: string): 'jpeg' | 'png' | 'gif' {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'png') return 'png'
  if (ext === 'gif') return 'gif'
  return 'jpeg' // jpg, webp → treat as jpeg
}
