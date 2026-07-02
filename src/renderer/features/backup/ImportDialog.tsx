import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { BackupPreview } from '@shared/types'

interface ImportDialogProps {
  open: boolean
  preview: BackupPreview | null
  onImport: () => void
  onCancel: () => void
}

function formatDate(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleString(locale)
}

export function ImportDialog({ open, preview, onImport, onCancel }: ImportDialogProps): React.ReactElement {
  const { t, i18n } = useTranslation()

  if (!preview) {
    return (
      <Modal open={open} onClose={onCancel} title={t('backup.importTitle')}>
        <div className="py-8 text-center text-sm text-gray-500" role="status">{t('backup.loadingPreview')}</div>
      </Modal>
    )
  }

  const { manifest, localStats } = preview

  return (
    <Modal open={open} onClose={onCancel} title={t('backup.importTitle')}>
      <div className="space-y-4 py-2">
        {/* Backup info */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <span className="font-medium">{t('backup.date')}</span>
            <span>{formatDate(manifest.exportedAt, i18n.language)}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <span className="font-medium">{t('backup.appVersion')}</span>
            <span>{manifest.appVersion}</span>
          </div>
        </div>

        {/* Stats comparison */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-3 text-xs font-medium text-gray-500 bg-gray-50">
            <div className="p-2"></div>
            <div className="p-2 text-center">{'\uD83D\uDCC1'} {t('backup.columnBackup')}</div>
            {localStats && <div className="p-2 text-center">{'\uD83D\uDCBB'} {t('backup.columnCurrent')}</div>}
          </div>
          <div className="grid grid-cols-3 text-xs border-t border-gray-100">
            <div className="p-2 text-gray-500">{t('backup.rowCollections')}</div>
            <div className="p-2 text-center font-medium">{manifest.stats.collections}</div>
            {localStats && <div className="p-2 text-center">{localStats.collections}</div>}
          </div>
          <div className="grid grid-cols-3 text-xs border-t border-gray-100">
            <div className="p-2 text-gray-500">{t('backup.rowCoins')}</div>
            <div className="p-2 text-center font-medium">{manifest.stats.coins}</div>
            {localStats && <div className="p-2 text-center">{localStats.coins}</div>}
          </div>
          <div className="grid grid-cols-3 text-xs border-t border-gray-100">
            <div className="p-2 text-gray-500">{t('backup.rowPhotos')}</div>
            <div className="p-2 text-center font-medium">{manifest.stats.photos}</div>
            {localStats && <div className="p-2 text-center">{localStats.photos}</div>}
          </div>
        </div>

        {/* Warning */}
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs text-amber-700">
            {t('backup.mergeWarning')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t('backup.cancel')}
          </Button>
          <Button size="sm" onClick={onImport}>
            {t('backup.importAction')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
