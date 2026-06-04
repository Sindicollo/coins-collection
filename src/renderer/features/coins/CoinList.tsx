import React from 'react'
import { useTranslation } from 'react-i18next'
import type { Coin } from '@shared/types'
import { CoinCard } from './CoinCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'

interface CoinListProps {
  coins: Coin[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  onLoadMore: () => void
  onEdit: (coin: Coin) => void
  onDelete: (coin: Coin) => void
  onSelect: (coin: Coin) => void
}

export function CoinList({
  coins,
  loading,
  loadingMore,
  hasMore,
  error,
  onLoadMore,
  onEdit,
  onDelete,
  onSelect
}: CoinListProps): React.ReactElement {
  const { t } = useTranslation()
  const sentinelRef = useIntersectionObserver(onLoadMore, hasMore && !loadingMore)

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md px-3 py-2">
        {t(error)}
      </p>
    )
  }

  if (coins.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">{t('coins.noCoins')}</p>
        <p className="text-xs text-gray-400 mt-1">{t('coins.noCoinsHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {coins.map((coin) => (
        <CoinCard
          key={coin.id}
          coin={coin}
          onEdit={onEdit}
          onDelete={onDelete}
          onSelect={onSelect}
        />
      ))}

      {loadingMore && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      )}

      {hasMore && <div ref={sentinelRef} className="h-1" />}

      {!hasMore && coins.length > 0 && (
        <p className="text-center text-xs text-gray-400 py-4">
          {coins.length} {t('coins.title').toLowerCase()}
        </p>
      )}
    </div>
  )
}
