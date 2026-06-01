import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { Coin } from '@shared/types'
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

  const conditionLabel = coin.condition
    ? t(`coins.conditions.${coin.condition}`)
    : null

  const handlePhotoClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    navigate(`/coins/${coin.countryId}/photo/${coin.id}`)
  }

  return (
    <Card className="p-3 cursor-pointer hover:shadow-md transition-shadow group" onClick={() => onSelect(coin)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-800">{coin.denomination}</span>
            {coin.year && (
              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {coin.year}
              </span>
            )}
            {conditionLabel && (
              <span className="text-xs text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded">
                {conditionLabel}
              </span>
            )}
          </div>

          {(coin.price !== null || coin.purchasePlace) && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              {coin.price !== null && (
                <span>
                  {currencySymbol(coin.currency)}{coin.price.toFixed(2)}
                </span>
              )}
              {coin.purchasePlace && <span>· {coin.purchasePlace}</span>}
            </div>
          )}

          {coin.notes && (
            <p className="text-xs text-gray-400 truncate">{coin.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-0.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handlePhotoClick}
            className="p-1 text-gray-400 hover:text-primary-600 rounded"
            title={t('photos.title')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
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
    </Card>
  )
}
