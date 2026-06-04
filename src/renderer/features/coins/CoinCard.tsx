import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { Coin, Photo } from '@shared/types'
import { Card } from '@/components/ui/Card'
import { currencySymbol } from '@/utils/currency'

interface CoinCardProps {
  coin: Coin
  onEdit: (coin: Coin) => void
  onDelete: (coin: Coin) => void
  onSelect: (coin: Coin) => void
}

export function CoinCard({ coin, onEdit, onDelete, onSelect }: CoinCardProps): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [thumbs, setThumbs] = React.useState<string[]>([])
  const [photosLoaded, setPhotosLoaded] = React.useState(false)
  const mountedRef = React.useRef(true)

  const conditionLabel = coin.condition ? t(`coins.conditions.${coin.condition}`) : null

  // Load photo thumbnails
  React.useEffect(() => {
    mountedRef.current = true
    setPhotosLoaded(false)
    setThumbs([])

    window.api.photos.list(coin.id).then(async (photos: Photo[]) => {
      if (!mountedRef.current) return

      const thumbnails = (await Promise.all(
        photos.slice(0, 4).map((p) => window.api.photos.getPhotoData(p.id))
      )).filter((d: string | null): d is string => d !== null)

      if (mountedRef.current) {
        setThumbs(thumbnails)
        setPhotosLoaded(true)
      }
    }).catch(() => {
      if (mountedRef.current) setPhotosLoaded(true)
    })

    return () => {
      mountedRef.current = false
    }
  }, [coin.id])

  const goToGallery = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (coin.collectionId && coin.id) {
      navigate(`/coins/${coin.collectionId}/photo/${coin.id}`)
    }
  }

  return (
    <Card className="p-3 cursor-pointer hover:shadow-md transition-shadow group" onClick={() => onSelect(coin)}>
      {/* Top row: denomination, year, condition, price, actions */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-semibold text-gray-800 truncate">{coin.denomination}</span>
          {coin.year && (
            <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
              {coin.year}
            </span>
          )}
          {conditionLabel && (
            <span className="text-xs text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded shrink-0">
              {conditionLabel}
            </span>
          )}
          {coin.country && (
            <span className="text-xs text-gray-400 shrink-0">{coin.country}</span>
          )}
          {coin.price !== null && (
            <span className="text-xs font-medium text-gray-600 shrink-0">
              {currencySymbol(coin.currency)}
              {coin.price.toFixed(2)}
            </span>
          )}
          {coin.purchasePlace && (
            <span className="text-xs text-gray-400 truncate hidden sm:inline">· {coin.purchasePlace}</span>
          )}
        </div>

        {/* Action buttons — show on hover */}
        <div className="flex items-center gap-0.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(coin)
            }}
            className="p-1 text-gray-400 hover:text-primary-600 rounded"
            title={t('coins.edit')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(coin)
            }}
            className="p-1 text-gray-400 hover:text-red-600 rounded"
            title={t('coins.delete')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom row: thumbnails — height 64px */}
      <div className="h-16 flex items-center gap-1.5">
        {!photosLoaded ? (
          /* Loading skeleton for thumbnails */
          <>
            {[56, 56, 56, 56].map((w, i) => (
              <div
                key={i}
                className="h-16 rounded bg-gray-100 animate-pulse shrink-0"
                style={{ width: w }}
              />
            ))}
          </>
        ) : thumbs.length > 0 ? (
          /* Photo thumbnails */
          thumbs.map((dataUrl, i) => (
            <img
              key={i}
              src={dataUrl}
              alt=""
              className="h-16 w-14 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
              onClick={goToGallery}
            />
          ))
        ) : (
          /* Placeholder — generic coin icon */
          <div
            className="h-16 w-14 rounded border border-gray-200 bg-gray-50 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors shrink-0"
            onClick={goToGallery}
          >
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}

        {/* + button to add photos — always visible in thumb row */}
        <button
          onClick={goToGallery}
          className="h-16 w-14 rounded border-2 border-dashed border-gray-200 hover:border-primary-300 shrink-0
            flex items-center justify-center text-gray-300 hover:text-primary-400 transition-colors"
          title={t('photos.addPhoto')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </Card>
  )
}
