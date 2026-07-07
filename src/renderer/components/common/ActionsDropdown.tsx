import React from 'react'
import { useTranslation } from 'react-i18next'
import { ImportDialog } from '@/features/backup/ImportDialog'
import { ProgressModal } from '@/features/backup/ProgressModal'
import type { ProgressData } from '@/features/backup/ProgressModal'
import { useExportStore } from '@/features/export/useExport'
import { useExportPdfStore } from '@/features/export-pdf/useExportPdf'
import type { BackupPreview } from '@shared/types'

// ── HelpTooltip ────────────────────────────────────────

interface TooltipProps {
  text: string
}

function HelpTooltip({ text }: TooltipProps): React.ReactElement {
  return (
    <span className="relative group cursor-help ml-1">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[10px] leading-none text-gray-400 border border-gray-300">
        ?
      </span>
      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-3 py-1.5 bg-gray-800 text-white text-[11px] leading-relaxed rounded shadow-lg opacity-0 invisible group-hover:opacity-85 group-hover:visible transition-all duration-150 max-w-[280px] min-w-[280px] pointer-events-none whitespace-normal z-50">
        {text}
      </span>
    </span>
  )
}

// ── ActionsDropdown ────────────────────────────────────

export function ActionsDropdown(): React.ReactElement {
  const { t } = useTranslation()
  const openExportDialog = useExportStore((s) => s.openDialog)
  const openExportPdfDialog = useExportPdfStore((s) => s.openDialog)
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Import state
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [preview, setPreview] = React.useState<BackupPreview | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const importZipPathRef = React.useRef<string | null>(null)

  // Progress state
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

  // Close on click outside
  React.useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [open])

  // Export handler
  const handleExport = React.useCallback(async () => {
    setError(null)
    setOpen(false)
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
      console.error('[ActionsDropdown] Export failed:', message)
      if (mountedRef.current) setError(message || t('backup.exportFailed'))
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

  // Import handlers
  const handleImportClick = React.useCallback(async () => {
    setError(null)
    setOpen(false)
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
      console.error('[ActionsDropdown] Import preview failed:', message)
      if (mountedRef.current) {
        setError(message || t('backup.importPreviewFailed'))
        setImportDialogOpen(false)
      }
    }
  }, [t])

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
        console.error('[ActionsDropdown] Import completed with errors:', result.errors)
        if (mountedRef.current) {
          setError(result.errors.join('\n') || t('backup.importFailed'))
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[ActionsDropdown] Import failed:', message)
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
      <div ref={containerRef} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-500
            hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
        >
          {t('actions.label', { defaultValue: 'Actions' })}
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md
            shadow-lg py-1 z-50 min-w-[220px]">
            {/* Backup section */}
            <div className="px-3 py-1.5">
              <span className="text-xs font-medium text-gray-400 flex items-center">
                {t('backup.sectionBackup', { defaultValue: 'Backup' })}
                <HelpTooltip text={t('backup.sectionBackupTooltip', { defaultValue: 'ZIP file with a full copy of the database contents, including photos' })} />
              </span>
            </div>
            <button
              onClick={handleExport}
              className="w-full text-left px-6 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              {t('backup.exportButton', { defaultValue: 'Export Backup' })}
            </button>
            <button
              onClick={handleImportClick}
              className="w-full text-left px-6 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              {t('backup.importButton', { defaultValue: 'Import Backup' })}
            </button>

            <div className="border-t border-gray-100 my-1" />

            {/* Export formats section */}
            <div className="px-3 py-1.5">
              <span className="text-xs font-medium text-gray-400 flex items-center">
                {t('backup.exportFormats', { defaultValue: 'Export Formats' })}
                <HelpTooltip text={t('backup.exportFormatsTooltip', { defaultValue: 'Export selected collections with coin metadata to PDF or .xslx (for Excel/Apple Numbers)' })} />
              </span>
            </div>
            <button
              onClick={() => { setOpen(false); openExportPdfDialog() }}
              className="w-full text-left px-6 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              {t('backup.exportPdf', { defaultValue: 'Export to PDF' })}
            </button>
            <button
              onClick={() => { setOpen(false); openExportDialog() }}
              className="w-full text-left px-6 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              {t('backup.exportExcel', { defaultValue: 'Export to Excel' })}
            </button>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="absolute top-full right-0 mt-1 z-50 rounded-md bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 min-w-[220px] shadow-lg">
            {error}
            <button className="ml-2 text-red-500 hover:text-red-700 font-medium" onClick={() => setError(null)}>
              ×
            </button>
          </div>
        )}
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
