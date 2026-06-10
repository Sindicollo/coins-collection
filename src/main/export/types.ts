import type { Collection, Coin, Photo } from '@shared/types'

export type ProgressCallback = (
  stage: string,
  current: number,
  total: number,
  message: string
) => void

export interface CollectOptions {
  collectionIds: string[]
  includeSold: boolean
  includeImages: boolean
  onProgress?: ProgressCallback
}

export interface CollectedCollection {
  collection: Collection
  coins: Coin[]
  photosMap: Map<string, Photo[]>
}
