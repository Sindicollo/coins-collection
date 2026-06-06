import { join } from 'path'
import { existsSync, mkdirSync, copyFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import AdmZip from 'adm-zip'
import {
  getAllCollections,
  getAllCoins,
  getAllPhotos,
  getAllPreferences,
  getLocalStats
} from '../database/repositories/export'
import type { BackupManifest } from '@shared/types'
import { uuidv4 } from '../database/repositories/uuid'

export interface ExportOptions {
  /** Override the photos source directory. Defaults to app.getPath('userData')/photos. */
  photosDir?: string
  /** Override the temp directory for building the archive. Defaults to OS tmpdir. */
  tmpBaseDir?: string
  /** Override app version in manifest. Defaults to app.getVersion(). */
  appVersion?: string
  onProgress?: (stage: string, current: number, total: number, message: string) => void
  /** Called for each missing photo file so the caller can decide how to handle it */
  onMissingPhoto?: (filename: string) => void
}

function getDefaultPhotosDir(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron')
  return join(app.getPath('userData'), 'photos')
}

function getAppVersion(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron')
  return app.getVersion()
}

function createManifest(appVersion: string): BackupManifest {
  const stats = getLocalStats()
  return {
    version: 1,
    appVersion,
    exportedAt: Date.now(),
    stats
  }
}

/**
 * Export the entire database into a ZIP archive.
 * Returns the file path to the created ZIP.
 */
export async function exportBackup(
  filePath: string,
  options?: ExportOptions
): Promise<string> {
  const photosDir = options?.photosDir ?? getDefaultPhotosDir()
  const tmpBase = options?.tmpBaseDir ?? tmpdir()
  const ver = options?.appVersion ?? getAppVersion()
  const tmpDir = join(tmpBase, `coin-backup-${uuidv4()}`)
  const onProgress = options?.onProgress

  try {
    // Create temp directory
    mkdirSync(tmpDir, { recursive: true })

    // Stage 1: Read database data
    onProgress?.('reading', 0, 0, 'Reading database data...')

    const collections = getAllCollections()
    const coins = getAllCoins()
    const photos = getAllPhotos()
    const preferences = getAllPreferences()
    const manifest = createManifest(ver)

    // Stage 2: Write JSON files
    writeFileSync(join(tmpDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
    writeFileSync(join(tmpDir, 'collections.json'), JSON.stringify(collections, null, 2))
    writeFileSync(join(tmpDir, 'coins.json'), JSON.stringify(coins, null, 2))
    writeFileSync(join(tmpDir, 'photos.json'), JSON.stringify(photos, null, 2))
    writeFileSync(join(tmpDir, 'preferences.json'), JSON.stringify(preferences, null, 2))

    // Stage 3: Copy photo files
    const photosOutDir = join(tmpDir, 'photos')
    mkdirSync(photosOutDir, { recursive: true })

    let copied = 0
    const totalPhotos = photos.length
    onProgress?.('copying-photos', copied, totalPhotos, `Copying photos (${copied}/${totalPhotos})...`)

    for (const photo of photos) {
      const srcPath = join(photosDir, photo.filename)
      const destPath = join(photosOutDir, photo.filename)
      if (existsSync(srcPath)) {
        copyFileSync(srcPath, destPath)
      } else {
        options?.onMissingPhoto?.(photo.filename)
      }
      copied++
      if (copied % 10 === 0 || copied === totalPhotos) {
        onProgress?.('copying-photos', copied, totalPhotos, `Copying photos (${copied}/${totalPhotos})...`)
      }
    }

    // Stage 4: Create ZIP archive
    onProgress?.('archiving', 0, 1, 'Creating archive...')
    const zip = new AdmZip()
    zip.addLocalFolder(tmpDir)
    zip.writeZip(filePath)
    onProgress?.('done', 1, 1, 'Done!')

    return filePath
  } finally {
    // Cleanup temp directory
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
}
