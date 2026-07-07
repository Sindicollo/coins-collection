/**
 * Unit tests for collection-excel.ts — pure helper functions.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdirSync } from 'fs'
import type { Coin } from '@shared/types'

// Create mock references early so they can be shared between vi.mock factory and test code
const mockCollectExportData = vi.hoisted(() => vi.fn())
const mockGetExportTempDir = vi.hoisted(() => vi.fn())
const mockBuildExportFilename = vi.hoisted(() => vi.fn())
const mockElectronGetPath = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  app: {
    getPath: mockElectronGetPath
  }
}))

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('FAKE'))
  }))
}))

vi.mock('../../src/main/export/common', () => ({
  collectExportData: mockCollectExportData,
  getExportTempDir: mockGetExportTempDir,
  buildExportFilename: mockBuildExportFilename
}))

// Module under test
import {
  sanitizeSheetName,
  formatDate,
  buildExcelRow,
  getExtension,
  exportCollectionsToExcel
} from '../../src/main/export/collection-excel'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fullCoin: Coin = {
  id: 'coin-1',
  collectionId: 'coll-1',
  denomination: '1 рубль',
  year: 1999,
  condition: 'UNC',
  country: 'Russia',
  purchaseDate: 946684800000,
  purchasePlace: 'eBay',
  price: 50,
  shippingCost: 5,
  currency: 'RUB',
  extraData: null,
  sold: false,
  createdAt: 1000,
  updatedAt: 1000
}

const minimalCoin: Coin = {
  id: 'coin-2',
  collectionId: 'coll-1',
  denomination: '1 Penny',
  year: null,
  condition: null,
  country: null,
  purchaseDate: null,
  purchasePlace: null,
  price: null,
  shippingCost: null,
  currency: null,
  extraData: null,
  sold: false,
  createdAt: 1001,
  updatedAt: 1001
}

const soldCoin: Coin = {
  ...fullCoin,
  id: 'coin-3',
  sold: true
}

// ---------------------------------------------------------------------------
// sanitizeSheetName
// ---------------------------------------------------------------------------

describe('sanitizeSheetName', () => {
  it('removes forbidden Excel characters: [ ] : * ? \\ /', () => {
    expect(sanitizeSheetName('Weird [Name] *Test?')).toBe('Weird Name Test')
  })

  it('trims whitespace from both ends', () => {
    expect(sanitizeSheetName('  My Collection  ')).toBe('My Collection')
  })

  it('truncates to 31 characters (Excel max sheet name)', () => {
    const long = 'A Very Long Collection Name That Exceeds The Maximum Length'
    expect(sanitizeSheetName(long)).toHaveLength(31)
    expect(sanitizeSheetName(long)).toBe('A Very Long Collection Name Tha')
  })

  it('returns "Sheet" for empty or all-forbidden input', () => {
    expect(sanitizeSheetName('')).toBe('Sheet')
    expect(sanitizeSheetName('[]:*?\\/')).toBe('Sheet')
    expect(sanitizeSheetName('   ')).toBe('Sheet')
  })

  it('collapses multiple spaces into one', () => {
    expect(sanitizeSheetName('My   Collection')).toBe('My Collection')
  })
})

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('returns empty string for null', () => {
    expect(formatDate(null)).toBe('')
  })

  it('returns empty string for 0', () => {
    expect(formatDate(0)).toBe('')
  })

  it('formats a valid timestamp as YYYY-MM-DD', () => {
    // 2020-06-15 UTC
    expect(formatDate(1592179200000)).toBe('2020-06-15')
  })
})

// ---------------------------------------------------------------------------
// buildExcelRow
// ---------------------------------------------------------------------------

describe('buildExcelRow', () => {
  it('maps all coin fields correctly (happy path)', () => {
    const row = buildExcelRow(fullCoin)

    expect(row.denomination).toBe('1 рубль')
    expect(row.year).toBe(1999)
    expect(row.condition).toBe('UNC')
    expect(row.country).toBe('Russia')
    expect(row.purchaseDate).toBe('2000-01-01')
    expect(row.purchasePlace).toBe('eBay')
    expect(row.price).toBe(50)
    expect(row.shippingCost).toBe(5)
    expect(row.currency).toBe('RUB')
    expect(row.totalCost).toBe(55) // 50 + 5
    expect(row.notes).toBe('')
    expect(row.sold).toBe('')
  })

  it('handles minimal coin with null fields', () => {
    const row = buildExcelRow(minimalCoin)

    expect(row.year).toBe('')
    expect(row.condition).toBe('')
    expect(row.country).toBe('')
    expect(row.price).toBe('')
    expect(row.shippingCost).toBe('')
    expect(row.currency).toBe('')
    expect(row.notes).toBe('')
    expect(row.totalCost).toBe(0) // null + null
    expect(row.purchaseDate).toBe('')
    expect(row.purchasePlace).toBe('')
  })

  it('marks sold coin with checkmark unicode', () => {
    const row = buildExcelRow(soldCoin)
    expect(row.sold).toBe('\u2713')
  })

  it('non-sold coin has empty sold field', () => {
    const row = buildExcelRow(fullCoin)
    expect(row.sold).toBe('')
  })
})

// ---------------------------------------------------------------------------
// getExtension
// ---------------------------------------------------------------------------

describe('getExtension', () => {
  it('returns "png" for .png files', () => {
    expect(getExtension('photo.png')).toBe('png')
    expect(getExtension('image.PNG')).toBe('png')
  })

  it('returns "gif" for .gif files', () => {
    expect(getExtension('animation.gif')).toBe('gif')
    expect(getExtension('cat.GIF')).toBe('gif')
  })

  it('returns "jpeg" for .jpg files', () => {
    expect(getExtension('photo.jpg')).toBe('jpeg')
    expect(getExtension('image.JPG')).toBe('jpeg')
  })

  it('returns "jpeg" for other image extensions (webp, heic)', () => {
    expect(getExtension('photo.webp')).toBe('jpeg')
    expect(getExtension('image.heic')).toBe('jpeg')
  })
})

// ---------------------------------------------------------------------------
// exportCollectionsToExcel (with mocked collectExportData)
// ---------------------------------------------------------------------------

describe('exportCollectionsToExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockElectronGetPath.mockImplementation((name: string) =>
      join(tmpdir(), 'coin-excel-test-' + name)
    )
    const exportDir = join(tmpdir(), 'coin-excel-export')
    mockGetExportTempDir.mockReturnValue(exportDir)
    mkdirSync(exportDir, { recursive: true })
    mockBuildExportFilename.mockReturnValue('test-export.xlsx')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates a valid XLSX file with English locale headers', async () => {
    mockCollectExportData.mockResolvedValue([
      {
        collection: { id: 'c1', name: 'Test Coll', createdAt: 0, updatedAt: 0 },
        coins: [fullCoin],
        photosMap: new Map(),
        notesMap: new Map()
      }
    ])

    const filePath = await exportCollectionsToExcel({
      collectionIds: ['c1'],
      includeSold: true,
      includeImages: false,
      locale: 'en'
    })

    expect(filePath).toBeTruthy()
    expect(typeof filePath).toBe('string')
    expect(filePath).toContain('test-export.xlsx')

    // Verify headers via readback (ExcelJS can read from file)
    const { existsSync, unlinkSync } = await import('fs')
    expect(existsSync(filePath)).toBe(true)

    const ExcelJS = await import('exceljs')
    const wb = new ExcelJS.default.Workbook()
    await wb.xlsx.readFile(filePath)
    const ws = wb.worksheets[0]
    expect(ws).toBeDefined()
    expect(ws.name).toBe('Test Coll')

    const headers = (ws.getRow(1).values as Array<string | null>).filter(Boolean) as string[]
    expect(headers).toContain('Denomination')
    expect(headers).toContain('Year')
    expect(headers).toContain('Sold')
    expect(headers).not.toContain('Obverse')
    expect(headers).not.toContain('Reverse')

    // Cleanup
    unlinkSync(filePath)
  })

  it('includes Obverse/Reverse columns when includeImages is true', async () => {
    mockCollectExportData.mockResolvedValue([
      {
        collection: { id: 'c1', name: 'Test', createdAt: 0, updatedAt: 0 },
        coins: [fullCoin],
        photosMap: new Map([['coin-1', [{ id: 'p1', coinId: 'coin-1', filename: 'test.jpg', position: 0 }]]]),
        notesMap: new Map()
      }
    ])

    const filePath = await exportCollectionsToExcel({
      collectionIds: ['c1'],
      includeSold: false,
      includeImages: true,
      locale: 'en'
    })

    const ExcelJS = await import('exceljs')
    const wb = new ExcelJS.default.Workbook()
    await wb.xlsx.readFile(filePath!)
    const headers = (wb.worksheets[0].getRow(1).values as Array<string | null>)
      .filter(Boolean) as string[]

    expect(headers).toContain('Obverse')
    expect(headers).toContain('Reverse')

    const { unlinkSync } = await import('fs')
    unlinkSync(filePath!)
  })
})
