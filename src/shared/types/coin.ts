// Coin types shared between main and renderer processes
export interface Coin {
  id: string
  countryId: string
  denomination: string
  year: number | null
  condition: CoinCondition | null
  purchaseDate: number | null
  purchasePlace: string | null
  price: number | null
  shippingCost: number | null
  currency: string | null
  notes: string | null
  extraData: Record<string, unknown> | null
  createdAt: number
  updatedAt: number
}

export type CoinCondition = 'UNC' | 'XF' | 'VF' | 'F' | 'VG' | 'G' | 'F-2' | 'F-1'

export const COIN_CONDITIONS: CoinCondition[] = ['UNC', 'XF', 'VF', 'F', 'VG', 'G', 'F-2', 'F-1']

export interface CreateCoinInput {
  countryId: string
  denomination: string
  year?: number | null
  condition?: CoinCondition | null
  purchaseDate?: number | null
  purchasePlace?: string | null
  price?: number | null
  shippingCost?: number | null
  currency?: string | null
  notes?: string | null
  extraData?: Record<string, unknown> | null
}

export interface UpdateCoinInput extends Partial<CreateCoinInput> {
  id: string
}
