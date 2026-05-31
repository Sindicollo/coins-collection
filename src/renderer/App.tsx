import React from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { useCollectionStore } from './store/useCollectionStore'
import { Button } from './components/ui/Button'
import { Input } from './components/ui/Input'

function App(): React.ReactElement {
  const { countries, addCountry, selectedCountryId, selectCountry } = useCollectionStore()
  const [newCountryName, setNewCountryName] = React.useState('')

  const handleAddCountry = (): void => {
    if (newCountryName.trim()) {
      addCountry(newCountryName.trim())
      setNewCountryName('')
    }
  }

  return (
    <AppLayout
      sidebar={
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4 text-primary-700">Countries</h2>

          <div className="flex gap-2 mb-4">
            <Input
              placeholder="New country..."
              value={newCountryName}
              onChange={(e) => setNewCountryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCountry()}
              className="flex-1"
            />
            <Button onClick={handleAddCountry} size="sm">
              Add
            </Button>
          </div>

          <ul className="space-y-1">
            {countries.map((country) => (
              <li key={country.id}>
                <button
                  onClick={() => selectCountry(country.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedCountryId === country.id
                      ? 'bg-primary-100 text-primary-800 font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {country.name}
                </button>
              </li>
            ))}
          </ul>

          {countries.length === 0 && (
            <p className="text-sm text-gray-400 mt-4">No countries yet. Add one to get started!</p>
          )}
        </div>
      }
    >
      <div className="flex flex-col items-center justify-center h-full">
        {selectedCountryId ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary-800 mb-2">Coin Collection</h1>
            <p className="text-gray-500">
              Selected:{' '}
              {countries.find((c) => c.id === selectedCountryId)?.name ?? 'Unknown'}
            </p>
          </div>
        ) : (
          <div className="text-center">
            <h1 className="text-3xl font-bold text-primary-800 mb-4">Coin Collection</h1>
            <p className="text-gray-500 text-lg">
              Select a country from the sidebar or add a new one to get started.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default App
