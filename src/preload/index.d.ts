import type { ElectronAPI } from '../preload/index'

declare global {
  interface Window {
    api: typeof import('../preload/index').api
  }
}

export interface ElectronAPI {
  countries: {
    list: () => Promise<Array<Record<string, unknown>>>
    get: (id: string) => Promise<Record<string, unknown> | null>
    create: (name: string) => Promise<Record<string, unknown>>
    update: (id: string, name: string) => Promise<Record<string, unknown> | null>
    delete: (id: string) => Promise<boolean>
  }
  coins: {
    list: (
      countryId: string,
      cursor: string | null,
      limit?: number
    ) => Promise<{ items: Array<Record<string, unknown>>; nextCursor: string | null; hasMore: boolean }>
    get: (id: string) => Promise<Record<string, unknown> | null>
    create: (data: Record<string, unknown>) => Promise<Record<string, unknown>>
    update: (data: Record<string, unknown>) => Promise<Record<string, unknown> | null>
    delete: (id: string) => Promise<boolean>
  }
  photos: {
    list: (coinId: string) => Promise<Array<Record<string, unknown>>>
    getPhotoData: (id: string) => Promise<string | null>
    create: (coinId: string) => Promise<Record<string, unknown> | null>
    delete: (id: string) => Promise<boolean>
    reorder: (coinId: string, photoIds: string[]) => Promise<void>
  }
  preferences: {
    getCurrency: () => Promise<string>
    setCurrency: (currency: string) => Promise<string>
    getCurrencies: () => Promise<Array<{ code: string; symbol: string; name: string }>>
  }
}
