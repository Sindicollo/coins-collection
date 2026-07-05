import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCoinStore } from './useCoins'
import { useScrollRestoration } from './useScrollRestoration'
import { CoinList } from './CoinList'
import { CoinForm } from './CoinForm'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Ai } from '@/components/ui/icons/Ai'
import { Plus } from '@/components/ui/icons/Plus'
import { currencySymbol } from '@/utils/currency'
import type { Coin, CoinComposition, CoinCondition } from '@shared/types'

interface CurrencyTotal {
  currency: string
  total: number
  coinCount: number
}

interface CoinViewProps {
  collectionId: string
  collectionName: string
  defaultCurrency: string
  collections: Array<{ id: string; name: string }>
  onCollectionChange?: () => void
}

type CoinSaveData = {
  collectionId: string
  denomination: string
  country: string | null
  year: number | null
  condition: CoinCondition | null
  composition: CoinComposition | null
  purchaseDate: number | null
  purchasePlace: string | null
  price: number | null
  shippingCost: number | null
  currency: string | null
  sold: boolean
  onAuction: boolean
  auctionPrice: number | null
  salePrice: number | null
}

export function CoinView({
  collectionId,
  collectionName,
  defaultCurrency,
  collections,
  onCollectionChange
}: CoinViewProps): React.ReactElement {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  // Use individual selectors to avoid re-rendering on unrelated store changes
  const coins = useCoinStore((s) => s.coins)
  const loading = useCoinStore((s) => s.loading)
  const loadingMore = useCoinStore((s) => s.loadingMore)
  const hasMore = useCoinStore((s) => s.hasMore)
  const error = useCoinStore((s) => s.error)
  const loadedCollectionId = useCoinStore((s) => s.loadedCollectionId)
  const loadCoins = useCoinStore((s) => s.loadCoins)
  const loadMore = useCoinStore((s) => s.loadMore)
  const reset = useCoinStore((s) => s.reset)
  const addCoin = useCoinStore((s) => s.addCoin)
  const updateCoin = useCoinStore((s) => s.updateCoin)
  const deleteCoin = useCoinStore((s) => s.deleteCoin)

  const [showForm, setShowForm] = React.useState(false)
  const [editCoin, setEditCoin] = React.useState<Coin | undefined>(undefined)
  const [coinToDelete, setCoinToDelete] = React.useState<Coin | null>(null)
  const [countrySuggestions, setCountrySuggestions] = React.useState<string[]>([])
  const [totals, setTotals] = React.useState<CurrencyTotal[]>([])

  // Scroll persistence across collection switches and gallery navigation
  useScrollRestoration(collectionId)

  // Load country name suggestions for autocomplete
  React.useEffect(() => {
    window.api.coins.listCountries().then(setCountrySuggestions).catch(() => {
      // Silently fail — empty suggestions just means no autocomplete
    })
  }, [])

  // Load coins when collection changes (or on first mount)
  React.useEffect(() => {
    if (!loadedCollectionId || loadedCollectionId !== collectionId) {
      reset()
      loadCoins(collectionId)
    }
  }, [collectionId, loadedCollectionId, reset, loadCoins])

  // Load total purchase cost for the collection (re-load on coin list changes)
  React.useEffect(() => {
    const promise = window.api.coins.totalCost(collectionId)
    if (promise) {
      promise.then(setTotals).catch((err) => console.warn('Failed to load totals:', err))
    }
  }, [collectionId, coins.length])

  const handleOpenCreate = (): void => {
    setEditCoin(undefined)
    setShowForm(true)
  }

  const handleOpenEdit = (coin: Coin): void => {
    setEditCoin(coin)
    setShowForm(true)
  }

  const handleSave = (data: CoinSaveData): void => {
    const collectionChanged = editCoin && data.collectionId !== editCoin.collectionId

    // State is reset optimistically; errors are logged and visible in CoinList
    const savePromise = editCoin
      ? updateCoin({ id: editCoin.id, ...data })
      : addCoin(data)
    savePromise?.catch((err) => console.error('Failed to save coin:', err))
    setShowForm(false)
    setEditCoin(undefined)

    if (collectionChanged && onCollectionChange) {
      onCollectionChange()
    }
  }

  const handleDeleteConfirm = (): void => {
    if (coinToDelete) {
      deleteCoin(coinToDelete.id)?.catch((err) => console.error('Failed to delete coin:', err))
      setCoinToDelete(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header — sticky so it remains visible while scrolling the coin list */}
      <div className="flex items-start justify-between pb-4 sticky top-0 z-10 bg-gray-50 pt-6 -mt-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-primary-800 truncate">{collectionName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totals.length > 0
              ? t('coins.totalCost', {
                  cost: totals
                    .map((total) => `${total.total.toLocaleString(i18n.language === 'ru' ? 'ru-RU' : undefined)} ${currencySymbol(total.currency)}`)
                    .join(', ')
                })
              : t('coins.title')}
          </p>
        </div>
        <div className="flex items-start gap-2 flex-shrink-0 ml-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/ai/${collectionId}`)}
            title={t('ai.title', { defaultValue: 'AI Assistant' })}
          >
            <Ai className="w-4 h-4 mr-1" />
            {t('ai.title', { defaultValue: 'AI' })}
          </Button>
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4 mr-1" />
            {t('coins.addButton')}
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 -mx-6 px-6">
        <CoinList
          coins={coins}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          error={error}
          onLoadMore={() => loadMore(collectionId)}
          onEdit={handleOpenEdit}
          onDelete={setCoinToDelete}
          onSelect={(coin) => navigate(`/coins/${coin.collectionId}/coin/${coin.id}`)}
        />
      </div>

      {/* Create/Edit form — key forces remount when switching between coins */}
      <CoinForm
        key={editCoin?.id ?? 'new'}
        open={showForm}
        coin={editCoin}
        defaultCurrency={defaultCurrency}
        collections={collections}
        countrySuggestions={countrySuggestions}
        onSave={handleSave}
        onClose={() => {
          setShowForm(false)
          setEditCoin(undefined)
        }}
      />

      {/* Delete confirmation */}
      <Modal
        open={coinToDelete !== null}
        onClose={() => setCoinToDelete(null)}
        title={t('coins.deleteTitle')}
      >
        <p className="text-sm text-gray-600 mb-4">{t('coins.deleteConfirm')}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setCoinToDelete(null)}>
            {t('coins.cancel')}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDeleteConfirm}>
            {t('coins.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
