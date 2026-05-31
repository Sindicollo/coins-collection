import type { Coin, CreateCoinInput, UpdateCoinInput, PaginatedResult } from '@shared/types'
import { PAGE_SIZE } from '@shared/constants'

export interface FetchCoinsParams {
  countryId: string
  cursor: string | null
  limit?: number
}

export async function fetchCoins(params: FetchCoinsParams): Promise<PaginatedResult<Coin>> {
  return window.api.coins.list(params.countryId, params.cursor, params.limit ?? PAGE_SIZE)
}

export async function getCoin(id: string): Promise<Coin | null> {
  return window.api.coins.get(id)
}

export async function createCoin(input: CreateCoinInput): Promise<Coin> {
  return window.api.coins.create(input)
}

export async function updateCoin(input: UpdateCoinInput): Promise<Coin | null> {
  return window.api.coins.update(input)
}

export async function deleteCoin(id: string): Promise<boolean> {
  return window.api.coins.delete(id)
}
