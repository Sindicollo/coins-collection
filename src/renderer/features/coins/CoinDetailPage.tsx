import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { ArrowLeft } from '@/components/ui/icons/ArrowLeft'
import { Note } from '@/components/ui/icons/Note'
import { Coin } from '@/components/ui/icons/Coin'
import { Photo } from '@/components/ui/icons/Photo'
import { CoinDetailForm } from './CoinDetailForm'
import { CoinNotesList } from '@/features/notes/CoinNotesList'
import { CoinPhotosTab } from './CoinPhotosTab'
import type { Coin as CoinType } from '@shared/types'

export function CoinDetailPage(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { coinId } = useParams<{ collectionId: string; coinId: string }>()

  const [coin, setCoin] = React.useState<CoinType | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState('details')
  const [noteCount, setNoteCount] = React.useState(0)
  const [photoCount, setPhotoCount] = React.useState(0)
  const [defaultCurrency, setDefaultCurrency] = React.useState('RUB')

  React.useEffect(() => {
    window.api.preferences.getCurrency().then(setDefaultCurrency)
  }, [])

  React.useEffect(() => {
    let cancelled = false

    if (!coinId) {
      setError('No coin ID provided')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    window.api.coins
      .get(coinId)
      .then((data) => {
        if (!cancelled) setCoin(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    window.api.notes
      .countByCoin(coinId)
      .then((count) => { if (!cancelled) setNoteCount(count) })
      .catch(() => { if (!cancelled) setNoteCount(0) })

    window.api.photos
      .list(coinId)
      .then((list) => { if (!cancelled) setPhotoCount(list.length) })
      .catch(() => { if (!cancelled) setPhotoCount(0) })

    return () => { cancelled = true }
  }, [coinId])

  const handleCoinUpdated = (updated: CoinType): void => {
    setCoin(updated)
  }

  const handleBack = (): void => {
    navigate(-1)
  }

  const conditionLabel = coin?.condition ? t(`coins.conditions.${coin.condition}`) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !coin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-gray-500">{error || t('coins.notFound', { defaultValue: 'Coin not found' })}</p>
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('coins.back', { defaultValue: 'Back' })}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleBack}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors flex-shrink-0"
            title={t('coins.back', { defaultValue: 'Back' })}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-800 truncate">{coin.denomination}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
              {coin.year && <span>{coin.year}</span>}
              {conditionLabel && <span>· {conditionLabel}</span>}
              {coin.country && <span>· {coin.country}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Body: Tabs (vertical) */}
      <div className="flex flex-1 min-h-0">
        <Tabs selected={activeTab} onSelect={setActiveTab}>
          <TabList className="w-44 bg-gray-50 flex-shrink-0 h-full overflow-y-auto">
            <Tab id="details">
              <Coin className="w-4 h-4 mr-2" />
              {t('tabs.details', { defaultValue: 'Details' })}
            </Tab>
            <Tab id="notes" badge={noteCount}>
              <Note className="w-4 h-4 mr-2" />
              {t('tabs.notes', { defaultValue: 'Notes' })}
            </Tab>
            <Tab id="photos" badge={photoCount}>
              <Photo className="w-4 h-4 mr-2" />
              {t('tabs.photos', { defaultValue: 'Photos' })}
            </Tab>
          </TabList>

          <div className="flex-1 min-w-0 overflow-y-auto">
            <TabPanel id="details" className="p-6">
              <CoinDetailForm
                coin={coin}
                defaultCurrency={defaultCurrency}
                onUpdated={handleCoinUpdated}
              />
            </TabPanel>

            <TabPanel id="notes" className="p-6">
              <CoinNotesList
                coinId={coin.id}
                onCountChange={setNoteCount}
              />
            </TabPanel>

            <TabPanel id="photos" className="p-6">
              <CoinPhotosTab
                coinId={coin.id}
                collectionId={coin.collectionId}
                onCountChange={setPhotoCount}
              />
            </TabPanel>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
