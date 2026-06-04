import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import * as coinRepo from '../database/repositories/coins'
import type { CreateCoinInput, UpdateCoinInput, PaginatedResult, Coin } from '@shared/types'

interface CoinListArgs {
  collectionId: string
  cursor: string | null
  limit?: number
}

export function registerCoinHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.COIN.LIST,
    async (_event, args: CoinListArgs): Promise<PaginatedResult<Coin>> => {
      return coinRepo.listCoins(args.collectionId, args.cursor, args.limit)
    }
  )

  ipcMain.handle(IPC_CHANNELS.COIN.GET, async (_event, id: string): Promise<Coin | null> => {
    return coinRepo.getCoin(id) ?? null
  })

  ipcMain.handle(
    IPC_CHANNELS.COIN.CREATE,
    async (_event, input: CreateCoinInput): Promise<Coin> => {
      return coinRepo.createCoin(input)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.COIN.UPDATE,
    async (_event, input: UpdateCoinInput): Promise<Coin | null> => {
      return coinRepo.updateCoin(input) ?? null
    }
  )

  ipcMain.handle(IPC_CHANNELS.COIN.DELETE, async (_event, id: string): Promise<boolean> => {
    return coinRepo.deleteCoin(id)
  })

  ipcMain.handle(
    IPC_CHANNELS.COIN.LIST_DISTINCT_COUNTRIES,
    async (): Promise<string[]> => {
      return coinRepo.listDistinctCountries()
    }
  )
}
