import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import * as collectionRepo from '../database/repositories/collections'
import type { CreateCollectionInput, UpdateCollectionInput } from '@shared/types'

export function registerCollectionHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.COLLECTION.LIST, async () => {
    return collectionRepo.listCollections()
  })

  ipcMain.handle(IPC_CHANNELS.COLLECTION.GET, async (_event, id: string) => {
    return collectionRepo.getCollection(id) ?? null
  })

  ipcMain.handle(IPC_CHANNELS.COLLECTION.CREATE, async (_event, input: CreateCollectionInput) => {
    return collectionRepo.createCollection(input)
  })

  ipcMain.handle(IPC_CHANNELS.COLLECTION.UPDATE, async (_event, input: UpdateCollectionInput) => {
    return collectionRepo.updateCollection(input) ?? null
  })

  ipcMain.handle(IPC_CHANNELS.COLLECTION.DELETE, async (_event, id: string) => {
    return collectionRepo.deleteCollection(id)
  })
}
