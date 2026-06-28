import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { Coin, Photo } from '@shared/types'
import { Card } from '@/components/ui/Card'
import { currencySymbol } from '@/utils/currency'
import { Edit } from '@/components/ui/icons/Edit'
import { Delete } from '@/components/ui/icons/Delete'
import { Coin as CoinIcon } from '@/components/ui/icons/Coin'
import { Plus } from '@/components/ui/icons/Plus'
import { Auc } from '@/components/ui/icons/Auc'
import { Sold } from '@/components/ui/icons/Sold'

const AUC_COLOR = 'text-orange-800'
const SOLD_COLOR = 'text-green-700'

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
    <Card className={`p-3 cursor-pointer hover:shadow-md transition-shadow group relative ${coin.onAuction && !coin.sold ? 'bg-orange-50 border-orange-800' : ''}`} onClick={() => onSelect(coin)}>
      {/* Content wrapper — gets opacity/grayscale for sold coins, but not the absolute-positioned icons */}
      <div className={`${coin.sold && !coin.onAuction ? 'opacity-60' : ''}`}>
      {/* Top row: denomination, year, condition, price, actions */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`font-semibold truncate ${coin.sold ? 'text-gray-400' : 'text-gray-800'}`}>{coin.denomination}</span>
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
          {coin.composition && (
            <span className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
              {t(`coins.compositions.${coin.composition}`)}
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
          {coin.onAuction && !coin.sold && coin.auctionPrice !== null && (
            <span className={`text-xs font-medium ${AUC_COLOR} shrink-0`}>
              / {currencySymbol(coin.currency)}
              {coin.auctionPrice.toFixed(2)}
            </span>
          )}
          {coin.sold && coin.salePrice !== null && (
            <span className={`text-xs font-medium ${SOLD_COLOR} shrink-0`}>
              / {currencySymbol(coin.currency)}
              {coin.salePrice.toFixed(2)}
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
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(coin)
            }}
            className="p-1 text-gray-400 hover:text-red-600 rounded"
            title={t('coins.delete')}
          >
            <Delete className="w-3.5 h-3.5" />
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
            <CoinIcon className="w-6 h-6 text-gray-300" />
          </div>
        )}

        {/* + button to add photos — always visible in thumb row */}
        <button
          onClick={goToGallery}
          className="h-16 w-14 rounded border-2 border-dashed border-gray-200 hover:border-primary-300 shrink-0
            flex items-center justify-center text-gray-300 hover:text-primary-400 transition-colors"
          title={t('photos.addPhoto')}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      </div>

      {/* Auction / Sold indicators */}
      {coin.onAuction && !coin.sold && (
        <div className="absolute top-1 right-[54px] pointer-events-none">
          <Auc className={`w-10 h-10 ${AUC_COLOR}`} />
        </div>
      )}
      {coin.sold && (
        <div className="absolute top-1 right-[54px] pointer-events-none">
          <Sold className={`w-10 h-10 ${SOLD_COLOR}`} />
        </div>
      )}
    </Card>
  )
}
