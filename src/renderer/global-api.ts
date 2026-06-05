// Type declarations for window.api exposed by the preload script
/* eslint-disable @typescript-eslint/no-explicit-any */

interface ElectronAPI {
  collections: {
    list: () => Promise<any[]>
    get: (id: string) => Promise<any>
    create: (name: string) => Promise<any>
    update: (id: string, name: string) => Promise<any>
    delete: (id: string) => Promise<boolean>
  }
  coins: {
    list: (collectionId: string, cursor: string | null, limit?: number) => Promise<{ items: any[]; nextCursor: string | null; hasMore: boolean }>
    get: (id: string) => Promise<any>
    create: (data: Record<string, unknown>) => Promise<any>
    update: (data: Record<string, unknown>) => Promise<any>
    delete: (id: string) => Promise<boolean>
    listCountries: () => Promise<string[]>
  }
  photos: {
    list: (coinId: string) => Promise<any[]>
    getPhotoData: (id: string) => Promise<string | null>
    create: (coinId: string) => Promise<any[]>
    delete: (id: string) => Promise<boolean>
    reorder: (coinId: string, photoIds: string[]) => Promise<void>
  }
  preferences: {
    getCurrency: () => Promise<string>
    setCurrency: (currency: string) => Promise<string>
    getCurrencies: () => Promise<any[]>
  }
  import: {
    selectFile: () => Promise<string | null>
    preview: (filePath: string) => Promise<any>
    execute: (args: Record<string, unknown>) => Promise<any>
    executeNoYear: (args: Record<string, unknown>) => Promise<any>
  }
  prices: {
    exportAll: (collectionId: string) => Promise<string | null>
    importPrices: () => Promise<any>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
