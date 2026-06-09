import PDFDocument from 'pdfkit'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { app } from 'electron'
import * as collectionRepo from '../database/repositories/collections'
import * as coinRepo from '../database/repositories/coins'
import * as photoRepo from '../database/repositories/photos'
import type { Coin, Collection, Photo } from '@shared/types'
import { t } from './l10n'

// ── Paths ───────────────────────────────────────────────────
function getPhotosDir(): string {
  return join(app.getPath('userData'), 'photos')
}

function getFontPath(fontName: string): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'assets/fonts', fontName)
  }
  return join(app.getAppPath(), 'src/main/assets/fonts', fontName)
}

// ── Constants ───────────────────────────────────────────────
const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 40
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const PHOTO_GAP = 8
const MAX_PHOTOS = 4
const MAX_PHOTO_HEIGHT = 150
const PHOTO_BOTTOM_MARGIN = 12
const SEPARATOR_COLOR = '#d4d4d4'
const GRAY_COLOR = '#888888'
const RED_COLOR = '#cc0000'

const FONT = 'DejaVuSans'
const FONT_BOLD = 'DejaVuSans-Bold'

// ── Types ───────────────────────────────────────────────────
export interface ExportPdfOptions {
  collectionIds: string[]
  includeSold: boolean
  includeImages: boolean
  includePurchaseInfo: boolean
  locale: 'en' | 'ru'
  onProgress?: (stage: string, current: number, total: number, message: string) => void
}

// ── i18n ────────────────────────────────────────────────────
// All labels defined in ./l10n

