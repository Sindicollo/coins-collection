import React from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { AiCoinCard } from './AiCoinCard'
import { useAiStore } from './useAiStore'
import { useCoinStore } from '@/features/coins/useCoins'
import { LlmTools } from '@/features/coins/LlmTools'
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
    bulkProgress,
    bulkTotal,
    bulkRunning,
    coinLoading,
    resumeSession,
    lastCoinTime,
    queryBulk,
    resumeBulk,
    querySingle,
    clearResults,
    clearCoinResult,
    appendCoinToNotes,
    setManualInput,
    parseManualInput,
    cancelBulk,
    checkSession,
    discardSession
  } = store

  const [coins, setCoins] = React.useState<Coin[]>([])
  const [coinsLoading, setCoinsLoading] = React.useState(true)
  const [coinsError, setCoinsError] = React.useState<string | null>(null)
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
        const message = err instanceof Error ? err.message : String(err)
        console.error('[AiPage] Failed to load coins:', message)
        if (!cancelled) setCoinsError(t('ai.loadError', { defaultValue: 'Failed to load coins: {{message}}', message }))
      } finally {
        if (!cancelled) setCoinsLoading(false)
      }
    }

    async function loadCollectionName(): Promise<void> {
      try {
        const col = await window.api.collections.get(collectionId!)
        if (!cancelled && col) setCollectionName(col.name)
      } catch (err) {
        console.warn('[AiPage] Failed to load collection name:', err instanceof Error ? err.message : err)
      }
    }

    loadCoins()
    loadCollectionName()

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId])

  // Clear AI results when collection changes
  React.useEffect(() => {
    clearResults()
  }, [collectionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check for saved bulk sessions on mount
  React.useEffect(() => {
    if (!collectionId) return
    // Check each query type for saved sessions
    for (const qt of ['prices', 'mintage', 'info'] as QueryType[]) {
      checkSession(collectionId, qt)
    }
  }, [collectionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check sessions after a bulk stops (cancel or completion)
  React.useEffect(() => {
    if (!bulkRunning && collectionId && lastQueryType) {
      checkSession(collectionId, lastQueryType as QueryType)
    }
  }, [bulkRunning]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset coin store on unmount so CoinView reloads up-to-date data
  React.useEffect(() => {
    return () => {
      useCoinStore.getState().reset()
    }
  }, [collectionId])

  const handleBulkQuery = async (queryType: QueryType): Promise<void> => {
    console.log('[AiPage] handleBulkQuery:', { collectionId, queryType })
    if (!collectionId) {
      console.warn('[AiPage] No collectionId, skipping query')
      return
    }

    // Warn if many coins with web search enabled
    try {
      const cfg = await window.api.llm.getConfig()
      if (cfg.enableWebSearch && coins.length > 20) {
        const estimatedSec = coins.length * 10
        const mins = Math.ceil(estimatedSec / 60)
        const ok = window.confirm(
          t('ai.largeBulkWarning', {
            defaultValue: `Web search is enabled. Processing ${coins.length} coins may take ~${mins} minutes (≈10 sec per coin). Continue?`,
            count: coins.length,
            minutes: mins
          })
        )
        if (!ok) return
      }
    } catch {
      // If we can't read config, proceed anyway
    }

    queryBulk(collectionId, queryType)
  }

  const handleSingleQuery = (coinId: string, queryType: QueryType): void => {
    querySingle(coinId, queryType)
  }

  const handleCoinUpdated = (coinId: string, newNotes: string): void => {
    setCoins((prev) =>
      prev.map((c) => (c.id === coinId ? { ...c, notes: newNotes } : c))
    )
  }

  const handleBack = (): void => {
    // Reset coin store so CoinView reloads updated notes
    useCoinStore.getState().reset()
    navigate('/')
  }

  const bulkActions = React.useMemo<{ type: QueryType; label: string; emoji: string }[]>(
    () => [
      { type: 'prices', label: t('ai.bulkPrices', { defaultValue: 'Learn Prices' }), emoji: '💰' },
      { type: 'mintage', label: t('ai.bulkMintage', { defaultValue: 'Learn Mintage' }), emoji: '📊' },
      { type: 'info', label: t('ai.bulkInfo', { defaultValue: 'Learn General Info' }), emoji: 'ℹ' }
    ],
    [t]
  )

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
        {collectionId && <LlmTools collectionId={collectionId} />}
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
      </div>

      {/* Resume saved session */}
      {resumeSession && !bulkRunning && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-sm text-blue-700">
            {t('ai.resumeHint', {
              defaultValue: 'Saved session: {{processed}} of {{total}} coins processed.',
              processed: resumeSession.processedCoinIds.length,
              total: coins.length
            })}
          </span>
          <Button
            size="sm"
            onClick={() => {
              if (collectionId) {
                resumeBulk(collectionId, resumeSession.queryType, resumeSession.processedCoinIds)
              }
            }}
          >
            ▶ {t('ai.resume', { defaultValue: 'Resume' })}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              if (collectionId) discardSession(collectionId, resumeSession.queryType)
            }}
          >
            {t('ai.discardSession', { defaultValue: 'Discard' })}
          </Button>
        </div>
      )}

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

      {coinsError && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {coinsError}
        </div>
      )}

      {/* Progress bar for bulk queries */}
      {bulkRunning && bulkTotal > 0 && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-blue-700">
              {t('ai.progress', {
                defaultValue: 'Processed {{processed}} of {{total}} coins',
                processed: bulkProgress,
                total: bulkTotal
              })}
            </span>
            <span className="text-xs text-blue-500">
              {bulkTotal > 0 ? Math.round((bulkProgress / bulkTotal) * 100) : 0}%
              {lastCoinTime > 0 && bulkProgress > 0 && bulkProgress < bulkTotal && (
                <span className="ml-2">
                  {t('ai.eta', {
                    defaultValue: '≈{{minutes}}m left',
                    minutes: Math.max(1, Math.round((lastCoinTime * (bulkTotal - bulkProgress)) / 60000))
                  })}
                </span>
              )}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${bulkTotal > 0 ? (bulkProgress / bulkTotal) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-end mt-2">
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                if (collectionId) cancelBulk(collectionId)
              }}
            >
              ⏹ {t('ai.stop', { defaultValue: 'Stop' })}
            </Button>
          </div>
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
                perCoinLoading={coinLoading[coin.id] ?? false}
                onQuerySingle={handleSingleQuery}
                onAppendToNotes={appendCoinToNotes}
                onClearResult={clearCoinResult}
                onCoinUpdated={handleCoinUpdated}
              />
            ))}
          </div>
        )}
    </div>
    </div>
  )
}
