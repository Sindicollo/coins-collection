import React from 'react'
import { useTranslation } from 'react-i18next'
import { useCoinStore } from './useCoins'
import { CoinList } from './CoinList'
import { CoinForm } from './CoinForm'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { Coin, CoinCondition } from '@shared/types'

interface CoinViewProps {
  countryId: string
  countryName: string
  defaultCurrency: string
  collections: Array<{ id: string; name: string }>
  onCollectionChange?: () => void
}

export function CoinView({ countryId, countryName, defaultCurrency, collections, onCollectionChange }: CoinViewProps): React.ReactElement {
  const { t } = useTranslation()
  const store = useCoinStore()

  const [showForm, setShowForm] = React.useState(false)
  const [editCoin, setEditCoin] = React.useState<Coin | undefined>(undefined)
  const [coinToDelete, setCoinToDelete] = React.useState<Coin | null>(null)
  const [countrySuggestions, setCountrySuggestions] = React.useState<string[]>([])

  // Load country suggestions
  React.useEffect(() => {
    window.api.coins.listCountries().then(setCountrySuggestions)
  }, [])

  // Load/reload coins when country changes
  React.useEffect(() => {
    store.reset()
    store.loadCoins(countryId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId])

  const handleOpenCreate = (): void => {
    setEditCoin(undefined)
    setShowForm(true)
  }

  const handleOpenEdit = (coin: Coin): void => {
    setEditCoin(coin)
    setShowForm(true)
  }

  const handleSave = (data: {
    countryId: string
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
  }): void => {
    const collectionChanged = editCoin && data.countryId !== editCoin.countryId

    if (editCoin) {
      store.updateCoin({ id: editCoin.id, ...data })
    } else {
      store.addCoin(data)
    }
    setShowForm(false)
    setEditCoin(undefined)

    // If collection changed, notify parent to refresh
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-800">{countryName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('coins.title')}</p>
        </div>
        <Button size="sm" onClick={handleOpenCreate}>
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('coins.addButton')}
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin -mx-6 px-6">
        <CoinList
          coins={store.coins}
          loading={store.loading}
          loadingMore={store.loadingMore}
          hasMore={store.hasMore}
          error={store.error}
          onLoadMore={() => store.loadMore(countryId)}
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
        <p className="text-sm text-gray-600 mb-4">
          {t('coins.deleteConfirm')}
        </p>
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
