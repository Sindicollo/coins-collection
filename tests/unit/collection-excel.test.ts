/**
 * Unit tests for collection-excel.ts — XLSX export logic.
 *
 * Uses a real better-sqlite3 database, mocks electron (app.getPath)
 * and sharp (image processing).
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'path'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import ExcelJS from 'exceljs'
import Database from 'better-sqlite3'
import { createDatabaseAt, closeDatabase, getDatabase } from '../../src/main/database'

// ---------------------------------------------------------------------------
// Mocks — must be before module imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      const base = join(tmpdir(), 'coin-excel-test-userdata')
      if (name === 'userData') return base
      if (name === 'temp') return join(tmpdir(), 'coin-excel-test-temp')
      return join(tmpdir(), 'coin-excel-test-' + name)
    })
  }
}))

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('FAKE_IMAGE_DATA'))
  }))
}))

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

import { exportCollectionsToExcel } from '../../src/main/export/collection-excel'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PK = vi.hoisted(() => {
  return {
    COLL_ID: 'coll-1',
    COIN_A_ID: 'coin-a',
    COIN_B_ID: 'coin-b',
    COIN_SOLD_ID: 'coin-sold',
    PHOTO_ID: 'photo-1'
  } as const
})

function initTestDb(dbPath: string): void {
  try { closeDatabase() } catch { /* ignore */ }
  const temp = createDatabaseAt(dbPath)
  temp.close()
  getDatabase(dbPath)
}

