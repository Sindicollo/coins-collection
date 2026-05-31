import React from 'react'
import { useTranslation } from 'react-i18next'
import { AppLayout } from './components/layout/AppLayout'
import { CountrySidebar } from './features/countries/CountrySidebar'
import { useCountryManager } from './features/countries/useCountries'

function App(): React.ReactElement {
  const { t } = useTranslation()
  const { countries, selectedId } = useCountryManager()

  return (
    <AppLayout sidebar={<CountrySidebar />}>
      <div className="flex flex-col items-center justify-center h-full">
        {selectedId ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary-800 mb-2">
              {t('app.title')}
            </h1>
            <p className="text-gray-500">
              {t('app.selected', {
                name: countries.find((c) => c.id === selectedId)?.name ?? '?'
              })}
            </p>
          </div>
        ) : (
          <div className="text-center">
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
            <h1 className="text-3xl font-bold text-primary-800 mb-2">
              {t('app.title')}
            </h1>
            <p className="text-gray-500 text-lg">{t('app.emptyState')}</p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default App
