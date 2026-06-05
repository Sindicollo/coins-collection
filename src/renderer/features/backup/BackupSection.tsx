import React from 'react'
import { Button } from '@/components/ui/Button'
import { ImportDialog } from './ImportDialog'
import { ProgressModal } from './ProgressModal'
import type { BackupPreview } from '@shared/types'

export function BackupSection(): React.ReactElement {
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [preview, setPreview] = React.useState<BackupPreview | null>(null)

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
    setProgressTitle('Export Backup')
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
  }, [])

  // Import: select file
  const handleImportClick = React.useCallback(async () => {
    try {
      const zipPath = await window.api.backup.importSelect()
      if (!zipPath) return

      setImportDialogOpen(true)

      const previewData = await window.api.backup.importPreview(zipPath)
      setPreview(previewData)

      // Store zipPath for later execution
      ;(window as unknown as Record<string, unknown>).__backupImportZipPath = zipPath
    } catch (err) {
      console.error('Import preview failed:', err)
      setImportDialogOpen(false)
    }
  }, [])

  // Import: execute
  const handleImportExecute = React.useCallback(async () => {
    const zipPath = (window as unknown as Record<string, unknown>).__backupImportZipPath as string | undefined
    if (!zipPath) return

    setImportDialogOpen(false)
    setPreview(null)
    setProgressTitle('Import Backup')
    setProgressOpen(true)
    setProgress(null)

    const unsubscribe = window.api.backup.onImportProgress((data) => {
      setProgress(data)
    })

    try {
      await window.api.backup.importExecute(zipPath)
    } catch (err) {
      console.error('Import failed:', err)
    } finally {
      unsubscribe()
      delete (window as unknown as Record<string, unknown>).__backupImportZipPath
      setTimeout(() => {
        setProgressOpen(false)
        setProgress(null)
      }, 1500)
    }
  }, [])

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Backup {`&`} Restore</h3>

        {/* Backup subsection */}
        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-2">Backup</h4>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleExport}>
              Export Backup
            </Button>
            <Button size="sm" variant="secondary" onClick={handleImportClick}>
              Import Backup
            </Button>
          </div>
        </div>

        {/* Future export formats */}
        <div>
          <h4 className="text-xs font-medium text-gray-400 mb-2">
            Export Formats (coming soon)
          </h4>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled title="Coming soon">
              <span className="flex items-center gap-1">
                <span className="opacity-40">{'\uD83D\uDD12'}</span>
                Export to PDF
              </span>
            </Button>
            <Button size="sm" variant="ghost" disabled title="Coming soon">
              <span className="flex items-center gap-1">
                <span className="opacity-40">{'\uD83D\uDD12'}</span>
                Export to Excel
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
          delete (window as unknown as Record<string, unknown>).__backupImportZipPath
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
