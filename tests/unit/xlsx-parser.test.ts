import { describe, it, expect } from 'vitest'
import {
  parseSpreadsheet,
  detectColumns,
  parseCoinRow,
  extractSheetImages
} from '../../src/main/import/xlsx-parser'

const TEST_FILE = '/Users/alexey/Documents/coins photo/shillings.xlsx'

describe('xlsx-parser', () => {
  describe('parseSpreadsheet', () => {
    it('reads all sheets from the xlsx file', () => {
      const data = parseSpreadsheet(TEST_FILE)
      expect(data.sheets.length).toBe(3)
      expect(data.sheets[0].name).toBe('shillings')
      expect(data.sheets[1].name).toBe('3 pences')
      expect(data.sheets[2].name).toBe('прочее')
    })

    it('parses data rows from shillings sheet', () => {
      const data = parseSpreadsheet(TEST_FILE)
      const sheet = data.sheets[0]
      expect(sheet.rows.length).toBeGreaterThan(0)
      // First data row should have year 1696
      const firstRow = sheet.rows[0]
      expect(firstRow.cells[0].value).toBe(1696)
    })

    it('extracts hyperlinks from shillings sheet', () => {
      const data = parseSpreadsheet(TEST_FILE)
      const sheet = data.sheets[0]
      // Should have hyperlinks
      expect(sheet.hyperlinks.size).toBeGreaterThan(0)
      // Check one specific link exists
      const firstLink = sheet.hyperlinks.values().next().value
      expect(firstLink).toContain('photos.google.com')
    })

    it('associates hyperlinks with correct rows', () => {
      const data = parseSpreadsheet(TEST_FILE)
      const sheet = data.sheets[0]
      // Row with year 1816 should have photo links in G and H
      const row1816 = sheet.rows.find((r) => r.cells[0].value === 1816)
      expect(row1816).toBeDefined()
      // Should have hyperlinks in its map
      expect(row1816!.hyperlinks.size).toBe(2) // G and H columns
    })
  })

  describe('detectColumns', () => {
    it('detects standard columns (shillings)', () => {
      const data = parseSpreadsheet(TEST_FILE)
      const mapping = detectColumns(data.sheets[0])
      expect(mapping.year).toBe(0) // Col A = Год
      expect(mapping.price).toBe(1) // Col B = Цена
      expect(mapping.shippingCost).toBe(2) // Col C = Доставка
      expect(mapping.totalCost).toBe(3) // Col D = Общая стоимость
      expect(mapping.purchaseDate).toBe(4) // Col E = Дата покупки
      expect(mapping.comments).toBe(5) // Col F = Комментарии
      expect(mapping.denomination).toBe(-1) // No denomination column
      expect(mapping.photoColumns.length).toBeGreaterThan(0) // Has photo columns
    })

    it('detects columns with Номинал (прочее)', () => {
      const data = parseSpreadsheet(TEST_FILE)
      const mapping = detectColumns(data.sheets[2])
      expect(mapping.denomination).toBe(0) // Col A = Номинал
      expect(mapping.year).toBe(1) // Col B = Год
      expect(mapping.price).toBe(2) // Col C = Цена
    })
  })

  describe('parseCoinRow', () => {
    it('parses a row with full data', () => {
      const data = parseSpreadsheet(TEST_FILE)
      const sheet = data.sheets[0]
      const mapping = detectColumns(sheet)
      // Row for year 1816 (has hyperlinks)
      const row1816 = sheet.rows.find((r) => r.cells[0].value === 1816)
      expect(row1816).toBeDefined()

      const coin = parseCoinRow(row1816!, mapping, 'shillings')
      expect(coin.year).toBe(1816)
      expect(coin.price).toBe(724.67)
      expect(coin.shippingCost).toBe(463.79)
      expect(coin.purchasePlace).toBe('ebay')
      expect(coin.denomination).toBe('1816 год')
      expect(coin.photoUrls.length).toBe(2)
    })

    it('parses purchase place from comments', () => {
      const data = parseSpreadsheet(TEST_FILE)
      const sheet = data.sheets[0]
      const mapping = detectColumns(sheet)
      const row1758 = sheet.rows.find((r) => r.cells[0].value === 1758)
      expect(row1758).toBeDefined()

      const coin = parseCoinRow(row1758!, mapping, 'shillings')
      expect(coin.purchasePlace).toBe('ebay')
      expect(coin.notes).toBe('GBP 9.95 + 4')
    })

    it('handles rows without purchase data', () => {
      const data = parseSpreadsheet(TEST_FILE)
      const sheet = data.sheets[0]
      const mapping = detectColumns(sheet)
      const row1818 = sheet.rows.find((r) => r.cells[0].value === 1818)
      expect(row1818).toBeDefined()

      const coin = parseCoinRow(row1818!, mapping, 'shillings')
      expect(coin.year).toBe(1818)
      expect(coin.price).toBeNull()
      expect(coin.purchaseDate).toBeNull()
    })

    it('uses denomination from sheet if available (прочее)', () => {
      const data = parseSpreadsheet(TEST_FILE)
      const sheet = data.sheets[2]
      const mapping = detectColumns(sheet)
      const firstRow = sheet.rows[0]

      const coin = parseCoinRow(firstRow, mapping, 'прочее')
      expect(coin.denomination).not.toBe('')
      expect(coin.denomination).not.toMatch(/^\d+ год$/)
    })
  })

  describe('extractSheetImages', () => {
    it('extracts embedded images from shillings sheet', () => {
      const images = extractSheetImages(TEST_FILE, 0, 2)
      // shillings has images in columns K and L
      expect(images.extractable.length).toBeGreaterThan(0)
      // Check that image paths look valid
      const first = images.extractable[0]
      expect(first.path).toMatch(/^xl\/media\/image\d+\.\w+$/)
    })

    it('maps images to rows', () => {
      const images = extractSheetImages(TEST_FILE, 0, 2)
      // At least one row should have images
      expect(images.imageMap.size).toBeGreaterThan(0)
    })
  })
})
