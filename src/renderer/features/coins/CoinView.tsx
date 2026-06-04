import React from 'react'
import { useTranslation } from 'react-i18next'
import { useCoinStore } from './useCoins'
import { CoinList } from './CoinList'
import { CoinForm } from './CoinForm'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LlmPrices } from './LlmPrices'
import { Plus } from '@/components/ui/icons/Plus'
import type { Coin, CoinCondition } from '@shared/types'

interface CoinViewProps {
  collectionId: string
  collectionName: string
  defaultCurrency: string
  collections: Array<{ id: string; name: string }>
  onCollectionChange?: () => void
}

export function CoinView({ collectionId, collectionName, defaultCurrency, collections, onCollectionChange }: CoinViewProps): React.ReactElement {
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

  // Save scroll before collection changes or unmount
  React.useEffect(() => {
    return () => {
      const main = mainRef.current
      if (main) {
        useCoinStore.getState().saveScrollPosition(collectionId, main.scrollTop)
      }
    }
  }, [collectionId])

  // Load/reload coins when collection changes
  React.useEffect(() => {
    restoredRef.current = false
    if (!store.loadedCollectionId || store.loadedCollectionId !== collectionId) {
      store.reset()
      store.loadCoins(collectionId)
    } else {
      // Same collection — data already in store, skip re-fetch
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId])

  // Save scroll position before navigating to gallery
  const mainRef = React.useRef<HTMLElement | null>(null)
  const restoredRef = React.useRef(false)

  const handleNavigateToGallery = React.useCallback(() => {
    const main = mainRef.current
    if (main) {
      useCoinStore.getState().saveScrollPosition(collectionId, main.scrollTop)
    }
  }, [collectionId])

  // Restore scroll position immediately before paint
  const { loading, coins } = store
  React.useLayoutEffect(() => {
    if (!mainRef.current) {
      mainRef.current = document.querySelector<HTMLElement>('main')
    }
    if (!loading && coins.length > 0 && !restoredRef.current) {
      const saved = useCoinStore.getState().scrollPositions[collectionId]
      if (saved) {
        const main = mainRef.current
        if (main) {
          main.scrollTop = saved
          restoredRef.current = true
        }
      }
    }
  }, [loading, coins.length, collectionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenCreate = (): void => {
    setEditCoin(undefined)
    setShowForm(true)
  }

  const handleOpenEdit = (coin: Coin): void => {
    setEditCoin(coin)
    setShowForm(true)
  }

  const handleSave = (data: {
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
  }): void => {
    const collectionChanged = editCoin && data.collectionId !== editCoin.collectionId

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

  const handleRefresh = (): void => {
    store.reset()
    store.loadCoins(collectionId)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-800">{collectionName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('coins.title')}</p>
        </div>
        <div className="flex items-center gap-2">
          <LlmPrices collectionId={collectionId} onImported={handleRefresh} />
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
          onNavigateToGallery={handleNavigateToGallery}
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
