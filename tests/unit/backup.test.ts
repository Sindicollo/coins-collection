/**
 * Unit tests for backup/export/import services.
 *
 * These focus on edge cases, error handling, and individual behaviors
 * that are not covered by the integration roundtrip tests.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'
import AdmZip from 'adm-zip'
import { createDatabaseAt, closeDatabase, getDatabase } from '../../src/main/database'
import { exportBackup } from '../../src/main/export/backup'
import { previewBackup, importBackup } from '../../src/main/import/backup'
import { uuidv4 } from '../../src/main/database/repositories/uuid'

// ---- Helpers ----

function getRowCount(db: Database.Database, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }
  return row.c
}

function initTestDb(dbPath: string): void {
  try { closeDatabase() } catch { /* ignore */ }
  const temp = createDatabaseAt(dbPath)
  temp.close()
  getDatabase(dbPath)
}

// ---- Test suite ----

let testRoot: string
let photosDir: string

beforeEach(() => {
  const id = uuidv4().slice(0, 8)
  testRoot = join(tmpdir(), `coin-unit-${id}`)
  mkdirSync(testRoot, { recursive: true })
  photosDir = join(testRoot, 'photos')
  mkdirSync(photosDir, { recursive: true })
  // Create a dummy JPEG for photo tests
  writeFileSync(join(photosDir, 'dummy.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
})

afterEach(() => {
  try { closeDatabase() } catch { /* ignore */ }
  try { rmSync(testRoot, { recursive: true, force: true }) } catch { /* ignore */ }
})

describe('previewBackup', () => {
  it('rejects ZIP without manifest.json', () => {
    const zip = new AdmZip()
    zip.addFile('README.txt', Buffer.from('hello'))
    const zipPath = join(testRoot, 'no-manifest.zip')
    zip.writeZip(zipPath)

    expect(() => previewBackup(zipPath)).toThrow('missing manifest.json')
  })

  it('rejects unsupported backup version', () => {
    const zip = new AdmZip()
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({ version: 99, appVersion: '1.0', exportedAt: 0, stats: { collections: 0, coins: 0, photos: 0 } })))
    const zipPath = join(testRoot, 'bad-version.zip')
    zip.writeZip(zipPath)

    expect(() => previewBackup(zipPath)).toThrow('Unsupported backup version')
  })

  it('returns valid preview for correct backup', () => {
    // Set up a real DB so getLocalStats() works
    const dbPath = join(testRoot, 'preview-db.sqlite')
    initTestDb(dbPath)

    const now = Date.now()
    const zip = new AdmZip()
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({
      version: 1,
      appVersion: '1.2.3',
      exportedAt: now,
      stats: { collections: 5, coins: 42, photos: 99 }
    })))
    const zipPath = join(testRoot, 'valid-manifest.zip')
    zip.writeZip(zipPath)

    const preview = previewBackup(zipPath)
    expect(preview.manifest.version).toBe(1)
    expect(preview.manifest.appVersion).toBe('1.2.3')
    expect(preview.manifest.exportedAt).toBe(now)
    expect(preview.manifest.stats.collections).toBe(5)
    expect(preview.manifest.stats.coins).toBe(42)
    expect(preview.manifest.stats.photos).toBe(99)
  })
})

