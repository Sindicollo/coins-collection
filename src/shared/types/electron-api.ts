/* eslint-disable @typescript-eslint/no-explicit-any */
// Single source of truth for the preload bridge API shape.
// Used by both renderer (global-api.ts) and preload (index.d.ts) type declarations.

import type { DropFileInput } from './photo'
import type { LlmExportCoin, AiCoinInfo, AiBulkQuery, AiSingleQuery, LlmConfig, LlmTestResult } from './index'

export interface ElectronAPI {
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
    totalCost: (collectionId: string) => Promise<Array<{ currency: string; total: number; coinCount: number }>>
  }
  photos: {
    list: (coinId: string) => Promise<any[]>
    getPhotoData: (id: string) => Promise<string | null>
    create: (coinId: string) => Promise<any[]>
    createFromPaths: (coinId: string, filePaths: string[]) => Promise<any[]>
    createFromFiles: (coinId: string, files: DropFileInput[]) => Promise<any[]>
    delete: (id: string) => Promise<boolean>
    reorder: (coinId: string, photoIds: string[]) => Promise<void>
    save: (id: string) => Promise<string | null>
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
  llm: {
    getExportData: (collectionId: string) => Promise<LlmExportCoin[]>
    exportAll: (collectionId: string) => Promise<string | null>
    importInfo: () => Promise<any>
    queryBulk: (query: AiBulkQuery) => Promise<AiCoinInfo[]>
    querySingle: (query: AiSingleQuery) => Promise<AiCoinInfo>
    getConfig: () => Promise<LlmConfig>
    setConfig: (config: LlmConfig) => Promise<void>
    testConnection: (config?: LlmConfig) => Promise<LlmTestResult>
  }
  backup: {
    exportExecute: () => Promise<string | null>
    importSelect: () => Promise<string | null>
    importPreview: (zipPath: string) => Promise<any>
    importExecute: (zipPath: string) => Promise<any>
    onExportProgress: (callback: (data: { stage: string; current: number; total: number; message: string }) => void) => () => void
    onImportProgress: (callback: (data: { stage: string; current: number; total: number; message: string }) => void) => () => void
  }
  export: {
    excel: (options: { collectionIds: string[]; includeSold: boolean; includeImages: boolean; locale: string }) => Promise<string | null>
    pdf: (options: { collectionIds: string[]; includeSold: boolean; includeImages: boolean; includePurchaseInfo: boolean; locale: string }) => Promise<string | null>
    onProgress: (callback: (data: { stage: string; current: number; total: number; message: string }) => void) => () => void
  }
}
