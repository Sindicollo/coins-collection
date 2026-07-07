import React from 'react'
import { useTranslation } from 'react-i18next'
import type { BackupPreview } from '@shared/types'
import type { ProgressData } from '@/features/backup/ProgressModal'

interface UseBackupActionsReturn {
  importDialogOpen: boolean
  setImportDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  preview: BackupPreview | null
  setPreview: React.Dispatch<React.SetStateAction<BackupPreview | null>>
  error: string | null
  setError: React.Dispatch<React.SetStateAction<string | null>>
  progressOpen: boolean
  progressTitle: string
  progress: ProgressData | null
  setProgress: React.Dispatch<React.SetStateAction<ProgressData | null>>
  setProgressOpen: React.Dispatch<React.SetStateAction<boolean>>
  handleExport: () => Promise<void>
  handleImportClick: () => Promise<void>
  handleImportExecute: () => Promise<void>
  importZipPathRef: React.MutableRefObject<string | null>
}

export function useBackupActions(logPrefix: string): UseBackupActionsReturn {
  const { t } = useTranslation()

  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [preview, setPreview] = React.useState<BackupPreview | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const importZipPathRef = React.useRef<string | null>(null)

  const [progressOpen, setProgressOpen] = React.useState(false)
  const [progressTitle, setProgressTitle] = React.useState('')
  const [progress, setProgress] = React.useState<ProgressData | null>(null)

  const unsubscribeRef = React.useRef<(() => void) | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>()
  const mountedRef = React.useRef(true)

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      unsubscribeRef.current?.()
      clearTimeout(timerRef.current)
    }
  }, [])

  const handleExport = React.useCallback(async () => {
    setError(null)
    setProgressTitle(t('backup.exportProgress'))
    setProgressOpen(true)
    setProgress(null)

    unsubscribeRef.current = window.api.backup.onExportProgress((data) => {
      if (mountedRef.current) setProgress(data)
    })

    try {
      await window.api.backup.exportExecute()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`${logPrefix} Export failed:`, message)
      if (mountedRef.current) {
        setError(message || t('backup.exportFailed'))
      }
    } finally {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
      if (mountedRef.current) {
        timerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setProgressOpen(false)
            setProgress(null)
          }
        }, 1500)
      }
    }
  }, [t, logPrefix])

  const handleImportClick = React.useCallback(async () => {
    setError(null)
    try {
      const zipPath = await window.api.backup.importSelect()
      if (!zipPath) return

      setImportDialogOpen(true)

      const previewData = await window.api.backup.importPreview(zipPath)
      if (mountedRef.current) {
        setPreview(previewData)
        importZipPathRef.current = zipPath
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`${logPrefix} Import preview failed:`, message)
      if (mountedRef.current) {
        setError(message || t('backup.importPreviewFailed'))
        setImportDialogOpen(false)
      }
    }
  }, [t, logPrefix])

  const handleImportExecute = React.useCallback(async () => {
    const zipPath = importZipPathRef.current
    if (!zipPath) return

    setError(null)
    setImportDialogOpen(false)
    setPreview(null)
    setProgressTitle(t('backup.importProgress'))
    setProgressOpen(true)
    setProgress(null)

    unsubscribeRef.current = window.api.backup.onImportProgress((data) => {
      if (mountedRef.current) setProgress(data)
    })

    try {
      const result = await window.api.backup.importExecute(zipPath)
      if (!result.success || result.errors.length > 0) {
        console.error(`${logPrefix} Import completed with errors:`, result.errors)
        if (mountedRef.current) {
          setError(result.errors.join('\n') || t('backup.importFailed'))
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`${logPrefix} Import failed:`, message)
      if (mountedRef.current) {
        setError(message || t('backup.importFailed'))
      }
    } finally {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
      importZipPathRef.current = null
      if (mountedRef.current) {
        timerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setProgressOpen(false)
            setProgress(null)
          }
        }, 1500)
      }
    }
  }, [t, logPrefix])

  return {
    importDialogOpen,
    setImportDialogOpen,
    preview,
    setPreview,
    error,
    setError,
    progressOpen,
    progressTitle,
    progress,
    setProgress,
    setProgressOpen,
    handleExport,
    handleImportClick,
    handleImportExecute,
    importZipPathRef
  }
}
