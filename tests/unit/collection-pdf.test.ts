/**
 * Unit tests for collection-pdf.ts — pure helper functions.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest'

// Mock heavy dependencies that are imported at module load time
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => '/tmp/test-' + name),
    getAppPath: vi.fn(() => '/app'),
    isPackaged: false
  }
}))

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    flatten: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('FAKE'))
  }))
}))

vi.mock('../database/repositories/collections', () => ({
  getCollection: vi.fn(),
  listCollections: vi.fn()
}))

vi.mock('../database/repositories/coins', () => ({
  listCoinsByCollection: vi.fn()
}))

vi.mock('../database/repositories/photos', () => ({
  listPhotos: vi.fn()
}))

// Module under test — imports after mocks are set up
import {
  buildCoinMainLine,
  buildCoinDetailLines,
  buildPurchaseLine
} from '../../src/main/export/collection-pdf'
import type { Coin } from '@shared/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fullCoin: Coin = {
  id: 'coin-1',
  collectionId: 'coll-1',
  denomination: '1 Shilling',
  year: 1946,
  condition: 'XF',
  country: 'United Kingdom',
  notes: 'Minor toning on reverse',
  purchaseDate: 946684800000,
  purchasePlace: 'eBay',
  price: 12.5,
  shippingCost: 2.0,
  currency: 'GBP',
  extraData: null,
  sold: false,
  onAuction: false,
  auctionPrice: null,
  salePrice: null,
  createdAt: 1000,
  updatedAt: 1000,
  composition: 'other'
}

const minimalCoin: Coin = {
  id: 'coin-2',
  collectionId: 'coll-1',
  denomination: '1 Penny',
  year: null,
  condition: null,
  country: null,
  notes: null,
  purchaseDate: null,
  purchasePlace: null,
  price: null,
  shippingCost: null,
  currency: null,
  extraData: null,
  sold: false,
  onAuction: false,
  auctionPrice: null,
  salePrice: null,
  createdAt: 1001,
  updatedAt: 1001,
  composition: 'other'
}

const soldCoin: Coin = {
  ...fullCoin,
  id: 'coin-3',
  sold: true,
  purchaseDate: null,
  purchasePlace: null,
  price: null,
  shippingCost: null,
  salePrice: null
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildCoinMainLine', () => {
  it('happy path — builds main line with denomination, year', () => {
    const result = buildCoinMainLine(fullCoin, 'en')
    expect(result).toMatch(/Denomination: 1 Shilling/)
    expect(result).toMatch(/1946/)
  })

  it('includes sold label for sold coins', () => {
    const result = buildCoinMainLine(soldCoin, 'en')
    expect(result).toContain('Sold')
  })

  it('edge case — minimal coin with no year shows only denomination', () => {
    const result = buildCoinMainLine(minimalCoin, 'en')
    expect(result).toContain('Denomination: 1 Penny')
    expect(result).not.toContain('(Sold)')
  })

  it('uses Russian locale', () => {
    const result = buildCoinMainLine(fullCoin, 'ru')
    expect(result).toContain('Номинал')
  })
})

describe('buildCoinDetailLines', () => {
  it('happy path — returns all present fields', () => {
    const lines = buildCoinDetailLines(fullCoin, 'en')
    expect(lines).toEqual([
      'Country: United Kingdom',
      'Condition: XF',
      'Notes: Minor toning on reverse'
    ])
  })

  it('edge case — minimal coin returns empty array', () => {
    const lines = buildCoinDetailLines(minimalCoin, 'en')
    expect(lines).toEqual([])
  })

  it('uses Russian locale', () => {
    const lines = buildCoinDetailLines(fullCoin, 'ru')
    expect(lines[0]).toBe('Страна: United Kingdom')
    expect(lines[1]).toBe('Состояние: XF')
    expect(lines[2]).toBe('Заметки: Minor toning on reverse')
  })
})

describe('buildPurchaseLine', () => {
  it('happy path — includes price, shipping, date, place', () => {
    const result = buildPurchaseLine(fullCoin, 'en')
    expect(result).toContain('Price: 12.5 GBP')
    expect(result).toContain('Shipping: 2')
    expect(result).toContain('Purchase Date')
    expect(result).toContain('eBay')
  })

  it('edge case — no purchase info returns null', () => {
    const result = buildPurchaseLine(minimalCoin, 'en')
    expect(result).toBeNull()
  })

  it('edge case — sold coin with no purchase data returns null', () => {
    const result = buildPurchaseLine(soldCoin, 'en')
    expect(result).toBeNull()
  })

  it('uses Russian locale', () => {
    const result = buildPurchaseLine(fullCoin, 'ru')
    expect(result).toContain('Цена')
    expect(result).toContain('Доставка')
    expect(result).toContain('Дата покупки')
    expect(result).toContain('Место покупки')
  })
})