function formatDate(d: Date, locale: 'en' | 'ru'): string {
  return d.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function coinsLabel(n: number, locale: 'en' | 'ru'): string {
  return `${n} ${t(locale, 'coins')}`
}

// ── Font registration ───────────────────────────────────────
function registerFonts(doc: PDFKit.PDFDocument): void {
  const regularPath = getFontPath('DejaVuSans.ttf')
  const boldPath = getFontPath('DejaVuSans-Bold.ttf')

  if (!existsSync(regularPath)) {
    throw new Error(`PDF font not found: ${regularPath}`)
  }
  if (!existsSync(boldPath)) {
    throw new Error(`PDF bold font not found: ${boldPath}`)
  }

  doc.registerFont(FONT, regularPath)
  doc.registerFont(FONT_BOLD, boldPath)
}

// ── Coin text builders ──────────────────────────────────────
export function buildCoinMainLine(coin: Coin, locale: 'en' | 'ru'): string {
  const parts: string[] = []
  parts.push(`${t(locale, 'denomination')}: ${coin.denomination}`)
  if (coin.year) parts.push(`${coin.year}`)
  if (coin.sold) parts.push(t(locale, 'sold'))
  return parts.join('  \u00B7  ')
}

export function buildCoinDetailLines(coin: Coin, locale: 'en' | 'ru'): string[] {
  const lines: string[] = []
  if (coin.country) lines.push(`${t(locale, 'country')}: ${coin.country}`)
  if (coin.condition) lines.push(`${t(locale, 'condition')}: ${coin.condition}`)
  if (coin.notes) lines.push(`${t(locale, 'notes')}: ${coin.notes}`)
  return lines
}

export function buildPurchaseLine(coin: Coin, locale: 'en' | 'ru'): string | null {
  const parts: string[] = []
  if (coin.price !== null && coin.price !== undefined) {
    let s = `${t(locale, 'price')}: ${coin.price}`
    if (coin.currency) s += ` ${coin.currency}`
    if (coin.shippingCost) s += `  + ${t(locale, 'shipping')}: ${coin.shippingCost}`
    parts.push(s)
  }
  if (coin.purchaseDate) {
    parts.push(
      `${t(locale, 'purchaseDate')}: ${formatDate(new Date(coin.purchaseDate), locale)}`
    )
  }
  if (coin.purchasePlace) {
    parts.push(`${t(locale, 'purchasePlace')}: ${coin.purchasePlace}`)
  }
  return parts.length > 0 ? parts.join('  \u00B7  ') : null
}

// ── Photo rendering ─────────────────────────────────────────
async function renderCoinPhotos(
  doc: PDFKit.PDFDocument,
  photos: Photo[],
  photosDir: string
): Promise<number> {
  const available = photos.slice(0, MAX_PHOTOS)
  if (available.length === 0) return 0

  const numPhotos = available.length
  const slotWidth = Math.floor((CONTENT_WIDTH - (numPhotos - 1) * PHOTO_GAP) / numPhotos)
  const startY = doc.y
  let maxRenderedHeight = 0
  let loaded = 0

  for (let i = 0; i < available.length; i++) {
    const photo = available[i]
    const photoPath = join(photosDir, photo.filename)

    if (!existsSync(photoPath)) {
      console.error('[pdf] Photo file not found:', photoPath)
      continue
    }

    // Read file into buffer, get dimensions, process to JPEG
    let imageBuffer: Buffer
    let origWidth: number
    let origHeight: number
    try {
      const raw = readFileSync(photoPath)
      const meta = await sharp(raw).metadata()
      origWidth = meta.width ?? 200
      origHeight = meta.height ?? 150

      // Flatten transparency, resize to PDF render size, output as PNG
      imageBuffer = await sharp(raw)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .resize({ width: Math.round(slotWidth), withoutEnlargement: true })
        .png()
        .toBuffer()
    } catch (err) {
      console.error('[pdf] Failed to read/process photo:', photoPath, String(err))
      continue
    }

    const aspectRatio = origWidth / origHeight
    let renderWidth = slotWidth
    let renderHeight = renderWidth / aspectRatio

    if (renderHeight > MAX_PHOTO_HEIGHT) {
      renderHeight = MAX_PHOTO_HEIGHT
      renderWidth = renderHeight * aspectRatio
    }

    const xOffset = MARGIN + i * (slotWidth + PHOTO_GAP) + (slotWidth - renderWidth) / 2

    // Use Buffer (not file path) — avoids Electron sandbox path issues
    doc.image(imageBuffer, xOffset, startY, {
      width: renderWidth,
      height: renderHeight
    })
    loaded++

    if (renderHeight > maxRenderedHeight) {
      maxRenderedHeight = renderHeight
    }
  }

  if (loaded > 0) {
    console.log(
      `[pdf] Rendered ${loaded}/${available.length} photos at y=${Math.round(startY)}`
    )
    return maxRenderedHeight + PHOTO_BOTTOM_MARGIN
  }
  return 0
}

// ── Main export function ────────────────────────────────────
export async function exportCollectionsToPdf(options: ExportPdfOptions): Promise<string> {
  const {
    collectionIds,
    includeSold,
    includeImages,
    includePurchaseInfo,
    locale,
    onProgress
  } = options
  const photosDir = getPhotosDir()
  const totalCollections = collectionIds.length
  const now = new Date()

  console.log('[pdf] Starting PDF export, collections:', totalCollections)
  console.log('[pdf] Photos dir:', photosDir)
  console.log('[pdf] Include images:', includeImages)

  // ── Collect data ──────────────────────────────────────────
  const collectionsData: Array<{
    collection: Collection
    coins: Coin[]
    photosMap: Map<string, Photo[]>
  }> = []

  let totalPhotos = 0

  for (let ci = 0; ci < totalCollections; ci++) {
    const cid = collectionIds[ci]
    const collection = collectionRepo.getCollection(cid)
    if (!collection) continue

    const allCoins = coinRepo.listCoinsByCollection(cid)
    const coins = includeSold ? allCoins : allCoins.filter((c) => !c.sold)

    const photosMap = new Map<string, Photo[]>()
    if (includeImages) {
      for (const coin of coins) {
        const coinPhotos = photoRepo.listPhotos(coin.id)
        photosMap.set(coin.id, coinPhotos)
        totalPhotos += coinPhotos.length
      }
    }

    collectionsData.push({ collection, coins, photosMap })
    onProgress?.('Preparing', ci + 1, totalCollections, `Collection: ${collection.name}`)
  }

  console.log('[pdf] Total coins:', collectionsData.reduce((s, c) => s + c.coins.length, 0))
  console.log('[pdf] Total photos found:', totalPhotos)

  // ── Set up temp file ──────────────────────────────────────
  const tmpDir = join(app.getPath('temp'), 'coin-export')
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true })
  }
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filePath = join(tmpDir, `coin-collection-pdf-${timestamp}.pdf`)

  // ── Create PDF document ───────────────────────────────────
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: t(locale, 'title'),
      CreationDate: now
    }
  })

  registerFonts(doc)

  // ── Collect PDF into buffer (avoids stream/async issues) ──
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const pdfDone = new Promise<string>((resolve, reject) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks)
      writeFileSync(filePath, pdfBuffer)
      console.log('[pdf] Wrote', pdfBuffer.length, 'bytes to', filePath)
      resolve(filePath)
    })
    doc.on('error', (err) => {
      console.error('[pdf] Document error:', err)
      reject(err)
    })
  })

  // ── Title page ────────────────────────────────────────────
  doc.font(FONT_BOLD).fontSize(24)
  doc.text(t(locale, 'title'), MARGIN, MARGIN + 20, {
    width: CONTENT_WIDTH,
    align: 'center'
  })
  doc.moveDown(0.5)
  doc.font(FONT).fontSize(11).fillColor('#666666')
  doc.text(`${t(locale, 'exportDate')}: ${formatDate(now, locale)}`, MARGIN, doc.y, {
    width: CONTENT_WIDTH,
    align: 'center'
  })
  doc.fillColor('#000000')
  doc.moveDown(2)

  // ── Table of contents ─────────────────────────────────────
  doc.font(FONT_BOLD).fontSize(16)
  doc.text(t(locale, 'tableOfContents'), MARGIN, doc.y, { width: CONTENT_WIDTH })
  doc.moveDown(0.8)

  doc.font(FONT).fontSize(11)
  for (let ci = 0; ci < collectionsData.length; ci++) {
    const { collection, coins } = collectionsData[ci]
    doc.text(
      `${collection.name}  \u2014  ${coinsLabel(coins.length, locale)}`,
      MARGIN + 15,
      doc.y,
      { width: CONTENT_WIDTH - 15 }
    )
    doc.moveDown(0.2)
  }

  // ── Content: collections ──────────────────────────────────
  for (let ci = 0; ci < collectionsData.length; ci++) {
    const { collection, coins, photosMap } = collectionsData[ci]

    doc.addPage()
    doc.outline.addItem(collection.name)

    // Collection title
    doc.font(FONT_BOLD).fontSize(18)
    doc.text(collection.name, MARGIN, doc.y, { width: CONTENT_WIDTH })
    doc.moveDown(0.3)

    // Thin line
    const yAfter = doc.y
    doc
      .moveTo(MARGIN, yAfter + 2)
      .lineTo(PAGE_WIDTH - MARGIN, yAfter + 2)
      .strokeColor(SEPARATOR_COLOR)
      .stroke()
    doc.moveDown(0.8)

    // Coin count
    doc.font(FONT).fontSize(10).fillColor('#888888')
    doc.text(coinsLabel(coins.length, locale), MARGIN, doc.y, { width: CONTENT_WIDTH })
    doc.fillColor('#000000')
    doc.moveDown(1)

    for (let ri = 0; ri < coins.length; ri++) {
      const coin = coins[ri]
      const coinPhotos = photosMap.get(coin.id) ?? []

      // Avoid orphan coin at bottom of page
      if (doc.y > PAGE_HEIGHT - MARGIN - 120) {
        doc.addPage()
      }

      const coinStartY = doc.y

      // ── Photos ────────────────────────────────────────────
      let coinPhotoHeight = 0
      if (includeImages && coinPhotos.length > 0) {
        coinPhotoHeight = await renderCoinPhotos(doc, coinPhotos, photosDir)
        doc.y = coinStartY + coinPhotoHeight
      }

      // ── Main line ─────────────────────────────────────────
      doc.font(FONT_BOLD).fontSize(11)
      const lineY = doc.y

      // Base line: Denomination + Year (black)
      const baseParts: string[] = [`${t(locale, 'denomination')}: ${coin.denomination}`]
      if (coin.year) baseParts.push(`${coin.year}`)
      const baseLine = baseParts.join('  \u00B7  ')

      doc.fillColor('#000000')
      doc.text(baseLine, MARGIN + 8, lineY)

      const cursorX = MARGIN + 8 + doc.widthOfString(baseLine)

      // Sold label in red (inline)
      if (coin.sold) {
        const soldStr = `  \u00B7  ${t(locale, 'sold')}`
        // If it fits on the same line, render inline; otherwise new line
        if (cursorX + doc.widthOfString(soldStr) < PAGE_WIDTH - MARGIN) {
          doc.fillColor(RED_COLOR)
          doc.text(soldStr, cursorX, lineY)
        } else {
          doc.y = lineY + 14
          doc.fillColor(RED_COLOR)
          doc.text(soldStr, MARGIN + 8, doc.y)
        }
        doc.fillColor('#000000')
      }

      // Advance y past the line
      doc.y = Math.max(doc.y, lineY + 14)
      doc.moveDown(0.2)

      // ── Detail lines ──────────────────────────────────────
      const detailLines = buildCoinDetailLines(coin, locale)
      if (detailLines.length > 0) {
        doc.font(FONT).fontSize(10)
        for (const line of detailLines) {
          doc.text(line, MARGIN + 8, doc.y, {
            width: CONTENT_WIDTH - 8,
            lineBreak: true
          })
          doc.moveDown(0.1)
        }
      }

      // ── Purchase info (gray) ──────────────────────────────
      if (includePurchaseInfo) {
        const purchaseLine = buildPurchaseLine(coin, locale)
        if (purchaseLine) {
          doc.font(FONT).fontSize(9).fillColor(GRAY_COLOR)
          doc.text(purchaseLine, MARGIN + 8, doc.y, {
            width: CONTENT_WIDTH - 8,
            lineBreak: true
          })
          doc.fillColor('#000000')
          doc.moveDown(0.2)
        }
      }

      // ── Separator ─────────────────────────────────────────
      doc.moveDown(0.5)
      const sepY = doc.y
      doc
        .moveTo(MARGIN + 30, sepY)
        .lineTo(PAGE_WIDTH - MARGIN - 30, sepY)
        .strokeColor(SEPARATOR_COLOR)
        .stroke()
      doc.moveDown(0.8)

      // ── Progress ──────────────────────────────────────────
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
      'Generating',
      ci + 1,
      totalCollections,
      `${collection.name} (${ci + 1}/${totalCollections})`
    )
  }

  // ── Finalize ──────────────────────────────────────────────
  doc.end()
  console.log('[pdf] PDF generation complete')
  return pdfDone
}
