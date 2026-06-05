import type { ElectronAPI } from '../shared/types/electron-api'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
