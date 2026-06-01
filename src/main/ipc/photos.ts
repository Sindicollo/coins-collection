import { ipcMain, app, dialog } from 'electron'
import { join, extname } from 'path'
import { copyFileSync, mkdirSync, existsSync, unlinkSync, readFileSync } from 'fs'
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

export function registerPhotoHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PHOTO.LIST, async (_event, coinId: string): Promise<Photo[]> => {
    return photoRepo.listPhotos(coinId)
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
    async (_event, coinId: string): Promise<Photo | null> => {
      // Use Electron's dialog to pick files
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
      })

      if (result.canceled || result.filePaths.length === 0) return null

      const photosDir = getPhotosDir()
      const photos: Photo[] = []

      for (const filePath of result.filePaths) {
        const ext = filePath.split('.').pop()?.toLowerCase() ?? 'jpg'
        const filename = `${uuidv4()}.${ext}`
        const destPath = join(photosDir, filename)

        copyFileSync(filePath, destPath)

        const photo = photoRepo.createPhoto({
          coinId,
          filename,
          originalName: filePath.split('/').pop() ?? filePath
        })
        photos.push(photo)
      }

      return photos[0] // Return first for simplicity; caller can fetch all
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
