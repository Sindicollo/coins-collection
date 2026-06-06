/**
 * Integration tests for export → import roundtrip
 *
 * These tests create temp SQLite databases, export them to ZIP,
 * import into fresh databases, and verify data integrity.
 * The real database is never touched.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { join } from 'path'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'
import AdmZip from 'adm-zip'
import { createDatabaseAt, closeDatabase, getDatabase } from '../../src/main/database'
import { exportBackup } from '../../src/main/export/backup'
import { importBackup } from '../../src/main/import/backup'
import { uuidv4 } from '../../src/main/database/repositories/uuid'

// ---- Helpers ----

function createDummyImage(dir: string, filename: string): void {
  // Minimal valid JPEG (3x1 pixels)
  const minimalJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
    0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
    0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
    0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
    0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
    0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3f, 0x00, 0xd2, 0xff, 0xd9
  ])
  writeFileSync(join(dir, filename), minimalJpeg)
}

function getRowCount(db: Database.Database, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }
  return row.c
}

/**
 * Initialize the DB singleton with a fresh database at the given path.
 * Creates the file, runs migrations, then reopens via the singleton.
 */
function initTestDb(dbPath: string): void {
  // Close any previous singleton
  try { closeDatabase() } catch { /* ignore */ }

  // Create fresh DB with migrations
  const temp = createDatabaseAt(dbPath)
  // Close the temporary connection (singleton will reopen it)
  temp.close()

  // Now set the singleton to this DB path
  getDatabase(dbPath)
}

// ---- Test suite ----

let testRoot: string
let sourceDbPath: string
let sourcePhotosDir: string
let targetDbPath: string
let targetPhotosDir: string

beforeAll(() => {
  // Create unique temp directories per test run
  const runId = uuidv4()
  testRoot = join(tmpdir(), `coin-test-${runId}`)
  mkdirSync(testRoot, { recursive: true })

  sourceDbPath = join(testRoot, 'source.sqlite')
  sourcePhotosDir = join(testRoot, 'source-photos')
  mkdirSync(sourcePhotosDir, { recursive: true })

  targetDbPath = join(testRoot, 'target.sqlite')
  targetPhotosDir = join(testRoot, 'target-photos')
  mkdirSync(targetPhotosDir, { recursive: true })

  // Pre-create dummy images
  createDummyImage(sourcePhotosDir, 'photo1.jpg')
  createDummyImage(sourcePhotosDir, 'photo2.jpg')
})

afterAll(() => {
  try { closeDatabase() } catch { /* ignore */ }
  try { rmSync(testRoot, { recursive: true, force: true }) } catch { /* ignore */ }
})

afterEach(() => {
  // Reset singleton after each test
  try { closeDatabase() } catch { /* ignore */ }
})

