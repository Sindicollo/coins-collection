import { contextBridge, ipcRenderer } from 'electron'
import type { DropFileInput } from '@shared/types/photo'
import type { CreateCoinNoteInput, UpdateCoinNoteInput } from '@shared/types'

// Expose IPC methods to the renderer process
const api = {
  collections: {
    list: () => ipcRenderer.invoke('collection:list'),
    get: (id: string) => ipcRenderer.invoke('collection:get', id),
    create: (name: string) => ipcRenderer.invoke('collection:create', { name }),
    update: (id: string, name: string) => ipcRenderer.invoke('collection:update', { id, name }),
    delete: (id: string) => ipcRenderer.invoke('collection:delete', id)
  },
  coins: {
    list: (collectionId: string, cursor: string | null, limit?: number) =>
      ipcRenderer.invoke('coin:list', { collectionId, cursor, limit }),
    get: (id: string) => ipcRenderer.invoke('coin:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('coin:create', data),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('coin:update', data),
    delete: (id: string) => ipcRenderer.invoke('coin:delete', id),
    listCountries: () => ipcRenderer.invoke('coin:listCountries'),
    totalCost: (collectionId: string) => ipcRenderer.invoke('coin:totalCost', collectionId)
  },
  notes: {
    list: (coinId: string) => ipcRenderer.invoke('note:list', coinId),
    get: (id: string) => ipcRenderer.invoke('note:get', id),
    create: (input: CreateCoinNoteInput) => ipcRenderer.invoke('note:create', input),
    update: (input: UpdateCoinNoteInput) => ipcRenderer.invoke('note:update', input),
    delete: (id: string) => ipcRenderer.invoke('note:delete', id),
    countByCoin: (coinId: string) => ipcRenderer.invoke('note:countByCoin', coinId)
  },
  photos: {
    list: (coinId: string) => ipcRenderer.invoke('photo:list', coinId),
    getPhotoData: (id: string) => ipcRenderer.invoke('photo:get-path', id),
    create: (coinId: string) => ipcRenderer.invoke('photo:create', coinId) as Promise<unknown[]>,
    createFromPaths: (coinId: string, filePaths: string[]) =>
      ipcRenderer.invoke('photo:create-from-paths', coinId, filePaths) as Promise<unknown[]>,
    createFromFiles: (coinId: string, files: DropFileInput[]) =>
      ipcRenderer.invoke('photo:create-from-files', coinId, files) as Promise<unknown[]>,
    delete: (id: string) => ipcRenderer.invoke('photo:delete', id),
    reorder: (coinId: string, photoIds: string[]) =>
      ipcRenderer.invoke('photo:reorder', coinId, photoIds),
    save: (id: string) => ipcRenderer.invoke('photo:save', id)
  },
  preferences: {
    getCurrency: () => ipcRenderer.invoke('pref:getCurrency'),
    setCurrency: (currency: string) => ipcRenderer.invoke('pref:setCurrency', currency),
    getCurrencies: () => ipcRenderer.invoke('pref:getCurrencies')
  },
  import: {
    selectFile: () => ipcRenderer.invoke('import:select-file'),
    preview: (filePath: string) => ipcRenderer.invoke('import:preview', filePath),
    execute: (args: {
      filePath: string
      collectionOverrides: Record<string, string>
      downloadPhotos: boolean
    }) => ipcRenderer.invoke('import:execute', args),
    executeNoYear: (args: {
      filePath: string
      collectionOverrides: Record<string, string>
      downloadPhotos: boolean
    }) => ipcRenderer.invoke('import:execute-no-year', args)
  },
  llm: {
    getExportData: (collectionId: string) => ipcRenderer.invoke('llm:getExportData', collectionId),
    exportAll: (collectionId: string) => ipcRenderer.invoke('llm:exportAll', collectionId),
    importInfo: () => ipcRenderer.invoke('llm:importInfo'),
    queryBulk: (query: Record<string, unknown>) => ipcRenderer.invoke('llm:query-bulk', query),
    querySingle: (query: Record<string, unknown>) => ipcRenderer.invoke('llm:query-single', query),
    getConfig: () => ipcRenderer.invoke('llm:get-config'),
    setConfig: (config: Record<string, unknown>) => ipcRenderer.invoke('llm:set-config', config),
    testConnection: (config?: Record<string, unknown>) => ipcRenderer.invoke('llm:test-connection', config),
    onBulkProgress: (callback: (data: Record<string, unknown>) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: Record<string, unknown>) => callback(data)
      ipcRenderer.on('llm:bulk-progress', handler)
      return () => ipcRenderer.removeListener('llm:bulk-progress', handler)
    },
    cancelBulk: (collectionId: string) => ipcRenderer.invoke('llm:cancel-bulk', collectionId)
  },
  backup: {
    exportExecute: () => ipcRenderer.invoke('backup:export-execute'),
    importSelect: () => ipcRenderer.invoke('backup:import-select'),
    importPreview: (zipPath: string) => ipcRenderer.invoke('backup:import-preview', zipPath),
    importExecute: (zipPath: string) => ipcRenderer.invoke('backup:import-execute', zipPath),
    onExportProgress: (callback: (data: { stage: string; current: number; total: number; message: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { stage: string; current: number; total: number; message: string }) => callback(data)
      ipcRenderer.on('backup:export-progress', handler)
      return () => ipcRenderer.removeListener('backup:export-progress', handler)
    },
    onImportProgress: (callback: (data: { stage: string; current: number; total: number; message: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { stage: string; current: number; total: number; message: string }) => callback(data)
      ipcRenderer.on('backup:import-progress', handler)
      return () => ipcRenderer.removeListener('backup:import-progress', handler)
    }
  },
  export: {
    excel: (options: { collectionIds: string[]; includeSold: boolean; includeImages: boolean }) =>
      ipcRenderer.invoke('export:excel', options) as Promise<string | null>,
    pdf: (options: { collectionIds: string[]; includeSold: boolean; includeImages: boolean; includePurchaseInfo: boolean; locale: string }) =>
      ipcRenderer.invoke('export:pdf', options) as Promise<string | null>,
    onProgress: (callback: (data: { stage: string; current: number; total: number; message: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { stage: string; current: number; total: number; message: string }) => callback(data)
      ipcRenderer.on('export:progress', handler)
      return () => ipcRenderer.removeListener('export:progress', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
