// Backup & Restore shared types

export interface BackupManifest {
  version: number
  appVersion: string
  exportedAt: number
  stats: {
    collections: number
    coins: number
    photos: number
  }
}

export interface BackupPreview {
  manifest: BackupManifest
  isNewerThanLocal: boolean
  localStats: {
    collections: number
    coins: number
    photos: number
  } | null
}

export interface ImportResult {
  success: boolean
  imported: {
    collections: number
    coins: number
    photos: number
  }
  updated: {
    collections: number
    coins: number
    photos: number
  }
  errors: string[]
}

export interface ExportProgress {
  stage: 'reading' | 'copying-photos' | 'archiving' | 'done'
  current: number
  total: number
  message: string
}

export interface ImportProgress {
  stage: 'extracting' | 'importing-collections' | 'importing-coins' | 'importing-photos' | 'copying-files' | 'finalizing' | 'done'
  current: number
  total: number
  message: string
}
