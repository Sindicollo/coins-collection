export * from './collection'
export * from './coin'
export * from './photo'
export * from './electron-api'
export * from './backup'

export interface PaginatedResult<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

export interface ErrorResult {
  error: string
}

export type Result<T> = { success: true; data: T } | { success: false; error: string }
