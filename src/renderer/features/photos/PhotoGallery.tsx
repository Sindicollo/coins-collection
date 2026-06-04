import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePhotoStore } from './usePhotos'
import { Lightbox } from './Lightbox'
import { ArrowLeft } from '@/components/ui/icons/ArrowLeft'
import { Settings } from '@/components/ui/icons/Settings'
import { Photo as PhotoIcon } from '@/components/ui/icons/Photo'
import { Delete } from '@/components/ui/icons/Delete'
import { Plus } from '@/components/ui/icons/Plus'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Photo } from '@shared/types'

interface PhotoGalleryProps {
  onOpenSettings?: () => void
}

export function PhotoGallery({ onOpenSettings }: PhotoGalleryProps): React.ReactElement {
  const { coinId } = useParams<{ coinId: string; collectionId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const store = usePhotoStore()

  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (coinId) {
      store.loadPhotos(coinId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinId])

  const handleAddPhoto = async (): Promise<void> => {
    if (coinId) {
      await store.uploadPhoto(coinId)
    }
  }

  const handleDeletePhoto = async (id: string): Promise<void> => {
    await store.deletePhoto(id)
    if (lightboxIndex !== null) {
      const afterDelete = store.photos.filter((p) => p.id !== id)
      if (afterDelete.length === 0) {
        setLightboxIndex(null)
      } else if (lightboxIndex >= afterDelete.length) {
        setLightboxIndex(afterDelete.length - 1)
      }
    }
  }

  const handleBack = (): void => {
    navigate(-1)
  }

  const openLightbox = (index: number): void => {
    setLightboxIndex(index)
  }

  const navigateLightbox = (direction: 1 | -1): void => {
    if (lightboxIndex === null) return
    const newIndex = lightboxIndex + direction
    if (newIndex >= 0 && newIndex < store.photos.length) {
      setLightboxIndex(newIndex)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
           <Button variant="ghost" size="sm" onClick={handleBack} className="text-gray-300 hover:text-white">
             <ArrowLeft className="w-5 h-5" />
           </Button>
          <h1 className="text-lg font-semibold text-white">{t('photos.title')}</h1>
          <span className="text-sm text-gray-400">
            {store.photos.length > 0 && `${store.photos.length} ${t('photos.photo', { count: store.photos.length })}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <Button variant="ghost" size="sm" onClick={onOpenSettings} className="text-gray-400 hover:text-white">
              <Settings className="w-5 h-5" />
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {store.loading ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gray-800">
                <Skeleton className="w-full h-full" />
              </div>
            ))}
          </div>
        ) : store.error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-400">
            <p>{store.error}</p>
            <Button variant="ghost" size="sm" onClick={() => coinId && store.loadPhotos(coinId)} className="mt-2">
              {t('coins.retry')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {store.photos.map((photo, index) => (
              <PhotoThumbnail
                key={photo.id}
                photo={photo}
                onClick={() => openLightbox(index)}
                onDelete={() => handleDeletePhoto(photo.id)}
              />
            ))}
            <AddPhotoButton onClick={handleAddPhoto} />
          </div>
        )}

        {!store.loading && !store.error && store.photos.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <PhotoIcon className="w-16 h-16 mb-4 text-gray-600" />
            <p className="text-lg">{t('photos.noPhotos')}</p>
            <p className="text-sm mt-1">{t('photos.clickToAdd')}</p>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={store.photos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDelete={(id) => handleDeletePhoto(id)}
          onNavigate={navigateLightbox}
          onJumpTo={setLightboxIndex}
        />
      )}
    </div>
  )
}

interface PhotoThumbnailProps {
  photo: Photo
  onClick: () => void
  onDelete: () => void
}

function PhotoThumbnail({ photo, onClick, onDelete }: PhotoThumbnailProps): React.ReactElement {
  const { t } = useTranslation()
  const [imgSrc, setImgSrc] = React.useState<string>('')
  const [imgError, setImgError] = React.useState(false)
  const [showDelete, setShowDelete] = React.useState(false)

  React.useEffect(() => {
    window.api.photos.getPhotoData(photo.id).then((dataUrl: string | null) => {
      if (dataUrl) {
        setImgSrc(dataUrl)
      }
    }).catch(() => setImgError(true))
  }, [photo.id])

  const handleDelete = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onDelete()
  }

  return (
    <div
      className="relative aspect-square rounded-lg overflow-hidden bg-gray-800 cursor-pointer group"
      onClick={onClick}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {imgError || !imgSrc ? (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <PhotoIcon className="w-8 h-8" />
          </div>
      ) : (
        <img
          src={imgSrc}
          alt={photo.originalName ?? ''}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          onError={() => setImgError(true)}
        />
      )}

      {showDelete && (
        <button
          onClick={handleDelete}
          className="absolute top-1 right-1 w-7 h-7 flex items-center justify-center
            bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100
            transition-opacity text-xs"
          title={t('photos.deletePhoto')}
        >
          <Delete className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

interface AddPhotoButtonProps {
  onClick: () => void
}

function AddPhotoButton({ onClick }: AddPhotoButtonProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-lg border-2 border-dashed border-gray-600
        hover:border-gray-400 transition-colors flex flex-col items-center justify-center
        text-gray-500 hover:text-gray-300 gap-1"
      title={t('photos.addPhoto')}
    >
      <Plus className="w-8 h-8" />
      <span className="text-xs">{t('photos.addPhoto')}</span>
    </button>
  )
}
