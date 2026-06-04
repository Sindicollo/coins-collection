import { ipcMain, app, dialog } from 'electron'
import { join, extname } from 'path'
import { copyFileSync, mkdirSync, existsSync, unlinkSync, readFileSync, openSync, readSync, closeSync } from 'fs'
import { IPC_CHANNELS } from '@shared/constants'
import * as photoRepo from '../database/repositories/photos'
import type { Photo } from '@shared/types'
import { uuidv4 } from '../database/repositories/uuid'

function getPhotosDir(): string {
  const dir = join(app.getPath('userData'), 'photos')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

const IMAGE_MAGIC: Array<{ bytes: number[]; offset: number; ext: string }> = [
  { bytes: [0xFF, 0xD8, 0xFF], offset: 0, ext: 'jpg' },
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0, ext: 'png' },
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, ext: 'webp' } // RIFF...WEBP checked below
]

function isValidImage(filePath: string): string | null {
  try {
    const fd = openSync(filePath, 'r')
    const buf = Buffer.alloc(12)
    readSync(fd, buf, 0, 12, 0)
    closeSync(fd)

    for (const magic of IMAGE_MAGIC) {
      const match = buf.subarray(magic.offset, magic.offset + magic.bytes.length).equals(Buffer.from(magic.bytes))
      if (!match) continue
      // WebP needs extra check at offset 8
      if (magic.ext === 'webp') {
        return buf.subarray(8, 12).toString() === 'WEBP' ? 'webp' : null
      }
      return magic.ext
    }
    return null
  } catch {
    return null
  }
}

export function registerPhotoHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PHOTO.LIST, async (_event, coinId: string): Promise<Photo[]> => {
    try {
      return photoRepo.listPhotos(coinId)
    } catch (err) {
      console.error('[photos] Failed to list photos:', err)
      return []
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.PHOTO.GET_PATH,
    async (_event, id: string): Promise<string | null> => {
      const filename = photoRepo.getPhotoPath(id)
      if (!filename) return null
      const filePath = join(getPhotosDir(), filename)
      try {
        if (!existsSync(filePath)) return null
        const data = readFileSync(filePath)
        const ext = extname(filename).toLowerCase()
        const mimeType =
          ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
        return `data:${mimeType};base64,${data.toString('base64')}`
      } catch {
        return null
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PHOTO.CREATE,
    async (_event, coinId: string): Promise<Photo[]> => {
      // Use Electron's dialog to pick files
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
      })

      if (result.canceled || result.filePaths.length === 0) return []

      const photosDir = getPhotosDir()
      const photos: Photo[] = []

      for (const filePath of result.filePaths) {
        const detected = isValidImage(filePath)
        if (!detected) {
          console.warn(`[photos] Skipping non-image file: ${filePath}`)
          continue
        }
        const filename = `${uuidv4()}.${detected}`
        const destPath = join(photosDir, filename)

        copyFileSync(filePath, destPath)

        const photo = photoRepo.createPhoto({
          coinId,
          filename,
          originalName: filePath.split('/').pop() ?? filePath
        })
        photos.push(photo)
      }

      return photos
    }
  )

  ipcMain.handle(IPC_CHANNELS.PHOTO.DELETE, async (_event, id: string): Promise<boolean> => {
    const filename = photoRepo.getPhotoPath(id)
    if (!filename) return false

    const filePath = join(getPhotosDir(), filename)
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    } catch {
      // Ignore file deletion errors
    }

    return photoRepo.deletePhoto(id)
  })

  ipcMain.handle(
    IPC_CHANNELS.PHOTO.REORDER,
    async (_event, coinId: string, photoIds: string[]): Promise<void> => {
      photoRepo.reorderPhotos(coinId, photoIds)
    }
  )
}
