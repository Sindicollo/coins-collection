import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppLayout } from './components/layout/AppLayout'
import { SettingsModal } from './components/common/SettingsModal'
import { Coin } from '@/components/ui/icons/Coin'
import { CollectionSidebar } from './features/collections/CollectionSidebar'
import { CoinView } from './features/coins/CoinView'
import { PhotoGallery } from './features/photos/PhotoGallery'
import { ExportDialog } from './features/export/ExportDialog'
import { ExportPdfDialog } from './features/export-pdf/ExportPdfDialog'
import { AiPage } from './features/ai'
import { useExportStore } from './features/export/useExport'
import { useExportPdfStore } from './features/export-pdf/useExportPdf'
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
        <Coin className="w-16 h-16 mx-auto text-primary-300" />
      </div>
      <h1 className="text-3xl font-bold text-primary-800 mb-2">{t('app.title')}</h1>
      <p className="text-gray-500 text-lg">{t('app.emptyState')}</p>
    </div>
  )
}

function App(): React.ReactElement {
  const [showSettings, setShowSettings] = React.useState(false)
  const [defaultCurrency, setDefaultCurrency] = React.useState('RUB')
  const exportOpen = useExportStore((s) => s.open)
  const exportError = useExportStore((s) => s.error)
  const exportPdfOpen = useExportPdfStore((s) => s.open)
  const exportPdfError = useExportPdfStore((s) => s.error)

  // Close settings after successful Excel export (dialog closes)
  const prevExportOpen = React.useRef(exportOpen)
  React.useEffect(() => {
    if (prevExportOpen.current && !exportOpen && !exportError) {
      setShowSettings(false)
    }
    prevExportOpen.current = exportOpen
  }, [exportOpen, exportError])

  // Close settings after successful PDF export (dialog closes)
  const prevExportPdfOpen = React.useRef(exportPdfOpen)
  React.useEffect(() => {
    if (prevExportPdfOpen.current && !exportPdfOpen && !exportPdfError) {
      setShowSettings(false)
    }
    prevExportPdfOpen.current = exportPdfOpen
  }, [exportPdfOpen, exportPdfError])

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
          path="/ai/:collectionId"
          element={
            <AppLayout
              sidebar={<CollectionSidebar />}
              onOpenSettings={() => setShowSettings(true)}
            >
              <AiPage />
            </AppLayout>
          }
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

      <ExportDialog />
      <ExportPdfDialog />
    </>
  )
}

export default App
