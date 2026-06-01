import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import type { Photo } from '@shared/types'

interface LightboxProps {
  photos: Photo[]
  currentIndex: number
  onClose: () => void
  onDelete: (id: string) => void
  onNavigate: (direction: 1 | -1) => void
  onJumpTo: (index: number) => void
}

export function Lightbox({
  photos,
  currentIndex,
  onClose,
  onDelete,
  onNavigate,
  onJumpTo
}: LightboxProps): React.ReactElement {
  const { t } = useTranslation()
  const [imgSrc, setImgSrc] = React.useState<string>('')
  const [imgError, setImgError] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  const photo = photos[currentIndex]

  React.useEffect(() => {
    setImgSrc('')
    setImgError(false)
    setConfirmDelete(false)

    if (photo) {
      window.api.photos.getPhotoData(photo.id).then((dataUrl: string | null) => {
        if (dataUrl) {
          setImgSrc(dataUrl)
        }
      })
    }
  }, [photo, currentIndex])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          if (currentIndex > 0) onNavigate(-1)
          break
        case 'ArrowRight':
          if (currentIndex < photos.length - 1) onNavigate(1)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, photos.length, onClose, onNavigate])

  const handleDeleteConfirm = (): void => {
    onDelete(photo.id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white text-sm">
            {currentIndex + 1} / {photos.length}
          </span>
          {photo.originalName && (
            <span className="text-gray-400 text-sm truncate max-w-md">
              {photo.originalName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
            title={t('photos.deletePhoto')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title={t('coins.cancel')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex items-center justify-center min-h-0 px-12 relative">
        {/* Nav arrows */}
        {currentIndex > 0 && (
          <button
            onClick={() => onNavigate(-1)}
            className="absolute left-4 p-2 text-white/60 hover:text-white transition-colors
              bg-black/30 rounded-full hover:bg-black/50"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {currentIndex < photos.length - 1 && (
          <button
            onClick={() => onNavigate(1)}
            className="absolute right-4 p-2 text-white/60 hover:text-white transition-colors
              bg-black/30 rounded-full hover:bg-black/50"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Image */}
        {imgError || !imgSrc ? (
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>{t('photos.loadError')}</p>
          </div>
        ) : (
          <img
            src={imgSrc}
            alt={photo.originalName ?? ''}
            className="max-w-full max-h-full object-contain rounded select-none"
          />
        )}
      </div>

      {/* Bottom dots */}
      <div className="flex justify-center gap-2 py-4 shrink-0">
        {photos.map((_, i) => (
          <button
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === currentIndex ? 'bg-white' : 'bg-white/30 hover:bg-white/50'
            }`}
            onClick={() => onJumpTo(i)}
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm mx-4 shadow-xl border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-2">{t('photos.deleteTitle')}</h3>
            <p className="text-sm text-gray-400 mb-6">{t('photos.deleteConfirm')}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                {t('coins.cancel')}
              </Button>
              <Button variant="danger" size="sm" onClick={handleDeleteConfirm}>
                {t('coins.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
