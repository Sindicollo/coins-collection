export * from './collection'
export * from './coin'
export * from './coin-note'
export * from './photo'
export * from './electron-api'
export * from './backup'
export * from './llm'

export interface PaginatedResult<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

export interface LlmExportCoin {
  id: string
  country: string | null
  denomination: string
  year: number | null
  condition: string | null
  composition: string | null
}

export interface ErrorResult {
  error: string
}

export type Result<T> = { success: true; data: T } | { success: false; error: string }
