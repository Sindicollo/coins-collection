/**
 * Unit tests for common.ts — shared export utilities.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mock references
const mockGetCollection = vi.hoisted(() => vi.fn())
const mockListCoinsByCollection = vi.hoisted(() => vi.fn())
const mockListPhotos = vi.hoisted(() => vi.fn())
const mockListCoinNotes = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => `/tmp/coin-export-test-${name}`)
  }
}))

// Mock better-sqlite3 so repository modules don't crash at load time
vi.mock('better-sqlite3', () => {
  const mockDb = {
    pragma: vi.fn(),
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn()
    })),
    close: vi.fn()
  }
  return { default: vi.fn(() => mockDb) }
})

// Mock the database module — prevents lazy require('electron') from being called
vi.mock('../../src/main/database', () => ({
  getDatabase: vi.fn()
}))

// Mock the barrel that common.ts imports from
vi.mock('../../src/main/database/repositories', () => ({
  getCollection: mockGetCollection,
  listCoinsByCollection: mockListCoinsByCollection,
  listPhotos: mockListPhotos,
  listCoinNotes: mockListCoinNotes
}))

// Also mock the direct import of coin-notes
vi.mock('../../src/main/database/repositories/coin-notes', () => ({
  listCoinNotes: mockListCoinNotes
}))

import { buildExportFilename, collectExportData } from '../../src/main/export/common'

// ---------------------------------------------------------------------------
// buildExportFilename
// ---------------------------------------------------------------------------

describe('buildExportFilename', () => {
  it('returns a filename with the given extension', () => {
    const name = buildExportFilename('test-prefix', 'pdf')
    expect(name).toMatch(/\.pdf$/)
  })

  it('starts with the given prefix', () => {
    const name = buildExportFilename('my-export', 'xlsx')
    expect(name).toMatch(/^my-export-/)
  })

  it('includes an ISO-8601-like timestamp', () => {
    const name = buildExportFilename('test', 'pdf')
    // Pattern: 2026-06-09T22-30-29
    expect(name).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)
  })
})

// ---------------------------------------------------------------------------
// collectExportData
// ---------------------------------------------------------------------------

describe('collectExportData', () => {
  beforeEach(() => {
    mockGetCollection.mockReset()
    mockListCoinsByCollection.mockReset()
    mockListPhotos.mockReset()
    mockListCoinNotes.mockReset().mockReturnValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns data for valid collections, skipping missing ones', async () => {
    mockGetCollection
      .mockReturnValueOnce({ id: 'c1', name: 'Coll 1', createdAt: 0, updatedAt: 0 })
      .mockReturnValueOnce(undefined) // missing — should be skipped
      .mockReturnValueOnce({ id: 'c3', name: 'Coll 3', createdAt: 0, updatedAt: 0 })

    mockListCoinsByCollection
      .mockReturnValueOnce([{ id: 'coin-1', denomination: '1$', sold: false }])
      .mockReturnValueOnce([{ id: 'coin-2', denomination: '50c', sold: true }])

    const result = await collectExportData({
      collectionIds: ['c1', 'nonexistent', 'c3'],
      includeSold: true,
      includeImages: false
    })

    expect(result).toHaveLength(2)
    expect(result[0].collection.id).toBe('c1')
    expect(result[1].collection.id).toBe('c3')
  })

  it('filters sold coins when includeSold is false', async () => {
    mockGetCollection.mockReturnValue({ id: 'c1', name: 'Test', createdAt: 0, updatedAt: 0 })
    mockListCoinsByCollection.mockReturnValue([
      { id: 'a', denomination: 'Coin A', sold: false },
      { id: 'b', denomination: 'Coin B', sold: true },
      { id: 'c', denomination: 'Coin C', sold: false }
    ])

    const result = await collectExportData({
      collectionIds: ['c1'],
      includeSold: false,
      includeImages: false
    })

    expect(result[0].coins).toHaveLength(2)
    expect(result[0].coins.map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('loads photos when includeImages is true', async () => {
    mockGetCollection.mockReturnValue({ id: 'c1', name: 'Test', createdAt: 0, updatedAt: 0 })
    mockListCoinsByCollection.mockReturnValue([
      { id: 'coin-a', denomination: 'A', sold: false }
    ])
    mockListPhotos.mockReturnValue([
      { id: 'p1', coinId: 'coin-a', filename: 'a.jpg', position: 0 }
    ])

    const result = await collectExportData({
      collectionIds: ['c1'],
      includeSold: true,
      includeImages: true
    })

    const photos = result[0].photosMap.get('coin-a')
    expect(photos).toBeDefined()
    expect(photos).toHaveLength(1)
    expect(photos![0].filename).toBe('a.jpg')
  })

  it('does not load photos when includeImages is false', async () => {
    mockGetCollection.mockReturnValue({ id: 'c1', name: 'Test', createdAt: 0, updatedAt: 0 })
    mockListCoinsByCollection.mockReturnValue([
      { id: 'coin-a', denomination: 'A', sold: false }
    ])
    mockListPhotos.mockRejectedValue(new Error('should not be called'))

    const result = await collectExportData({
      collectionIds: ['c1'],
      includeSold: true,
      includeImages: false
    })

    expect(result[0].photosMap.size).toBe(0)
    expect(mockListPhotos).not.toHaveBeenCalled()
  })

  it('handles empty collectionIds array', async () => {
    const result = await collectExportData({
      collectionIds: [],
      includeSold: true,
      includeImages: false
    })

    expect(result).toEqual([])
    expect(mockGetCollection).not.toHaveBeenCalled()
  })

  it('calls onProgress for each collection', async () => {
    mockGetCollection
      .mockReturnValueOnce({ id: 'c1', name: 'First', createdAt: 0, updatedAt: 0 })
      .mockReturnValueOnce({ id: 'c2', name: 'Second', createdAt: 0, updatedAt: 0 })

    mockListCoinsByCollection.mockReturnValue([])

    const onProgress = vi.fn()

    await collectExportData({
      collectionIds: ['c1', 'c2'],
      includeSold: true,
      includeImages: false,
      onProgress
    })

    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenNthCalledWith(
      1, 'Preparing', 1, 2, 'Collection: First'
    )
    expect(onProgress).toHaveBeenNthCalledWith(
      2, 'Preparing', 2, 2, 'Collection: Second'
    )
  })
})
