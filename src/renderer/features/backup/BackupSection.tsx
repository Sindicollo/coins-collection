import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { ImportDialog } from './ImportDialog'
import { ProgressModal } from './ProgressModal'
import { useExportStore } from '@/features/export/useExport'
import type { BackupPreview } from '@shared/types'

export function BackupSection(): React.ReactElement {
  const { t } = useTranslation()
  const openExportDialog = useExportStore((s) => s.openDialog)
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [preview, setPreview] = React.useState<BackupPreview | null>(null)
  const importZipPathRef = React.useRef<string | null>(null)

  const [progressOpen, setProgressOpen] = React.useState(false)
  const [progressTitle, setProgressTitle] = React.useState('')
  const [progress, setProgress] = React.useState<{
    stage: string
    current: number
    total: number
    message: string
  } | null>(null)

  // Export handler
  const handleExport = React.useCallback(async () => {
    setProgressTitle(t('backup.exportProgress'))
    setProgressOpen(true)
    setProgress(null)

    // Subscribe to progress
    const unsubscribe = window.api.backup.onExportProgress((data) => {
      setProgress(data)
    })

    try {
      await window.api.backup.exportExecute()
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      unsubscribe()
      // Keep progress open briefly to show "Done!" then close
      setTimeout(() => {
        setProgressOpen(false)
        setProgress(null)
      }, 1500)
    }
  }, [t])

  // Import: select file
  const handleImportClick = React.useCallback(async () => {
    try {
      const zipPath = await window.api.backup.importSelect()
      if (!zipPath) return

      setImportDialogOpen(true)

      const previewData = await window.api.backup.importPreview(zipPath)
      setPreview(previewData)

      // Store zipPath for later execution
      importZipPathRef.current = zipPath
    } catch (err) {
      console.error('Import preview failed:', err)
      setImportDialogOpen(false)
    }
  }, [])

  // Import: execute
  const handleImportExecute = React.useCallback(async () => {
    const zipPath = importZipPathRef.current
    if (!zipPath) return

    setImportDialogOpen(false)
    setPreview(null)
    setProgressTitle(t('backup.importProgress'))
    setProgressOpen(true)
    setProgress(null)

    const unsubscribe = window.api.backup.onImportProgress((data) => {
      setProgress(data)
    })

    try {
      const result = await window.api.backup.importExecute(zipPath)
      if (!result.success || result.errors.length > 0) {
        console.error('Import completed with errors:', result.errors)
      }
    } catch (err) {
      console.error('Import failed:', err)
    } finally {
      unsubscribe()
      importZipPathRef.current = null
      setTimeout(() => {
        setProgressOpen(false)
        setProgress(null)
      }, 1500)
    }
  }, [t])

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">{t('backup.title')}</h3>

        {/* Backup subsection */}
        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-2">{t('backup.sectionBackup')}</h4>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleExport}>
              {t('backup.exportButton')}
            </Button>
            <Button size="sm" variant="secondary" onClick={handleImportClick}>
              {t('backup.importButton')}
            </Button>
          </div>
        </div>

        {/* Future export formats */}
        <div>
          <h4 className="text-xs font-medium text-gray-400 mb-2">
            {t('backup.exportFormats')}
          </h4>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled title={t('backup.comingSoon')}>
              <span className="flex items-center gap-1">
                <span className="opacity-40">{'\uD83D\uDD12'}</span>
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
