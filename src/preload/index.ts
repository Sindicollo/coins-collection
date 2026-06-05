import { contextBridge, ipcRenderer } from 'electron'

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
    listCountries: () => ipcRenderer.invoke('coin:listCountries')
  },
  photos: {
    list: (coinId: string) => ipcRenderer.invoke('photo:list', coinId),
    getPhotoData: (id: string) => ipcRenderer.invoke('photo:get-path', id),
    create: (coinId: string) => ipcRenderer.invoke('photo:create', coinId) as Promise<unknown[]>,
    delete: (id: string) => ipcRenderer.invoke('photo:delete', id),
    reorder: (coinId: string, photoIds: string[]) =>
      ipcRenderer.invoke('photo:reorder', coinId, photoIds)
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
      countryOverrides: Record<string, string>
      downloadPhotos: boolean
    }) => ipcRenderer.invoke('import:execute', args),
    executeNoYear: (args: {
      filePath: string
      countryOverrides: Record<string, string>
      downloadPhotos: boolean
    }) => ipcRenderer.invoke('import:execute-no-year', args)
  },
  prices: {
    exportAll: (collectionId: string) => ipcRenderer.invoke('price:exportAll', collectionId),
    importPrices: () => ipcRenderer.invoke('price:importPrices')
  }
}

contextBridge.exposeInMainWorld('api', api)
