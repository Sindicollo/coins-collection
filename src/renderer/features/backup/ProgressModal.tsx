import React from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface ProgressData {
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

const STAGE_LABELS: Record<string, string> = {
  reading: 'Reading data...',
  'copying-photos': 'Copying photos...',
  archiving: 'Creating archive...',
  extracting: 'Extracting backup...',
  'importing-collections': 'Importing collections...',
  'importing-coins': 'Importing coins...',
  'importing-photos': 'Importing photos...',
  'copying-files': 'Copying photo files...',
  finalizing: 'Finalizing...',
  done: 'Done!'
}

export function ProgressModal({ open, title, progress, onCancel }: ProgressModalProps): React.ReactElement {
  const stageLabel = progress ? STAGE_LABELS[progress.stage] ?? progress.stage : ''
  const percent = progress && progress.total > 0
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : 0
  const isDone = progress?.stage === 'done'

  return (
    <Modal open={open} onClose={isDone ? onCancel : () => {}} title={title}>
      <div className="space-y-4 py-4">
        <div className="text-sm text-gray-600 text-center">
          {progress?.message ?? stageLabel}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
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
              Cancel
            </Button>
          </div>
        )}

        {isDone && (
          <div className="flex justify-center pt-2">
            <Button size="sm" onClick={onCancel}>
              Close
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