describe('exportBackup', () => {
  it('includes preferences.json when preferences exist', async () => {
    const dbPath = join(testRoot, 'prefs-export.sqlite')
    initTestDb(dbPath)

    const db = new Database(dbPath)
    db.prepare("INSERT OR REPLACE INTO preferences (key, value) VALUES ('currency', 'EUR')").run()
    db.prepare("INSERT OR REPLACE INTO preferences (key, value) VALUES ('theme', 'dark')").run()
    db.close()

    const zipPath = join(testRoot, 'prefs.zip')
    await exportBackup(zipPath, { photosDir, tmpBaseDir: testRoot, appVersion: 'test' })

    const zip = new AdmZip(zipPath)
    const prefs = JSON.parse(zip.getEntry('preferences.json')!.getData().toString('utf-8'))
    expect(prefs.currency).toBe('EUR')
    expect(prefs.theme).toBe('dark')
  })

  it('exports null fields as null in coins JSON', async () => {
    const dbPath = join(testRoot, 'nulls-export.sqlite')
    initTestDb(dbPath)

    const db = new Database(dbPath)
    db.prepare('INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run('coll-null', 'Test', Date.now(), Date.now())
    db.prepare(
      `INSERT INTO coins (id, collection_id, denomination, year, condition,
        purchase_date, purchase_place, price, shipping_cost, currency, country,
        notes, extra_data, sold, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'coin-null', 'coll-null', 'Test Coin', null, null,
      null, null, null, null, null, 'Russia',
      null, null, 0, Date.now(), Date.now()
    )
    db.close()

    const zipPath = join(testRoot, 'nulls.zip')
    await exportBackup(zipPath, { photosDir, tmpBaseDir: testRoot, appVersion: 'test' })

    const zip = new AdmZip(zipPath)
    const coins = JSON.parse(zip.getEntry('coins.json')!.getData().toString('utf-8'))
    const coin = coins[0]
    expect(coin.year).toBeNull()
    expect(coin.condition).toBeNull()
    expect(coin.price).toBeNull()
    expect(coin.country).toBe('Russia')
  })

  it('exports coins with sold=true correctly', async () => {
    const dbPath = join(testRoot, 'sold-export.sqlite')
    initTestDb(dbPath)

    const db = new Database(dbPath)
    db.prepare('INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run('coll-sold', 'Test', Date.now(), Date.now())
    db.prepare(
      `INSERT INTO coins (id, collection_id, denomination, year, condition,
        purchase_date, purchase_place, price, shipping_cost, currency, country,
        notes, extra_data, sold, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'coin-sold', 'coll-sold', 'Sold Coin', 2000, 'UNC',
      Date.now(), 'Auction', 100, 5, 'USD', 'USA',
      null, null, 1, Date.now(), Date.now()
    )
    db.close()

    const zipPath = join(testRoot, 'sold.zip')
    await exportBackup(zipPath, { photosDir, tmpBaseDir: testRoot, appVersion: 'test' })

    const zip = new AdmZip(zipPath)
    const coins = JSON.parse(zip.getEntry('coins.json')!.getData().toString('utf-8'))
    expect(coins[0].sold).toBe(true)
  })
})

describe('importBackup', () => {
  it('handles coins with null optional fields', async () => {
    const zip = new AdmZip()
    const manifest = { version: 1, appVersion: 'test', exportedAt: Date.now(), stats: { collections: 1, coins: 1, photos: 0 } }
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)))
    zip.addFile('collections.json', Buffer.from(JSON.stringify([{ id: 'c1', name: 'Test', createdAt: 1, updatedAt: 1 }])))
    const coinWithNulls = {
      id: 'n1', collectionId: 'c1', denomination: 'Null Coin',
      year: null, condition: null, purchaseDate: null, purchasePlace: null,
      price: null, shippingCost: null, currency: null, country: null,
      notes: null, extraData: null, sold: false, createdAt: 1, updatedAt: 1
    }
    zip.addFile('coins.json', Buffer.from(JSON.stringify([coinWithNulls])))
    zip.addFile('photos.json', Buffer.from(JSON.stringify([])))
    const zipPath = join(testRoot, 'null-import.zip')
    zip.writeZip(zipPath)

    const targetDb = join(testRoot, 'null-import.sqlite')
    const result = await importBackup(zipPath, { dbPath: targetDb, photosDir, tmpBaseDir: testRoot })

    expect(result.success).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.imported.coins).toBe(1)

    const db = new Database(targetDb)
    const coin = db.prepare('SELECT * FROM coins WHERE id = ?').get('n1') as Record<string, unknown>
    expect(coin.denomination).toBe('Null Coin')
    expect(coin.year).toBeNull()
    expect(coin.price).toBeNull()
    expect(coin.country).toBeNull()
    db.close()
  })

  it('handles coins with extra data field', async () => {
    const zip = new AdmZip()
    const manifest = { version: 1, appVersion: 'test', exportedAt: Date.now(), stats: { collections: 1, coins: 1, photos: 0 } }
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)))
    zip.addFile('collections.json', Buffer.from(JSON.stringify([{ id: 'c1', name: 'Extra', createdAt: 1, updatedAt: 1 }])))
    zip.addFile('coins.json', Buffer.from(JSON.stringify([{
      id: 'e1', collectionId: 'c1', denomination: 'Extra Coin',
      year: 2000, condition: 'UNC', purchaseDate: null, purchasePlace: null,
      price: 100, shippingCost: null, currency: 'USD', country: 'USA',
      notes: 'test note', extraData: '{"weight":"10g"}', sold: false,
      createdAt: 1, updatedAt: 1
    }])))
    zip.addFile('photos.json', Buffer.from(JSON.stringify([])))
    const zipPath = join(testRoot, 'extra-import.zip')
    zip.writeZip(zipPath)

    const targetDb = join(testRoot, 'extra-import.sqlite')
    const result = await importBackup(zipPath, { dbPath: targetDb, photosDir, tmpBaseDir: testRoot })

    expect(result.success).toBe(true)
    const db = new Database(targetDb)
    const coin = db.prepare('SELECT * FROM coins WHERE id = ?').get('e1') as Record<string, unknown>
    // notes are now migrated to coin_notes table (column still exists in schema but unused)
    expect(coin.notes).toBeNull()
    const note = db.prepare('SELECT * FROM coin_notes WHERE coin_id = ?').get('e1') as Record<string, unknown> | undefined
    expect(note).toBeDefined()
    expect(note!.content).toBe('test note')
    expect(coin.extra_data).toBe('{"weight":"10g"}')
    db.close()
  })

  it('handles duplicate coin IDs gracefully (INSERT OR IGNORE)', async () => {
    const zip = new AdmZip()
    const manifest = { version: 1, appVersion: 'test', exportedAt: Date.now(), stats: { collections: 1, coins: 1, photos: 0 } }
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)))
    zip.addFile('collections.json', Buffer.from(JSON.stringify([{ id: 'c1', name: 'Test', createdAt: 1, updatedAt: 1 }])))
    zip.addFile('coins.json', Buffer.from(JSON.stringify([
      { id: 'dup1', collectionId: 'c1', denomination: 'Dup Coin', year: 2000, condition: null, purchaseDate: null, purchasePlace: null, price: null, shippingCost: null, currency: null, country: null, notes: null, extraData: null, sold: false, createdAt: 1, updatedAt: 1 }
    ])))
    zip.addFile('photos.json', Buffer.from(JSON.stringify([])))
    const zipPath = join(testRoot, 'dup-coins.zip')
    zip.writeZip(zipPath)

    const targetDb = join(testRoot, 'dup-import.sqlite')
    // First import
    const r1 = await importBackup(zipPath, { dbPath: targetDb, photosDir, tmpBaseDir: testRoot })
    expect(r1.success).toBe(true)
    expect(r1.imported.coins).toBe(1)

    // Second import of same data — OR IGNORE silently skips duplicate
    const r2 = await importBackup(zipPath, { dbPath: targetDb, photosDir, tmpBaseDir: testRoot })
    expect(r2.success).toBe(true)
    expect(r2.imported.coins).toBe(0)
    expect(r2.errors).toEqual([])

    // Still only 1 coin
    const db = new Database(targetDb)
    expect(getRowCount(db, 'coins')).toBe(1)
    db.close()
  })

  it('copies photo files and skips same-size duplicates', async () => {
    // Create source photo with known size
    const photoContent = Buffer.from('test-photo-content-abc-123')
    const photoDir1 = join(testRoot, 'photo-src')
    mkdirSync(photoDir1, { recursive: true })
    writeFileSync(join(photoDir1, 'pic.jpg'), photoContent)

    // Set up DB with collection + coin + photo
    const srcDb = join(testRoot, 'photo-src.sqlite')
    initTestDb(srcDb)
    const db = new Database(srcDb)
    db.prepare('INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run('pcoll', 'Photo Test', 1, 1)
    db.prepare(
      `INSERT INTO coins (id, collection_id, denomination, year, condition,
        purchase_date, purchase_place, price, shipping_cost, currency, country,
        notes, extra_data, sold, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('pcoin', 'pcoll', 'Photo Coin', 2000, 'UNC', 1, null, 100, null, 'USD', 'USA', null, null, 0, 1, 1)
    db.prepare('INSERT INTO photos (id, coin_id, filename, original_name, position, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('ph1', 'pcoin', 'pic.jpg', 'orig.jpg', 0, 1)
    db.close()

    // Export with the photo
    const zipPath = join(testRoot, 'photo-export.zip')
    await exportBackup(zipPath, { photosDir: photoDir1, tmpBaseDir: testRoot, appVersion: 'test' })

    // Import into target — should copy the photo
    const targetDir = join(testRoot, 'photo-dst')
    mkdirSync(targetDir, { recursive: true })
    const targetDb = join(testRoot, 'photo-dst.sqlite')

    const result1 = await importBackup(zipPath, { dbPath: targetDb, photosDir: targetDir, tmpBaseDir: testRoot })
    expect(result1.success).toBe(true)
    expect(existsSync(join(targetDir, 'pic.jpg'))).toBe(true)

    // Import again — should skip because same size (conflict logic)
    const result2 = await importBackup(zipPath, { dbPath: targetDb, photosDir: targetDir, tmpBaseDir: testRoot })
    expect(result2.success).toBe(true)
    // No errors about photo copy
    expect(result2.errors.filter((e) => e.includes('photo')).length).toBe(0)
  })
})
