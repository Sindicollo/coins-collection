import { contextBridge, ipcRenderer } from 'electron'

// Expose IPC methods to the renderer process
const api = {
  countries: {
    list: () => ipcRenderer.invoke('country:list'),
    get: (id: string) => ipcRenderer.invoke('country:get', id),
    create: (name: string) => ipcRenderer.invoke('country:create', { name }),
    update: (id: string, name: string) => ipcRenderer.invoke('country:update', { id, name }),
    delete: (id: string) => ipcRenderer.invoke('country:delete', id)
  },
  coins: {
    list: (countryId: string, cursor: string | null, limit?: number) =>
      ipcRenderer.invoke('coin:list', { countryId, cursor, limit }),
    get: (id: string) => ipcRenderer.invoke('coin:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('coin:create', data),
    update: (data: Record<string, unknown>) => ipcRenderer.invoke('coin:update', data),
    delete: (id: string) => ipcRenderer.invoke('coin:delete', id)
  },
  photos: {
    list: (coinId: string) => ipcRenderer.invoke('photo:list', coinId),
    getPath: (id: string) => ipcRenderer.invoke('photo:get-path', id),
    create: (coinId: string) => ipcRenderer.invoke('photo:create', coinId),
    delete: (id: string) => ipcRenderer.invoke('photo:delete', id),
    reorder: (coinId: string, photoIds: string[]) =>
      ipcRenderer.invoke('photo:reorder', coinId, photoIds)
  },
  preferences: {
    getCurrency: () => ipcRenderer.invoke('pref:getCurrency'),
    setCurrency: (currency: string) => ipcRenderer.invoke('pref:setCurrency', currency),
    getCurrencies: () => ipcRenderer.invoke('pref:getCurrencies')
  }
}

contextBridge.exposeInMainWorld('api', api)
