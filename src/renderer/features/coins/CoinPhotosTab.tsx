import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Plus } from '@/components/ui/icons/Plus'
import { Photo as PhotoIcon } from '@/components/ui/icons/Photo'
import { fetchAndCachePhotoData, invalidatePhotoDataCache, invalidatePhotoListCache } from '@/features/photos/photoDataCache'
import type { Photo } from '@shared/types'

interface CoinPhotosTabProps {
  coinId: string
  collectionId: string
  onCountChange: (count: number) => void
}

export function CoinPhotosTab({ coinId, collectionId, onCountChange }: CoinPhotosTabProps): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [photos, setPhotos] = React.useState<Photo[]>([])
  const [loading, setLoading] = React.useState(true)
  const [thumbnails, setThumbnails] = React.useState<Record<string, string>>({})
  const [uploading, setUploading] = React.useState(false)
  const mountedRef = React.useRef(true)

  const loadPhotos = React.useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const list = await window.api.photos.list(coinId)
      if (mountedRef.current) {
        setPhotos(list)
        onCountChange(list.length)
      }

      // Load thumbnails
      const thumbs: Record<string, string> = {}
      await Promise.all(
        list.map(async (p) => {
          const data = await fetchAndCachePhotoData(p.id)
          if (mountedRef.current && data) {
            thumbs[p.id] = data
          }
        })
      )
      if (mountedRef.current) {
        setThumbnails(thumbs)
      }
    } catch (err) {
      console.error('Failed to load photos:', err)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [coinId, onCountChange])

  React.useEffect(() => {
    mountedRef.current = true
    loadPhotos()
    return () => { mountedRef.current = false }
  }, [coinId, loadPhotos])

  const handleAdd = async (): Promise<void> => {
    setUploading(true)
    try {
      await window.api.photos.create(coinId)
      invalidatePhotoListCache(coinId)
      loadPhotos()
    } catch (err) {
      console.error('Failed to add photo:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (photoId: string): Promise<void> => {
    try {
      await window.api.photos.delete(photoId)
      invalidatePhotoDataCache([photoId])
      invalidatePhotoListCache(coinId)
      loadPhotos()
    } catch (err) {
      console.error('Failed to delete photo:', err)
    }
  }

  const handleOpenGallery = (): void => {
    navigate(`/coins/${collectionId}/photo/${coinId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800">
          {t('tabs.photos', { defaultValue: 'Photos' })}
        </h3>
        <div className="flex items-center gap-1">
          {photos.length > 0 && (
            <Button size="sm" variant="ghost" onClick={handleOpenGallery}>
              <PhotoIcon className="w-4 h-4 mr-1" />
              {t('photos.viewGallery', { defaultValue: 'Gallery' })}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleAdd} disabled={uploading}>
            <Plus className="w-4 h-4 mr-1" />
            {t('photos.addPhoto', { defaultValue: 'Add' })}
          </Button>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <PhotoIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">{t('photos.noPhotos', { defaultValue: 'No photos yet' })}</p>
          <p className="text-xs text-gray-400 mt-1">{t('photos.clickToAdd', { defaultValue: 'Click "Add" to add some.' })}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              className="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50 cursor-pointer"
              onClick={handleOpenGallery}
            >
              {thumbnails[photo.id] ? (
                <img
                  src={thumbnails[photo.id]}
                  alt={`${t('photos.photo', { defaultValue: 'Photo' })} ${idx + 1}`}
                  className="w-full aspect-square object-cover"
                />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center">
                  <PhotoIcon className="w-8 h-8 text-gray-300" />
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(photo.id)
                }}
                className="absolute top-1 right-1 p-1 bg-white/80 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                title={t('photos.deletePhoto', { defaultValue: 'Delete photo' })}
              >
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-white/80 px-2 py-1 text-xs text-gray-500">
                {idx + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
