import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppLayout } from './components/layout/AppLayout'
import { SettingsModal } from './components/common/SettingsModal'
import { CollectionSidebar } from './features/collections/CollectionSidebar'
import { CoinView } from './features/coins/CoinView'
import { PhotoGallery } from './features/photos/PhotoGallery'
import { useCollectionManager } from './features/collections/useCollections'

function HomeView(): React.ReactElement {
  const { t } = useTranslation()
  const { collections, selectedId } = useCollectionManager()
  const selectedCollection = selectedId ? collections.find((c) => c.id === selectedId) : null

  const [defaultCurrency, setDefaultCurrency] = React.useState('RUB')

  React.useEffect(() => {
    window.api.preferences.getCurrency().then(setDefaultCurrency)
  }, [])

  if (selectedCollection) {
    return (
      <CoinView
        collectionId={selectedCollection.id}
        collectionName={selectedCollection.name}
        defaultCurrency={defaultCurrency}
        collections={collections}
      />
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="mb-4">
        <svg
          className="w-16 h-16 mx-auto text-primary-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-primary-800 mb-2">{t('app.title')}</h1>
      <p className="text-gray-500 text-lg">{t('app.emptyState')}</p>
    </div>
  )
}

function App(): React.ReactElement {
  const [showSettings, setShowSettings] = React.useState(false)
  const [defaultCurrency, setDefaultCurrency] = React.useState('RUB')

  React.useEffect(() => {
    window.api.preferences.getCurrency().then(setDefaultCurrency)
  }, [])

  const handleSaveCurrency = (currency: string): void => {
    window.api.preferences.setCurrency(currency)
    setDefaultCurrency(currency)
  }

  return (
    <>
      <Routes>
        <Route
          path="/coins/:collectionId/photo/:coinId"
          element={<PhotoGallery onOpenSettings={() => setShowSettings(true)} />}
        />
        <Route
          path="*"
          element={
            <AppLayout
              sidebar={<CollectionSidebar />}
              onOpenSettings={() => setShowSettings(true)}
            >
              <HomeView />
            </AppLayout>
          }
        />
      </Routes>

      <SettingsModal
        open={showSettings}
        currency={defaultCurrency}
        onSaveCurrency={handleSaveCurrency}
        onClose={() => setShowSettings(false)}
      />
    </>
  )
}

export default App