describe('Export → Import roundtrip', () => {
  const collId1 = '11111111-1111-1111-1111-111111111111'
  const collId2 = '22222222-2222-2222-2222-222222222222'
  const coinId1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const coinId2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  const photoId1 = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  const photoId2 = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

  it('exports data to ZIP and imports it back with data integrity', async () => {
    // Init source database
    initTestDb(sourceDbPath)
    const sourceDb = new Database(sourceDbPath)

    const now = Date.now()

    // Insert collections
    sourceDb.prepare(
      'INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(collId1, 'Ancient Coins', now, now)
    sourceDb.prepare(
      'INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(collId2, 'Modern Coins', now + 1, now + 1)

    // Insert coins
    sourceDb.prepare(
      `INSERT INTO coins
       (id, collection_id, denomination, year, condition, purchase_date,
        purchase_place, price, shipping_cost, currency, country, notes,
        extra_data, sold, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      coinId1, collId1, 'Denarius', -44, 'VF+', now, 'Auction', 150.0, 10.0,
      'EUR', 'Rome', 'Silver coin', null, 0, now, now
    )
    sourceDb.prepare(
      `INSERT INTO coins
       (id, collection_id, denomination, year, condition, purchase_date,
        purchase_place, price, shipping_cost, currency, country, notes,
        extra_data, sold, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      coinId2, collId2, '1 рубль', 1990, 'UNC', now, 'Shop', 500.0, 0.0,
      'RUB', 'Russia', null, null, 0, now, now
    )

    // Insert photo metadata
    sourceDb.prepare(
      'INSERT INTO photos (id, coin_id, filename, original_name, position, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(photoId1, coinId1, 'photo1.jpg', 'coin-photo-1.jpg', 0, now)
    sourceDb.prepare(
      'INSERT INTO photos (id, coin_id, filename, original_name, position, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(photoId2, coinId2, 'photo2.jpg', 'coin-photo-2.jpg', 1, now)

    // Insert preferences
    sourceDb.prepare(
      'INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)'
    ).run('currency', 'USD')

    sourceDb.close()

    // Export to ZIP
    const zipPath = join(testRoot, 'backup.zip')
    await exportBackup(zipPath, {
      photosDir: sourcePhotosDir,
      tmpBaseDir: testRoot,
      appVersion: 'test-1.0.0'
    })

    expect(existsSync(zipPath)).toBe(true)

    // Verify ZIP contents
    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries().map((e) => e.entryName)

    expect(entries).toContain('manifest.json')
    expect(entries).toContain('collections.json')
    expect(entries).toContain('coins.json')
    expect(entries).toContain('photos.json')
    expect(entries).toContain('preferences.json')
    expect(entries).toContain('photos/photo1.jpg')
    expect(entries).toContain('photos/photo2.jpg')

    // Verify manifest
    const manifest = JSON.parse(
      zip.getEntry('manifest.json')!.getData().toString('utf-8')
    )
    expect(manifest.version).toBe(1)
    expect(manifest.appVersion).toBe('test-1.0.0')
    expect(manifest.stats.collections).toBe(2)
    expect(manifest.stats.coins).toBe(2)
    expect(manifest.stats.photos).toBe(2)

    // Verify JSON data
    const collections = JSON.parse(
      zip.getEntry('collections.json')!.getData().toString('utf-8')
    )
    expect(collections.length).toBe(2)

    const coins = JSON.parse(
      zip.getEntry('coins.json')!.getData().toString('utf-8')
    )
    expect(coins.length).toBe(2)
    const coin1 = coins.find((c: { id: string }) => c.id === coinId1)
    expect(coin1.denomination).toBe('Denarius')
    expect(coin1.country).toBe('Rome')
    expect(coin1.price).toBe(150.0)

    // Import into fresh target database
    const result = await importBackup(zipPath, {
      dbPath: targetDbPath,
      photosDir: targetPhotosDir,
      tmpBaseDir: testRoot
    })

    expect(result.success).toBe(true)
    expect(result.imported.collections).toBe(2)
    expect(result.imported.coins).toBe(2)
    expect(result.imported.photos).toBe(2)
    expect(result.errors).toEqual([])

    // Verify target database matches source
    const targetDb = new Database(targetDbPath)
    targetDb.pragma('foreign_keys = ON')

    expect(getRowCount(targetDb, 'collections')).toBe(2)
    const targetCols = targetDb
      .prepare('SELECT * FROM collections ORDER BY id')
      .all() as Array<{ id: string; name: string }>
    expect(targetCols[0].name).toBe('Ancient Coins')
    expect(targetCols[1].name).toBe('Modern Coins')

    expect(getRowCount(targetDb, 'coins')).toBe(2)
    const targetCoin1 = targetDb
      .prepare('SELECT * FROM coins WHERE id = ?')
      .get(coinId1) as Record<string, unknown>
    expect(targetCoin1.denomination).toBe('Denarius')
    expect(targetCoin1.condition).toBe('VF+')
    expect(targetCoin1.price).toBe(150.0)
    expect(targetCoin1.currency).toBe('EUR')
    expect(targetCoin1.country).toBe('Rome')

    expect(getRowCount(targetDb, 'photos')).toBe(2)
    expect(existsSync(join(targetPhotosDir, 'photo1.jpg'))).toBe(true)
    expect(existsSync(join(targetPhotosDir, 'photo2.jpg'))).toBe(true)

    targetDb.close()
    try { rmSync(zipPath) } catch { /* ignore */ }
  })

  it('merge: updates existing records and adds new ones', async () => {
    const mergeDbPath = join(testRoot, 'merge-source.sqlite')
    const mergeTargetPath = join(testRoot, 'merge-target.sqlite')
    const mergePhotosDir = join(testRoot, 'merge-photos')
    mkdirSync(mergePhotosDir, { recursive: true })

    const mergeCollId = 'mergemerge-coll-coll-coll-coll0001'
    const mergeCoinIdOld = 'mergemerge-coin-coin-coin-old0001'
    const mergeCoinIdNew = 'mergemerge-coin-coin-coin-new0001'
    const now = Date.now()

    // Create first source
    initTestDb(mergeDbPath)
    const db1 = new Database(mergeDbPath)
    db1.prepare(
      'INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(mergeCollId, 'Original Name', now, now)
    db1.prepare(
      `INSERT INTO coins (id, collection_id, denomination, year, condition,
        purchase_date, purchase_place, price, shipping_cost, currency, country,
        notes, extra_data, sold, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      mergeCoinIdOld, mergeCollId, 'Old Denom', 2000, 'F',
      now, null, 10.0, null, 'RUB', 'Russia', null, null, 0, now, now
    )
    db1.close()

    // Export first version
    const zipPath1 = join(testRoot, 'merge-backup-1.zip')
    await exportBackup(zipPath1, {
      photosDir: sourcePhotosDir,
      tmpBaseDir: testRoot,
      appVersion: 'test-1.0.0'
    })

    // Import into target (first time)
    const r1 = await importBackup(zipPath1, {
      dbPath: mergeTargetPath,
      photosDir: mergePhotosDir,
      tmpBaseDir: testRoot
    })
    expect(r1.success).toBe(true)
    expect(r1.imported.collections).toBe(1)
    expect(r1.imported.coins).toBe(1)

    // Now modify the source: rename collection, add new coin
    // Re-open source and apply changes
    try { closeDatabase() } catch { /* ignore */ }
    getDatabase(mergeDbPath) // reopen singleton
    const db2 = new Database(mergeDbPath)
    db2.prepare('UPDATE collections SET name = ?, updated_at = ? WHERE id = ?')
      .run('Updated Name', now + 1000, mergeCollId)
    db2.prepare(
      `INSERT INTO coins (id, collection_id, denomination, year, condition,
        purchase_date, purchase_place, price, shipping_cost, currency, country,
        notes, extra_data, sold, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      mergeCoinIdNew, mergeCollId, 'New Denom', 2020, 'UNC',
      now + 1000, null, 50.0, null, 'USD', 'USA', null, null, 0, now + 1000, now + 1000
    )
    db2.close()

    // Re-export
    const zipPath2 = join(testRoot, 'merge-backup-2.zip')
    await exportBackup(zipPath2, {
      photosDir: sourcePhotosDir,
      tmpBaseDir: testRoot,
      appVersion: 'test-1.0.0'
    })

    // Import into same target (merge)
    const r2 = await importBackup(zipPath2, {
      dbPath: mergeTargetPath,
      photosDir: mergePhotosDir,
      tmpBaseDir: testRoot
    })
    expect(r2.success).toBe(true)
    expect(r2.updated.collections).toBe(1)
    expect(r2.imported.coins).toBe(1) // new coin
    expect(r2.updated.coins).toBeGreaterThanOrEqual(1) // old coin updated

    // Verify target
    const finalDb = new Database(mergeTargetPath)
    finalDb.pragma('foreign_keys = ON')

    const col = finalDb.prepare('SELECT * FROM collections WHERE id = ?')
      .get(mergeCollId) as { name: string }
    expect(col.name).toBe('Updated Name')

    expect(getRowCount(finalDb, 'coins')).toBe(2)

    const oldCoin = finalDb.prepare('SELECT * FROM coins WHERE id = ?')
      .get(mergeCoinIdOld) as { denomination: string }
    expect(oldCoin.denomination).toBe('Old Denom')

    const newCoin = finalDb.prepare('SELECT * FROM coins WHERE id = ?')
      .get(mergeCoinIdNew) as { denomination: string }
    expect(newCoin.denomination).toBe('New Denom')

    finalDb.close()

    // Cleanup
    try { rmSync(mergeDbPath) } catch { /* ignore */ }
    try { rmSync(mergeTargetPath) } catch { /* ignore */ }
    try { rmSync(mergePhotosDir, { recursive: true, force: true }) } catch { /* ignore */ }
    try { rmSync(zipPath1) } catch { /* ignore */ }
    try { rmSync(zipPath2) } catch { /* ignore */ }
  })

  it('handles empty database export and import', async () => {
    const emptyDbPath = join(testRoot, 'empty.sqlite')

    // Create empty database
    initTestDb(emptyDbPath)

    const zipPath = join(testRoot, 'empty-backup.zip')
    await exportBackup(zipPath, {
      photosDir: sourcePhotosDir,
      tmpBaseDir: testRoot,
      appVersion: 'test-1.0.0'
    })

    expect(existsSync(zipPath)).toBe(true)

    const emptyTargetDbPath = join(testRoot, 'empty-target.sqlite')
    const emptyTargetPhotos = join(testRoot, 'empty-target-photos')
    mkdirSync(emptyTargetPhotos, { recursive: true })

    const result = await importBackup(zipPath, {
      dbPath: emptyTargetDbPath,
      photosDir: emptyTargetPhotos,
      tmpBaseDir: testRoot
    })

    expect(result.success).toBe(true)
    expect(result.imported.collections).toBe(0)
    expect(result.imported.coins).toBe(0)
    expect(result.imported.photos).toBe(0)

    // Verify empty target
    const targetDb = new Database(emptyTargetDbPath)
    expect(getRowCount(targetDb, 'collections')).toBe(0)
    expect(getRowCount(targetDb, 'coins')).toBe(0)
    expect(getRowCount(targetDb, 'photos')).toBe(0)
    targetDb.close()

    // Cleanup
    try { rmSync(emptyDbPath) } catch { /* ignore */ }
    try { rmSync(emptyTargetDbPath) } catch { /* ignore */ }
    try { rmSync(emptyTargetPhotos, { recursive: true, force: true }) } catch { /* ignore */ }
    try { rmSync(zipPath) } catch { /* ignore */ }
  })
})
