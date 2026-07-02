import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { ImportDialog } from './ImportDialog'
import { ProgressModal } from './ProgressModal'
import type { ProgressData } from './ProgressModal'
import { useExportStore } from '@/features/export/useExport'
import { useExportPdfStore } from '@/features/export-pdf/useExportPdf'
import type { BackupPreview } from '@shared/types'

interface TooltipProps {
  text: string
}

function HelpTooltip({ text }: TooltipProps): React.ReactElement {
  return (
    <span className="relative group cursor-help">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[10px] leading-none text-gray-400 border border-gray-300">
        ?
      </span>
      <span className="absolute top-full left-0 mt-1.5 px-3 py-1.5 bg-gray-800 text-white text-[11px] leading-relaxed rounded shadow-lg opacity-0 invisible group-hover:opacity-85 group-hover:visible transition-all duration-150 max-w-[280px] min-w-[280px] pointer-events-none whitespace-normal z-50">
        {text}
      </span>
    </span>
  )
}

export function BackupSection(): React.ReactElement {
  const { t } = useTranslation()
  const openExportDialog = useExportStore((s) => s.openDialog)
  const openExportPdfDialog = useExportPdfStore((s) => s.openDialog)
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [preview, setPreview] = React.useState<BackupPreview | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const importZipPathRef = React.useRef<string | null>(null)

  const [progressOpen, setProgressOpen] = React.useState(false)
  const [progressTitle, setProgressTitle] = React.useState('')
  const [progress, setProgress] = React.useState<ProgressData | null>(null)

  // Refs to track subscription and timer for cleanup on unmount
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

  // Export handler
  const handleExport = React.useCallback(async () => {
    setError(null)
    setProgressTitle(t('backup.exportProgress'))
    setProgressOpen(true)
    setProgress(null)

    // Subscribe to progress
    unsubscribeRef.current = window.api.backup.onExportProgress((data) => {
      if (mountedRef.current) setProgress(data)
    })

    try {
      await window.api.backup.exportExecute()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[BackupSection] Export failed:', message)
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
  }, [t])

  // Import: select file
  const handleImportClick = React.useCallback(async () => {
    setError(null)
    try {
      const zipPath = await window.api.backup.importSelect()
      if (!zipPath) return

      // Open dialog immediately (shows loading state in ImportDialog)
      setImportDialogOpen(true)

      const previewData = await window.api.backup.importPreview(zipPath)
      if (mountedRef.current) {
        setPreview(previewData)
        // Store zipPath for later execution
        importZipPathRef.current = zipPath
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[BackupSection] Import preview failed:', message)
      if (mountedRef.current) {
        setError(message || t('backup.importPreviewFailed'))
        setImportDialogOpen(false)
      }
    }
  }, [t])

  // Import: execute
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
        console.error('[BackupSection] Import completed with errors:', result.errors)
        if (mountedRef.current) {
          setError(result.errors.join('\n') || t('backup.importFailed'))
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[BackupSection] Import failed:', message)
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
  }, [t])

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">{t('backup.title')}</h3>

        {/* Error display */}
        {error && (
          <div
            className="rounded-md bg-red-50 border border-red-200 p-2.5 text-xs text-red-700"
            role="alert"
          >
            {error}
            <button
              className="ml-2 text-red-500 hover:text-red-700 font-medium"
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        )}

        {/* Backup subsection */}
        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
            {t('backup.sectionBackup')}
            <HelpTooltip text={t('backup.sectionBackupTooltip')} />
          </h4>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleExport}>
              {t('backup.exportButton')}
            </Button>
            <Button size="sm" variant="secondary" onClick={handleImportClick}>
              {t('backup.importButton')}
            </Button>
          </div>
        </div>

        {/* Export formats */}
        <div>
          <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
            {t('backup.exportFormats')}
            <HelpTooltip text={t('backup.exportFormatsTooltip')} />
          </h4>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={openExportPdfDialog} className="justify-start">
              <span className="flex items-center gap-1">
                {'\uD83D\uDCC4'}
                {t('backup.exportPdf')}
              </span>
            </Button>
            <Button size="sm" variant="ghost" onClick={openExportDialog} className="justify-start">
              <span className="flex items-center gap-1">
                {'\uD83D\uDDC2'}
                {t('backup.exportExcel')}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Import Preview Dialog */}
      <ImportDialog
        open={importDialogOpen}
        preview={preview}
        onImport={handleImportExecute}
        onCancel={() => {
          setImportDialogOpen(false)
          setPreview(null)
          setError(null)
          importZipPathRef.current = null
        }}
      />

      {/* Progress Modal */}
      <ProgressModal
        open={progressOpen}
        title={progressTitle}
        progress={progress}
        onCancel={() => {
          setProgressOpen(false)
          setProgress(null)
        }}
      />
    </>
  )
}
