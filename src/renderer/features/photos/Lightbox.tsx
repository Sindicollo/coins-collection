import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Close } from '@/components/ui/icons/Close'
import { ArrowLeft } from '@/components/ui/icons/ArrowLeft'
import { ArrowRight } from '@/components/ui/icons/ArrowRight'
import { Delete } from '@/components/ui/icons/Delete'
import { Download } from '@/components/ui/icons/Download'
import { Photo as PhotoIcon } from '@/components/ui/icons/Photo'
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

  // Stable refs for keydown handler to avoid re-registering listener
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  const onNavigateRef = React.useRef(onNavigate)
  onNavigateRef.current = onNavigate
  const indexRef = React.useRef(currentIndex)
  indexRef.current = currentIndex
  const totalRef = React.useRef(photos.length)
  totalRef.current = photos.length

  React.useEffect(() => {
    setImgSrc('')
    setImgError(false)
    setConfirmDelete(false)

    if (photo) {
      window.api.photos.getPhotoData(photo.id).then((dataUrl: string | null) => {
        if (dataUrl) {
          setImgSrc(dataUrl)
        }
      }).catch(() => setImgError(true))
    }
  }, [photo, currentIndex])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      switch (e.key) {
        case 'Escape':
          onCloseRef.current()
          break
        case 'ArrowLeft':
          if (indexRef.current > 0) onNavigateRef.current(-1)
          break
        case 'ArrowRight':
          if (indexRef.current < totalRef.current - 1) onNavigateRef.current(1)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

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
            onClick={async () => {
              if (photo) {
                await window.api.photos.save(photo.id)
              }
            }}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title={t('photos.savePhoto')}
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
            title={t('photos.deletePhoto')}
          >
            <Delete className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title={t('coins.cancel')}
          >
            <Close className="w-6 h-6" />
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
            <ArrowLeft className="w-8 h-8" />
          </button>
        )}

        {currentIndex < photos.length - 1 && (
          <button
            onClick={() => onNavigate(1)}
            className="absolute right-4 p-2 text-white/60 hover:text-white transition-colors
              bg-black/30 rounded-full hover:bg-black/50"
          >
            <ArrowRight className="w-8 h-8" />
          </button>
        )}

        {/* Image */}
        {imgError || !imgSrc ? (
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <PhotoIcon className="w-16 h-16" />
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
