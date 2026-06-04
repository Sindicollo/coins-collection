import type { ElectronAPI } from '../preload/index'

declare global {
  interface Window {
    api: typeof import('../preload/index').api
  }
}

export interface ElectronAPI {
  collections: {
    list: () => Promise<Array<Record<string, unknown>>>
    get: (id: string) => Promise<Record<string, unknown> | null>
    create: (name: string) => Promise<Record<string, unknown>>
    update: (id: string, name: string) => Promise<Record<string, unknown> | null>
    delete: (id: string) => Promise<boolean>
  }
  coins: {
    list: (
      collectionId: string,
      cursor: string | null,
      limit?: number
    ) => Promise<{ items: Array<Record<string, unknown>>; nextCursor: string | null; hasMore: boolean }>
    get: (id: string) => Promise<Record<string, unknown> | null>
    create: (data: Record<string, unknown>) => Promise<Record<string, unknown>>
    update: (data: Record<string, unknown>) => Promise<Record<string, unknown> | null>
    delete: (id: string) => Promise<boolean>
    listCountries: () => Promise<string[]>
  }
  photos: {
    list: (coinId: string) => Promise<Array<Record<string, unknown>>>
    getPhotoData: (id: string) => Promise<string | null>
    create: (coinId: string) => Promise<Array<Record<string, unknown>>>
    delete: (id: string) => Promise<boolean>
    reorder: (coinId: string, photoIds: string[]) => Promise<void>
  }
  preferences: {
    getCurrency: () => Promise<string>
    setCurrency: (currency: string) => Promise<string>
    getCurrencies: () => Promise<Array<{ code: string; symbol: string; name: string }>>
  }
  import: {
    selectFile: () => Promise<string | null>
    preview: (filePath: string) => Promise<{
      filePath: string
      sheets: Array<{
        name: string
        coinCount: number
        photoCount: number
        embeddedPhotoCount: number
        sampleRows: Array<{
          year: number | null
          denomination: string
          price: number | null
          shippingCost: number | null
          purchaseDate: number | null
          purchasePlace: string | null
          notes: string | null
          photoUrls: string[]
          embeddedImages: Array<{
            rowIndex: number
            colIndex: number
            imagePath: string
          }>
        }>
      }>
    }>
    execute: (args: {
      filePath: string
      countryOverrides: Record<string, string>
      downloadPhotos: boolean
    }) => Promise<{
      countriesCreated: number
      countriesSkipped: number
      coinsCreated: number
      photosImported: number
      errors: string[]
    }>
  }
  prices: {
    exportAll: (collectionId: string) => Promise<string | null>
    importPrices: () => Promise<{
      updated: number
      skipped: number
      filePath: string
    } | null>
  }
}
