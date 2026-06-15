import React from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { AiCoinCard } from './AiCoinCard'
import { AiSettingsModal } from './AiSettingsModal'
import { useAiStore } from './useAiStore'
import type { Coin, QueryType } from '@shared/types'

export function AiPage(): React.ReactElement {
  const { t } = useTranslation()
  const { collectionId } = useParams<{ collectionId: string }>()
  const navigate = useNavigate()

  const store = useAiStore()
  const {
    results,
    loading,
    error,
    lastQueryType,
    manualInput,
    queryBulk,
    querySingle,
    clearResults,
    clearCoinResult,
    appendCoinToNotes,
    setManualInput,
    parseManualInput
  } = store

  const [coins, setCoins] = React.useState<Coin[]>([])
  const [coinsLoading, setCoinsLoading] = React.useState(true)
  const [showSettings, setShowSettings] = React.useState(false)
  const [showManualInput, setShowManualInput] = React.useState(false)
  const [collectionName, setCollectionName] = React.useState('')

  // Load coins for this collection
  React.useEffect(() => {
    if (!collectionId) return

    let cancelled = false
    setCoinsLoading(true)

    async function loadCoins(): Promise<void> {
      try {
        const result = await window.api.coins.list(collectionId!, null, 1000)
        if (cancelled) return
        setCoins(result.items)
      } catch (err) {
        console.error('Failed to load coins for AI page:', err)
      } finally {
        if (!cancelled) setCoinsLoading(false)
      }
    }

    async function loadCollectionName(): Promise<void> {
      try {
        const col = await window.api.collections.get(collectionId!)
        if (!cancelled && col) setCollectionName(col.name)
      } catch {
        // ignore
      }
    }

    loadCoins()
    loadCollectionName()

    return () => {
      cancelled = true
    }
  }, [collectionId])

  // Clear AI results when collection changes
  React.useEffect(() => {
    clearResults()
  }, [collectionId, clearResults])

  const handleBulkQuery = (queryType: string): void => {
    if (!collectionId) return
    queryBulk(collectionId, queryType)
  }

  const handleSingleQuery = (coinId: string, queryType: QueryType): void => {
    querySingle(coinId, queryType)
  }

  const handleBack = (): void => {
    navigate('/')
  }

  const bulkActions: { type: string; label: string; emoji: string }[] = [
    { type: 'prices', label: t('ai.bulkPrices', { defaultValue: 'Learn Prices' }), emoji: '💰' },
    { type: 'mintage', label: t('ai.bulkMintage', { defaultValue: 'Learn Mintage' }), emoji: '📊' },
    { type: 'info', label: t('ai.bulkInfo', { defaultValue: 'Learn General Info' }), emoji: 'ℹ' }
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Button size="sm" variant="ghost" onClick={handleBack}>
            ← {t('ai.back', { defaultValue: 'Back' })}
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-primary-800 truncate">
              {t('ai.title', { defaultValue: 'AI Assistant' })}
            </h1>
            {collectionName && (
              <p className="text-sm text-gray-500 truncate">{collectionName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Bulk action buttons */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {bulkActions.map((action) => (
          <Button
            key={action.type}
            size="sm"
            onClick={() => handleBulkQuery(action.type)}
            disabled={loading}
          >
            {action.emoji} {action.label}
          </Button>
        ))}

        <div className="flex-1" />

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowManualInput(!showManualInput)}
        >
          {showManualInput ? '▲' : '▼'}{' '}
          {t('ai.manualInput', { defaultValue: 'Manual Input' })}
        </Button>

        <Button size="sm" variant="ghost" onClick={() => setShowSettings(true)}>
          ⚙ {t('ai.settingsButton', { defaultValue: 'Settings' })}
        </Button>
      </div>

      {/* Loading / error indicators */}
      {(loading || coinsLoading) && (
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
          <span className="inline-block w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
          {loading
            ? t('ai.queryingCollection', {
                defaultValue: 'Asking AI about {{type}}...',
                type: lastQueryType || '...'
              })
            : t('ai.loadingCoins', { defaultValue: 'Loading coins...' })}
        </div>
      )}

      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Manual input section */}
      {showManualInput && (
        <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            {t('ai.pasteJson', {
              defaultValue: 'Paste JSON response from AI chat (array of objects with "id" field):'
            })}
          </label>
          <textarea
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono
              resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder='[{"id": "...", "info": "...", "price": "..."}]'
          />
          <div className="flex justify-end mt-1.5">
            <Button size="xs" onClick={parseManualInput} disabled={!manualInput.trim()}>
              {t('ai.parseJson', { defaultValue: 'Parse JSON' })}
            </Button>
          </div>
        </div>
      )}

      {/* Coin list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {coins.length === 0 && !coinsLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">{t('coins.noCoins')}</p>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {coins.map((coin) => (
              <AiCoinCard
                key={coin.id}
                coin={coin}
                aiResult={results[coin.id]}
                loading={loading}
                onQuerySingle={handleSingleQuery}
                onAppendToNotes={appendCoinToNotes}
                onClearResult={clearCoinResult}
              />
            ))}
          </div>
        )}
      </div>

      {/* Settings modal */}
      <AiSettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
