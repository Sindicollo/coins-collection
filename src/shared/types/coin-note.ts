// Coin Note types — shared between main and renderer processes

export interface CoinNote {
  id: string
  coinId: string
  title: string | null
  content: string
  createdAt: number
  updatedAt: number
}

export interface CreateCoinNoteInput {
  coinId: string
  title?: string | null
  content: string
}

export interface UpdateCoinNoteInput {
  id: string
  title?: string | null
  content?: string
}