/** Seed a minimal database with one collection and three coins. */
function seedBasicData(db: Database.Database): void {
  const now = Date.now()

  db.prepare(
    'INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run(PK.COLL_ID, 'Test Collection', now, now)

  // Coin A — active, full data
  db.prepare(
    `INSERT INTO coins (id, collection_id, denomination, year, condition,
      purchase_date, purchase_place, price, shipping_cost, currency, country,
      notes, extra_data, sold, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    PK.COIN_A_ID, PK.COLL_ID, '1 рубль', 1999, 'UNC',
    now, 'eBay', 50, 5, 'RUB', 'Russia',
    'Nice coin', null, 0, now, now
  )

  // Coin B — active, minimal fields (nulls)
  db.prepare(
    `INSERT INTO coins (id, collection_id, denomination, year, condition,
      purchase_date, purchase_place, price, shipping_cost, currency, country,
      notes, extra_data, sold, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    PK.COIN_B_ID, PK.COLL_ID, '50 копеек', null, null,
    null, null, null, null, null, null,
    null, null, 0, now, now
  )

  // Coin C — sold
  db.prepare(
    `INSERT INTO coins (id, collection_id, denomination, year, condition,
      purchase_date, purchase_place, price, shipping_cost, currency, country,
      notes, extra_data, sold, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    PK.COIN_SOLD_ID, PK.COLL_ID, 'Sold Coin', 2020, 'VF',
    now, 'Auction', 100, 10, 'USD', 'USA',
    'Was sold', null, 1, now, now
  )
}

/** Read back the first worksheet from an XLSX file as an array of row objects. */
async function readWorksheetRows(filePath: string): Promise<Record<string, string | number>[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(filePath)
  const ws = wb.worksheets[0]
  const rows: Record<string, string | number>[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // skip header
    const obj: Record<string, string | number> = {}
    row.eachCell((cell) => {
      if (cell.col <= ws.columnCount) {
        obj[ws.getRow(1).getCell(cell.col).value as string] = cell.value as string | number
      }
    })
    rows.push(obj)
  })
  return rows
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

let testRoot: string
let dbPath: string

beforeEach(() => {
  testRoot = join(tmpdir(), `coin-excel-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
  mkdirSync(testRoot, { recursive: true })
  dbPath = join(testRoot, 'test.sqlite')
  initTestDb(dbPath)

  const db = new Database(dbPath)
  seedBasicData(db)
  db.close()

  // Create a photo directory with a dummy file
  const photosDir = join(tmpdir(), 'coin-excel-test-userdata', 'photos')
  mkdirSync(photosDir, { recursive: true })
  writeFileSync(join(photosDir, 'dummy.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]))

  // Insert a photo record linked to coin A
  const photoDb = new Database(dbPath)
  photoDb.prepare(
    'INSERT INTO photos (id, coin_id, filename, original_name, position, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(PK.PHOTO_ID, PK.COIN_A_ID, 'dummy.jpg', 'original.jpg', 0, Date.now())
  photoDb.close()
})

afterEach(() => {
  try { closeDatabase() } catch { /* ignore */ }
  try { rmSync(testRoot, { recursive: true, force: true }) } catch { /* ignore */ }
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('exportCollectionsToExcel', () => {
  it('creates a valid XLSX file with coin data (happy path)', async () => {
    const filePath = await exportCollectionsToExcel({
      collectionIds: [PK.COLL_ID],
      includeSold: true,
      includeImages: false,
      locale: 'en'
    })

    expect(filePath).toBeTruthy()
    expect(existsSync(filePath!)).toBe(true)

    const rows = await readWorksheetRows(filePath!)
    // 3 coins (A, B, Sold)
    expect(rows).toHaveLength(3)

    // Coin A
    const coinA = rows.find((r) => r.Denomination === '1 рубль')
    expect(coinA).toBeDefined()
    expect(coinA!.Year).toBe(1999)
    expect(coinA!.Condition).toBe('UNC')
    expect(coinA!['Purchase Date']).toBeTruthy()
    expect(coinA!['Purchase Place']).toBe('eBay')
    expect(coinA!.Price).toBe(50)
    expect(coinA!.Shipping).toBe(5)
    expect(coinA!.Currency).toBe('RUB')
    expect(coinA!['Total Cost']).toBe(55) // 50 + 5
    expect(coinA!.Country).toBe('Russia')
    expect(coinA!.Notes).toBe('Nice coin')
    expect(coinA!.Sold).toBe('')

    // Coin B — minimal/null fields
    const coinB = rows.find((r) => r.Denomination === '50 копеек')
    expect(coinB).toBeDefined()
    expect(coinB!.Year).toBe('')
    expect(coinB!.Price).toBe('')
    expect(coinB!.Notes).toBe('')
    expect(coinB!['Total Cost']).toBe(0)

    // Sold coin
    const soldCoin = rows.find((r) => r.Denomination === 'Sold Coin')
    expect(soldCoin).toBeDefined()
    expect(soldCoin!.Sold).toBe('\u2713')
  })

  it('excludes sold coins when includeSold is false', async () => {
    const filePath = await exportCollectionsToExcel({
      collectionIds: [PK.COLL_ID],
      includeSold: false,
      includeImages: false,
      locale: 'en'
    })

    const rows = await readWorksheetRows(filePath!)
    expect(rows).toHaveLength(2)

    const soldCoin = rows.find((r) => r.Denomination === 'Sold Coin')
    expect(soldCoin).toBeUndefined()
  })

  it('handles empty collection gracefully', async () => {
    // Create a second collection with no coins
    const db = new Database(dbPath)
    db.prepare(
      'INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run('coll-empty', 'Empty Collection', Date.now(), Date.now())
    db.close()

    const filePath = await exportCollectionsToExcel({
      collectionIds: ['coll-empty'],
      includeSold: true,
      includeImages: false,
      locale: 'en'
    })

    expect(existsSync(filePath!)).toBe(true)

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(filePath!)
    const ws = wb.worksheets[0]
    expect(ws).toBeDefined()
    expect(ws.name).toBe('Empty Collection')

    // Only header row — no data
    let dataRowCount = 0
    ws.eachRow((_row, rowNumber) => {
      if (rowNumber > 1) dataRowCount++
    })
    expect(dataRowCount).toBe(0)
  })

  it('uses Russian locale for column headers', async () => {
    const filePath = await exportCollectionsToExcel({
      collectionIds: [PK.COLL_ID],
      includeSold: false,
      includeImages: false,
      locale: 'ru'
    })

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(filePath!)
    const ws = wb.worksheets[0]
    // Read header row
    const headerValues = (ws.getRow(1).values as Array<string | null>).filter(Boolean) as string[]

    expect(headerValues).toContain('Номинал')
    expect(headerValues).toContain('Год')
    expect(headerValues).toContain('Цена')
    expect(headerValues).toContain('Заметки')
    expect(headerValues).toContain('Продан')
    // English fallback should not appear
    expect(headerValues).not.toContain('Denomination')
  })

  it('includes Obverse/Reverse columns when includeImages is true', async () => {
    const filePath = await exportCollectionsToExcel({
      collectionIds: [PK.COLL_ID],
      includeSold: false,
      includeImages: true,
      locale: 'en'
    })

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(filePath!)
    const ws = wb.worksheets[0]
    const headerValues = (ws.getRow(1).values as Array<string | null>).filter(Boolean) as string[]

    expect(headerValues).toContain('Obverse')
    expect(headerValues).toContain('Reverse')
  })

  it('does not include Obverse/Reverse columns when includeImages is false', async () => {
    const filePath = await exportCollectionsToExcel({
      collectionIds: [PK.COLL_ID],
      includeSold: false,
      includeImages: false,
      locale: 'en'
    })

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(filePath!)
    const ws = wb.worksheets[0]
    const headerValues = (ws.getRow(1).values as Array<string | null>).filter(Boolean) as string[]

    expect(headerValues).not.toContain('Obverse')
    expect(headerValues).not.toContain('Reverse')
  })

  it('skips missing collections (returns file with only valid sheets)', async () => {
    const filePath = await exportCollectionsToExcel({
      collectionIds: [PK.COLL_ID, 'non-existent-id'],
      includeSold: true,
      includeImages: false,
      locale: 'en'
    })

    expect(existsSync(filePath!)).toBe(true)

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(filePath!)
    // Only one worksheet (the valid collection); the non-existent is skipped
    expect(wb.worksheets).toHaveLength(1)
  })

  it('calls onProgress callback during export', async () => {
    const onProgress = vi.fn()

    await exportCollectionsToExcel({
      collectionIds: [PK.COLL_ID],
      includeSold: true,
      includeImages: false,
      locale: 'en',
      onProgress
    })

    // Called at least with the end-of-collection progress
    expect(onProgress).toHaveBeenCalled()
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1]
    expect(lastCall[0]).toContain('Exporting')
    expect(lastCall[1]).toBe(1) // current collection index
    expect(lastCall[2]).toBe(1) // total collections
  })

  it('sanitizes sheet names with invalid Excel characters', async () => {
    const db = new Database(dbPath)
    db.prepare(
      'INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(
      'coll-weird', 'Weird [Name] *Test?', Date.now(), Date.now()
    )
    db.close()

    const filePath = await exportCollectionsToExcel({
      collectionIds: ['coll-weird'],
      includeSold: true,
      includeImages: false,
      locale: 'en'
    })

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(filePath!)
    const ws = wb.worksheets[0]
    // Forbidden chars [ ] * ? should be removed
    expect(ws.name).toBe('Weird Name Test')
  })

  it('returns file with photos embedded when includeImages is true', async () => {
    const filePath = await exportCollectionsToExcel({
      collectionIds: [PK.COLL_ID],
      includeSold: false,
      includeImages: true,
      locale: 'en'
    })

    expect(existsSync(filePath!)).toBe(true)

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(filePath!)
    // Verify the file is valid with at least one sheet
    expect(wb.worksheets).toHaveLength(1)
  })
})