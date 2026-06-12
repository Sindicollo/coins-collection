import React from 'react'
import { useTranslation } from 'react-i18next'
import { useCoinStore } from './useCoins'
import { useScrollRestoration } from './useScrollRestoration'
import { CoinList } from './CoinList'
import { CoinForm } from './CoinForm'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LlmTools } from './LlmTools'
import { Plus } from '@/components/ui/icons/Plus'
import { currencySymbol } from '@/utils/currency'
import type { Coin, CoinCondition } from '@shared/types'

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
  purchaseDate: number | null
  purchasePlace: string | null
  price: number | null
  shippingCost: number | null
  currency: string | null
  notes: string | null
  sold: boolean
}

export function CoinView({
  collectionId,
  collectionName,
  defaultCurrency,
  collections,
  onCollectionChange
}: CoinViewProps): React.ReactElement {
  const { t } = useTranslation()
  const store = useCoinStore()

  const [showForm, setShowForm] = React.useState(false)
  const [editCoin, setEditCoin] = React.useState<Coin | undefined>(undefined)
  const [coinToDelete, setCoinToDelete] = React.useState<Coin | null>(null)
  const [countrySuggestions, setCountrySuggestions] = React.useState<string[]>([])
  const [totals, setTotals] = React.useState<CurrencyTotal[]>([])

  // Scroll persistence across collection switches and gallery navigation
  useScrollRestoration(collectionId)

  // Load country name suggestions for autocomplete
  React.useEffect(() => {
    window.api.coins.listCountries().then(setCountrySuggestions)
  }, [])

  // Load coins when collection changes (or on first mount)
  const { loadedCollectionId, reset, loadCoins: load } = store
  React.useEffect(() => {
    if (!loadedCollectionId || loadedCollectionId !== collectionId) {
      reset()
      load(collectionId)
    }
  }, [collectionId, loadedCollectionId, reset, load])

  // Load total purchase cost for the collection (re-load on coin list changes)
  React.useEffect(() => {
    const promise = window.api.coins.totalCost(collectionId)
    if (promise) {
      promise.then(setTotals).catch((err) => console.warn('Failed to load totals:', err))
    }
  }, [collectionId, store.coins.length])

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

    if (editCoin) {
      store.updateCoin({ id: editCoin.id, ...data })
    } else {
      store.addCoin(data)
    }
    setShowForm(false)
    setEditCoin(undefined)

    if (collectionChanged && onCollectionChange) {
      onCollectionChange()
    }
  }

  const handleDeleteConfirm = (): void => {
    if (coinToDelete) {
      store.deleteCoin(coinToDelete.id)
      setCoinToDelete(null)
    }
  }

  const handleRefresh = (): void => {
    store.reset()
    store.loadCoins(collectionId)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-primary-800 truncate">{collectionName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totals.length > 0
              ? t('coins.totalCost', {
                  cost: totals
                    .map((t) => `${t.total.toLocaleString('ru-RU')} ${currencySymbol(t.currency)}`)
                    .join(', ')
                })
              : t('coins.title')}
          </p>
        </div>
        <div className="flex items-start gap-2 flex-shrink-0 ml-4">
          <LlmTools collectionId={collectionId} onImported={handleRefresh} />
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4 mr-1" />
            {t('coins.addButton')}
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 -mx-6 px-6">
        <CoinList
          coins={store.coins}
          loading={store.loading}
          loadingMore={store.loadingMore}
          hasMore={store.hasMore}
          error={store.error}
          onLoadMore={() => store.loadMore(collectionId)}
          onEdit={handleOpenEdit}
          onDelete={setCoinToDelete}
          onSelect={handleOpenEdit}
        />
      </div>

      {/* Create/Edit form */}
      <CoinForm
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
