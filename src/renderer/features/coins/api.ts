import type { Coin, CreateCoinInput, UpdateCoinInput, PaginatedResult } from '@shared/types'
import { PAGE_SIZE } from '@shared/constants'

interface FetchParams {
  collectionId: string
  cursor: string | null
  limit?: number
}

export async function fetchCoins(params: FetchParams): Promise<PaginatedResult<Coin>> {
  return window.api.coins.list(params.collectionId, params.cursor, params.limit ?? PAGE_SIZE)
}

export async function getCoin(id: string): Promise<Coin | null> {
  return window.api.coins.get(id)
}

export async function createCoin(input: CreateCoinInput): Promise<Coin> {
  return window.api.coins.create(input as unknown as Record<string, unknown>)
}

export async function updateCoin(input: UpdateCoinInput): Promise<Coin | null> {
  return window.api.coins.update(input as unknown as Record<string, unknown>)
}

export async function deleteCoin(id: string): Promise<boolean> {
  return window.api.coins.delete(id)
}

export async function listDistinctCountries(): Promise<string[]> {
  return window.api.coins.listCountries()
}
