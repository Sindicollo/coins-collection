import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { ImportDialog } from './ImportDialog'
import { ProgressModal } from './ProgressModal'
import { useExportStore } from '@/features/export/useExport'
import { useExportPdfStore } from '@/features/export-pdf/useExportPdf'
import { useBackupActions } from '@/hooks/useBackupActions'

// ── HelpTooltip ────────────────────────────────────────

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

// ── BackupSection ──────────────────────────────────────

export function BackupSection(): React.ReactElement {
  const { t } = useTranslation()
  const openExportDialog = useExportStore((s) => s.openDialog)
  const openExportPdfDialog = useExportPdfStore((s) => s.openDialog)

  const {
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
  } = useBackupActions('[BackupSection]')

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
