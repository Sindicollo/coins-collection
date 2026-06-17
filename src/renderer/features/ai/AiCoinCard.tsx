import React from 'react'
import { useTranslation } from 'react-i18next'
import type { Coin, AiCoinInfo, QueryType } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface AiCoinCardProps {
  coin: Coin
  aiResult: AiCoinInfo | undefined
  loading: boolean
  onQuerySingle: (coinId: string, queryType: QueryType) => void
  onAppendToNotes: (coinId: string) => Promise<string | null>
  onClearResult: (coinId: string) => void
  onCoinUpdated: (coinId: string, newNotes: string) => void
}

export function AiCoinCard({
  coin,
  aiResult,
  loading,
  onQuerySingle,
  onAppendToNotes,
  onClearResult,
  onCoinUpdated
}: AiCoinCardProps): React.ReactElement {
  const { t } = useTranslation()

  const conditionLabel = coin.condition ? t(`coins.conditions.${coin.condition}`) : null

  const textareaContent = React.useMemo(() => {
    const lines: string[] = []
    if (coin.notes) {
      lines.push(coin.notes)
    }
    if (aiResult) {
      const parts: string[] = []
      if (aiResult.info) parts.push(aiResult.info)
      if (aiResult.price) parts.push(`💲 ${t('ai.field.price', { defaultValue: 'Price' })}: ${aiResult.price}`)
      if (aiResult.mintage) parts.push(`📊 ${t('ai.field.mintage', { defaultValue: 'Mintage' })}: ${aiResult.mintage}`)
      if (aiResult.rarity) parts.push(`🔍 ${t('ai.field.rarity', { defaultValue: 'Rarity' })}: ${aiResult.rarity}`)
      if (aiResult.varieties && aiResult.varieties.length > 0) {
        parts.push(`🔄 ${t('ai.field.varieties', { defaultValue: 'Varieties' })}: ${aiResult.varieties.join(', ')}`)
      }
      const aiText = parts.join('\n')
      if (aiText) {
        if (lines.length > 0) lines.push('')
        lines.push('--- AI ---')
        lines.push(aiText)
      }
    }
    return lines.join('\n')
  }, [coin.notes, aiResult, t])

  const [appendingId, setAppendingId] = React.useState<string | null>(null)

  const handleAppend = async (): Promise<void> => {
    setAppendingId(coin.id)
    const newNotes = await onAppendToNotes(coin.id)
    if (newNotes) {
      onCoinUpdated(coin.id, newNotes)
    }
    setAppendingId(null)
  }

  return (
    <Card className="p-3">
      {/* Coin info header */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="font-semibold text-gray-800">{coin.denomination}</span>
        {coin.year && (
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
            {coin.year}
          </span>
        )}
        {conditionLabel && (
          <span className="text-xs text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded shrink-0">
            {conditionLabel}
          </span>
        )}
        {coin.country && (
          <span className="text-xs text-gray-400 shrink-0">{coin.country}</span>
        )}
      </div>

      {/* Textarea with notes + AI info */}
      <textarea
        readOnly
        value={textareaContent}
        className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs
          bg-gray-50 text-gray-700 resize-y min-h-[80px]
          focus:outline-none font-mono leading-relaxed"
        rows={4}
      />

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
          <span className="inline-block w-3 h-3 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
          {t('ai.querying', { defaultValue: 'Querying...' })}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        {aiResult && (
          <>
            <Button
              size="xs"
              variant="ghost"
              onClick={handleAppend}
              disabled={appendingId === coin.id}
            >
              {appendingId === coin.id ? '...' : t('ai.appendToNotes', { defaultValue: 'Append to Notes' })}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => onClearResult(coin.id)}
            >
              {t('ai.clearResult', { defaultValue: 'Clear' })}
            </Button>
            <span className="text-gray-300 mx-0.5">|</span>
          </>
        )}

        <Button
          size="xs"
          variant="ghost"
          onClick={() => onQuerySingle(coin.id, 'prices')}
          disabled={loading}
        >
          💰 {t('ai.queryPrice', { defaultValue: 'eBay price' })}
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onQuerySingle(coin.id, 'mintage')}
          disabled={loading}
        >
          📊 {t('ai.queryMintage', { defaultValue: 'Mintage' })}
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onQuerySingle(coin.id, 'info')}
          disabled={loading}
        >
          ℹ {t('ai.queryInfo', { defaultValue: 'Info' })}
        </Button>
      </div>
    </Card>
  )
}
