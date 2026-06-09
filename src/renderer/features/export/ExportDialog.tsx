import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useExportStore } from './useExport'
import type { Collection } from '@shared/types'

export function ExportDialog(): React.ReactElement {
  const { t } = useTranslation()
  const store = useExportStore()

  React.useEffect(() => {
    if (store.open) {
      window.api.collections.list().then((list: unknown) => {
        store.setCollections(list as Collection[])
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.open])

  const handleExport = (): void => {
    store.exportExcel()
  }

  const handleClose = (): void => {
    store.closeDialog()
  }

  return (
    <Modal
      open={store.open}
      onClose={handleClose}
      title={t('export.title')}
    >
      <div className="space-y-4 py-2">
        {/* Collection selection */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            {t('export.selectCollections')}
          </p>
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
            {store.collections.length === 0 ? (
              <p className="text-sm text-gray-400 p-3">{t('export.noCollections')}</p>
            ) : (
              store.collections.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={store.selectedIds.includes(c.id)}
                    onChange={() => store.toggleCollection(c.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{c.name}</span>
                </label>
              ))
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={store.selectAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {t('export.selectAll')}
            </button>
            <button
              onClick={store.deselectAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {t('export.deselectAll')}
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={store.includeImages}
              onChange={(e) => store.setIncludeImages(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">{t('export.includeImages')}</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={store.includeSold}
              onChange={(e) => store.setIncludeSold(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">{t('export.includeSold')}</span>
          </label>
        </div>

        {/* Progress */}
        {store.progress && (
          <div className="border border-blue-200 bg-blue-50 rounded-md p-3">
            <p className="text-xs text-blue-700 font-medium">
              {store.progress.stage}
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              {store.progress.message}
            </p>
            <div className="w-full bg-blue-200 rounded-full h-1.5 mt-2">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: store.progress.total > 0
                    ? `${Math.round((store.progress.current / store.progress.total) * 100)}%`
                    : '0%'
                }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {store.error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-xs text-red-700">{store.error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={store.exporting}>
            {t('export.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={store.selectedIds.length === 0 || store.exporting}
          >
            {store.exporting ? t('export.exporting') : t('export.export')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
