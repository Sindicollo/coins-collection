import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { Coin, AiCoinInfo, Photo, QueryType } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Coin as CoinIcon } from '@/components/ui/icons/Coin'
import { getCachedPhotoData, getCachedPhotoList, fetchAndCachePhotoList, fetchAndCachePhotoData } from '@/features/photos/photoDataCache'

interface AiCoinCardProps {
  coin: Coin
  aiResult: AiCoinInfo | undefined
  loading: boolean
  perCoinLoading: boolean
  onQuerySingle: (coinId: string, queryType: QueryType) => void
  onAppendToNotes: (coinId: string) => Promise<boolean>
  onClearResult: (coinId: string) => void
}

export function AiCoinCard({
  coin,
  aiResult,
  loading,
  perCoinLoading,
  onQuerySingle,
  onAppendToNotes,
  onClearResult
}: AiCoinCardProps): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const conditionLabel = coin.condition ? t(`coins.conditions.${coin.condition}`) : null

  // Photo loading — same pattern as CoinCard
  const cachedList = getCachedPhotoList(coin.id)
  const cachedThumbs = cachedList
    ? cachedList
        .slice(0, 4)
        .map((p) => getCachedPhotoData(p.id))
        .filter((d): d is string => !!d)
    : []
  const allCached = cachedList
    ? cachedList.slice(0, 4).every((p) => !!getCachedPhotoData(p.id))
    : false

  const [thumbs, setThumbs] = React.useState<string[]>(cachedThumbs)
  const [photosLoaded, setPhotosLoaded] = React.useState(allCached)
  const [knownCount, setKnownCount] = React.useState(cachedList ? Math.min(4, cachedList.length) : -1)
  const mountedRef = React.useRef(true)

  React.useEffect(() => {
    mountedRef.current = true
    if (allCached) return

    setPhotosLoaded(false)

    fetchAndCachePhotoList(coin.id)
      .then(async (photos: Photo[]) => {
        if (!mountedRef.current) return

        setKnownCount(photos.length)

        const results = await Promise.allSettled(
          photos.slice(0, 4).map((p) => fetchAndCachePhotoData(p.id))
        )
        const thumbnails = results.flatMap((r) =>
          r.status === 'fulfilled' && r.value && r.value.startsWith('data:image/')
            ? [r.value]
            : []
        )

        if (mountedRef.current) {
          setThumbs(thumbnails)
          setPhotosLoaded(true)
        }
      })
      .catch(() => {
        if (mountedRef.current) setPhotosLoaded(true)
      })

    return () => {
      mountedRef.current = false
    }
  }, [coin.id, allCached])

  const textareaContent = React.useMemo(() => {
    if (!aiResult) return ''
    const parts: string[] = []
    if (aiResult.info) parts.push(aiResult.info)
    if (aiResult.price) parts.push(t('ai.field.priceFull', { defaultValue: '💲 Price: {{value}}', value: aiResult.price }))
    if (aiResult.mintage) parts.push(t('ai.field.mintageFull', { defaultValue: '📊 Mintage: {{value}}', value: aiResult.mintage }))
    if (aiResult.rarity) parts.push(t('ai.field.rarityFull', { defaultValue: '🔍 Rarity: {{value}}', value: aiResult.rarity }))
    if (aiResult.varieties && aiResult.varieties.length > 0) {
      parts.push(t('ai.field.varietiesFull', { defaultValue: '🔄 Varieties: {{value}}', value: aiResult.varieties.join(', ') }))
    }
    return parts.join('\n')
  }, [aiResult, t])

  const [appendingId, setAppendingId] = React.useState<string | null>(null)
  const [savedOk, setSavedOk] = React.useState(false)

  // Reset the "saved" indicator when a new AI result arrives
  React.useEffect(() => {
    setSavedOk(false)
  }, [aiResult])

  const handleAppend = async (): Promise<void> => {
    setAppendingId(coin.id)
    const ok = await onAppendToNotes(coin.id)
    setSavedOk(ok)
    setAppendingId(null)
  }

  const goToGallery = (): void => {
    if (coin.collectionId && coin.id) {
      navigate(`/coins/${coin.collectionId}/photo/${coin.id}`)
    }
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

      {/* Two-column layout: photos + textarea */}
      <div className="flex gap-3">
        {/* Left column: photo thumbnails */}
        <div className="shrink-0">
          <div className="flex flex-wrap gap-1.5" style={{ maxWidth: '140px' }}>
            {!photosLoaded ? (
              <>
                {knownCount >= 0
                  ? Array.from({ length: Math.min(knownCount, 4) }).map((_, i) => (
                      <div
                        key={i}
                        className="h-16 w-14 rounded bg-gray-100 animate-pulse shrink-0"
                      />
                    ))
                  : (
                      <div className="h-16 w-14 rounded bg-gray-100 animate-pulse shrink-0" />
                    )
                }
              </>
            ) : thumbs.length > 0 ? (
              thumbs.map((dataUrl, i) => (
                <img
                  key={i}
                  src={dataUrl}
                  alt=""
                  className="h-16 w-14 object-cover rounded border border-gray-200 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={goToGallery}
                />
              ))
            ) : (
              <div
                className="h-16 w-14 rounded border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0"
              >
                <CoinIcon className="w-6 h-6 text-gray-300" />
              </div>
            )}
          </div>
        </div>

        {/* Right column: textarea + actions */}
        <div className="flex-1 min-w-0">
          <textarea
            readOnly
            value={textareaContent}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs
              bg-gray-50 text-gray-700 resize-y min-h-[80px]
              focus:outline-none font-mono leading-relaxed"
            rows={4}
          />

          {/* Loading indicator */}
          {perCoinLoading && (
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
                  {appendingId === coin.id
                    ? '...'
                    : savedOk
                      ? `✓ ${t('ai.savedToNotes', { defaultValue: 'Saved to notes' })}`
                      : t('ai.appendToNotes', { defaultValue: 'Append to Notes' })}
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
        </div>
      </div>
    </Card>
  )
}
