import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export interface ProgressData {
  stage: string
  current: number
  total: number
  message: string
}

interface ProgressModalProps {
  open: boolean
  title: string
  progress: ProgressData | null
  onCancel: () => void
}

const STAGE_I18N_KEYS: Record<string, string> = {
  reading: 'backup.stageReading',
  'copying-photos': 'backup.stageCopyingPhotos',
  archiving: 'backup.stageArchiving',
  extracting: 'backup.stageExtracting',
  'importing-collections': 'backup.stageImportingCollections',
  'importing-coins': 'backup.stageImportingCoins',
  'importing-photos': 'backup.stageImportingPhotos',
  'copying-files': 'backup.stageCopyingFiles',
  finalizing: 'backup.stageFinalizing',
  done: 'backup.stageDone'
}

export function ProgressModal({ open, title, progress, onCancel }: ProgressModalProps): React.ReactElement {
  const { t } = useTranslation()
  const stageLabel = progress
    ? t(STAGE_I18N_KEYS[progress.stage] ?? progress.stage)
    : ''
  const percent = progress && progress.total > 0
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : 0
  const isDone = progress?.stage === 'done'

  return (
    <Modal open={open} onClose={isDone ? onCancel : () => {}} title={title}>
      <div className="space-y-4 py-4" role="status" aria-live="polite">
        <div className="text-sm text-gray-600 text-center">
          {progress?.message || stageLabel}
        </div>

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuenow={progress?.current ?? 0}
          aria-valuemin={0}
          aria-valuemax={progress?.total ?? 100}
          aria-label={progress?.message ?? stageLabel}
          className="w-full bg-gray-200 rounded-full h-3 overflow-hidden"
        >
          <div
            className="bg-primary-600 h-3 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="text-xs text-gray-400 text-center">
          {percent}%
        </div>

        {/* Cancel button (only during active progress) */}
        {!isDone && (
          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {t('backup.cancel')}
            </Button>
          </div>
        )}

        {isDone && (
          <div className="flex justify-center pt-2">
            <Button size="sm" onClick={onCancel}>
              {t('backup.close')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
