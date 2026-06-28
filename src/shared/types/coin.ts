// Coin types shared between main and renderer processes
export interface Coin {
  id: string
  collectionId: string
  denomination: string
  year: number | null
  condition: CoinCondition | null
  purchaseDate: number | null
  purchasePlace: string | null
  price: number | null
  shippingCost: number | null
  currency: string | null
  country: string | null
  composition: CoinComposition | null
  notes: string | null
  extraData: Record<string, unknown> | null
  sold: boolean
  onAuction: boolean
  auctionPrice: number | null
  salePrice: number | null
  createdAt: number
  updatedAt: number
}

export type CoinComposition = 'gold' | 'silver' | 'billon' | 'copper' | 'bronze' | 'other'

export const COIN_COMPOSITIONS: CoinComposition[] = ['gold', 'silver', 'billon', 'copper', 'bronze', 'other']

export type CoinCondition = 'UNC' | 'XF+' | 'XF' | 'VF+' | 'VF' | 'F' | 'VG' | 'G' | 'F-2' | 'F-1' | 'AUNC'

export const COIN_CONDITIONS: CoinCondition[] = ['UNC', 'AUNC', 'XF+', 'XF', 'VF+', 'VF', 'F', 'VG', 'G', 'F-2', 'F-1']

export interface CreateCoinInput {
  collectionId: string
  denomination: string
  year?: number | null
  condition?: CoinCondition | null
  composition?: CoinComposition | null
  purchaseDate?: number | null
  purchasePlace?: string | null
  price?: number | null
  shippingCost?: number | null
  currency?: string | null
  country?: string | null
  notes?: string | null
  extraData?: Record<string, unknown> | null
  sold?: boolean
  onAuction?: boolean
  auctionPrice?: number | null
  salePrice?: number | null
}

export interface UpdateCoinInput extends Partial<CreateCoinInput> {
  id: string
}
