import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useExportPdfStore } from './useExportPdf'
import type { Collection } from '@shared/types'

export function ExportPdfDialog(): React.ReactElement {
  const { t } = useTranslation()
  const open = useExportPdfStore((s) => s.open)
  const collections = useExportPdfStore((s) => s.collections)
  const selectedIds = useExportPdfStore((s) => s.selectedIds)
  const exporting = useExportPdfStore((s) => s.exporting)
  const progress = useExportPdfStore((s) => s.progress)
  const error = useExportPdfStore((s) => s.error)
  const includeImages = useExportPdfStore((s) => s.includeImages)
  const includeSold = useExportPdfStore((s) => s.includeSold)
  const includePurchaseInfo = useExportPdfStore((s) => s.includePurchaseInfo)
  const setCollections = useExportPdfStore((s) => s.setCollections)
  const toggleCollection = useExportPdfStore((s) => s.toggleCollection)
  const selectAll = useExportPdfStore((s) => s.selectAll)
  const deselectAll = useExportPdfStore((s) => s.deselectAll)
  const setIncludeImages = useExportPdfStore((s) => s.setIncludeImages)
  const setIncludeSold = useExportPdfStore((s) => s.setIncludeSold)
  const setIncludePurchaseInfo = useExportPdfStore((s) => s.setIncludePurchaseInfo)
  const closeDialog = useExportPdfStore((s) => s.closeDialog)
  const exportPdf = useExportPdfStore((s) => s.exportPdf)

  React.useEffect(() => {
    if (open) {
      window.api.collections.list().then((list: unknown) => {
        setCollections(list as Collection[])
      }).catch((err) => {
        console.error('Failed to load collections:', err)
      })
    }
  }, [open, setCollections])

  const handleExport = (): void => {
    exportPdf()
  }

  const handleClose = (): void => {
    closeDialog()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('exportPdf.title')}
    >
      <div className="space-y-4 py-2">
        {/* Collection selection */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            {t('exportPdf.selectCollections')}
          </p>
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
            {collections.length === 0 ? (
              <p className="text-sm text-gray-400 p-3">{t('exportPdf.noCollections')}</p>
            ) : (
              collections.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleCollection(c.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{c.name}</span>
                </label>
              ))
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={selectAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {t('exportPdf.selectAll')}
            </button>
            <button
              onClick={deselectAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {t('exportPdf.deselectAll')}
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeImages}
              onChange={(e) => setIncludeImages(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">{t('exportPdf.includeImages')}</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeSold}
              onChange={(e) => setIncludeSold(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">{t('exportPdf.includeSold')}</span>
          </label>

          {/* Purchase info */}
          <div className="border border-gray-200 rounded-md p-3 space-y-2">
            <p className="text-xs font-medium text-gray-500">
              {t('exportPdf.purchaseInfo')}
            </p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="purchaseInfo"
                checked={!includePurchaseInfo}
                onChange={() => setIncludePurchaseInfo(false)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">{t('exportPdf.purchaseInfoNo')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="purchaseInfo"
                checked={includePurchaseInfo}
                onChange={() => setIncludePurchaseInfo(true)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">{t('exportPdf.purchaseInfoYes')}</span>
            </label>
          </div>
        </div>

        {/* Progress */}
        {progress && (
          <div className="border border-blue-200 bg-blue-50 rounded-md p-3">
            <p className="text-xs text-blue-700 font-medium">
              {progress.stage}
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              {progress.message}
            </p>
            <div className="w-full bg-blue-200 rounded-full h-1.5 mt-2">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: progress.total > 0
                    ? `${Math.round((progress.current / progress.total) * 100)}%`
                    : '0%'
                }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={exporting}>
            {t('exportPdf.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={selectedIds.length === 0 || exporting}
          >
            {exporting ? t('exportPdf.exporting') : t('exportPdf.export')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
