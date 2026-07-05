import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import * as noteRepo from '../database/repositories/coin-notes'
import type { CoinNote, CreateCoinNoteInput, UpdateCoinNoteInput } from '@shared/types'

export function registerCoinNoteHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.NOTE.LIST,
    async (_event, coinId: string): Promise<CoinNote[]> => {
      return noteRepo.listCoinNotes(coinId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTE.GET,
    async (_event, id: string): Promise<CoinNote | null> => {
      return noteRepo.getCoinNote(id) ?? null
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTE.CREATE,
    async (_event, input: CreateCoinNoteInput): Promise<CoinNote> => {
      return noteRepo.createCoinNote(input)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTE.UPDATE,
    async (_event, input: UpdateCoinNoteInput): Promise<CoinNote | null> => {
      return noteRepo.updateCoinNote(input) ?? null
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTE.DELETE,
    async (_event, id: string): Promise<boolean> => {
      return noteRepo.deleteCoinNote(id)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTE.COUNT_BY_COIN,
    async (_event, coinId: string): Promise<number> => {
      return noteRepo.countNotesByCoin(coinId)
    }
  )
}
