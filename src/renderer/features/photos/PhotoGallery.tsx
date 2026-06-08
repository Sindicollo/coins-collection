import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  const [isDragOver, setIsDragOver] = React.useState(false)
  const dragOverCounter = React.useRef(0)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

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

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (): void => {
    dragOverCounter.current += 1
    setIsDragOver(true)
  }

  const handleDragLeave = (): void => {
    dragOverCounter.current -= 1
    if (dragOverCounter.current <= 0) {
      dragOverCounter.current = 0
      setIsDragOver(false)
    }
  }

  const handleDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    dragOverCounter.current = 0
    setIsDragOver(false)

    const files = e.dataTransfer?.files
    if (!files || files.length === 0 || !coinId) return

    const filePaths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      // Electron exposes the full path via file.path
      const path = (file as File & { path?: string }).path
      if (path) {
        filePaths.push(path)
      }
    }

    if (filePaths.length > 0) {
      await store.uploadPhotosFromPaths(coinId, filePaths)
    }
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = store.photos.findIndex((p) => p.id === active.id)
    const newIndex = store.photos.findIndex((p) => p.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(store.photos, oldIndex, newIndex)
    // Optimistic update
    usePhotoStore.setState({ photos: reordered })

    if (coinId) {
      store.reorderPhotos(coinId, reordered.map((p) => p.id))
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

  const photoIds = store.photos.map((p) => p.id)

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
      <div
        className="flex-1 overflow-y-auto p-6 relative"
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
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
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={photoIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {store.photos.map((photo, index) => (
                  <SortablePhotoThumbnail
                    key={photo.id}
                    photo={photo}
                    onClick={() => openLightbox(index)}
                    onDelete={() => handleDeletePhoto(photo.id)}
                  />
                ))}
                <AddPhotoButton onClick={handleAddPhoto} isDragOver={isDragOver} />
              </div>
            </SortableContext>
          </DndContext>
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

interface SortablePhotoThumbnailProps {
  photo: Photo
  onClick: () => void
  onDelete: () => void
}

function SortablePhotoThumbnail({
  photo,
  onClick,
  onDelete
}: SortablePhotoThumbnailProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 50 : undefined
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PhotoThumbnailInner photo={photo} onClick={onClick} onDelete={onDelete} isDragging={isDragging} />
    </div>
  )
}

interface PhotoThumbnailInnerProps {
  photo: Photo
  onClick: () => void
  onDelete: () => void
  isDragging: boolean
}

function PhotoThumbnailInner({
  photo,
  onClick,
  onDelete,
  isDragging
}: PhotoThumbnailInnerProps): React.ReactElement {
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

  const handleClick = (e: React.MouseEvent): void => {
    if (isDragging) return
    e.stopPropagation()
    onClick()
  }

  return (
    <div
      className={`relative aspect-square rounded-lg overflow-hidden bg-gray-800 cursor-pointer group ${
        isDragging ? 'ring-2 ring-blue-400' : ''
      }`}
      onClick={handleClick}
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
  isDragOver: boolean
}

function AddPhotoButton({ onClick, isDragOver }: AddPhotoButtonProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <button
      onClick={onClick}
      className={`aspect-square rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-1 ${
        isDragOver
          ? 'border-blue-400 text-blue-300 bg-blue-900/30'
          : 'border-gray-600 hover:border-gray-400 text-gray-500 hover:text-gray-300'
      }`}
      title={t('photos.addPhoto')}
    >
      <Plus className="w-8 h-8" />
      <span className="text-xs">{t('photos.addPhoto')}</span>
    </button>
  )
}
