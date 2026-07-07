import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { CoinForm } from './CoinForm'
import { currencySymbol } from '@/utils/currency'
import type { Coin } from '@shared/types'

interface CoinDetailFormProps {
  coin: Coin
  defaultCurrency: string
  onUpdated: (coin: Coin) => void
}

export function CoinDetailForm({ coin, defaultCurrency, onUpdated }: CoinDetailFormProps): React.ReactElement {
  const { t, i18n } = useTranslation()
  const [editing, setEditing] = React.useState(false)

  const conditionLabel = coin.condition ? t(`coins.conditions.${coin.condition}`) : null
  const compositionLabel = coin.composition ? t(`coins.compositions.${coin.composition}`) : null

  const formatDate = (ts: number | null): string => {
    if (!ts) return ''
    return new Date(ts).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatPrice = (value: number | null): string => {
    if (value === null || value === undefined) return ''
    return value.toLocaleString(i18n.language === 'ru' ? 'ru-RU' : undefined)
  }

  const fields: Array<{ label: string; value: string }> = [
    { label: t('coins.denomination'), value: coin.denomination },
    { label: t('coins.year'), value: coin.year?.toString() ?? '' },
    { label: t('coins.condition'), value: conditionLabel ?? '' },
    { label: t('coins.country'), value: coin.country ?? '' },
    { label: t('coins.composition', { defaultValue: 'Composition' }), value: compositionLabel ?? '' },
    { label: t('coins.price'), value: coin.price !== null ? `${formatPrice(coin.price)} ${currencySymbol(coin.currency ?? defaultCurrency)}` : '' },
    { label: t('coins.shippingCost'), value: coin.shippingCost !== null ? `${formatPrice(coin.shippingCost)} ${currencySymbol(coin.currency ?? defaultCurrency)}` : '' },
    { label: t('coins.purchaseDate'), value: formatDate(coin.purchaseDate) },
    { label: t('coins.purchasePlace'), value: coin.purchasePlace ?? '' },
  ].filter((f) => f.value !== '')

  const handleSave = (data: Record<string, unknown>): void => {
    // Only pick known Coin fields to avoid type corruption
    const updated: Coin = {
      ...coin,
      denomination: typeof data.denomination === 'string' ? data.denomination : coin.denomination,
      year: typeof data.year === 'number' ? data.year : coin.year,
      condition: typeof data.condition === 'string' ? (data.condition as Coin['condition']) : coin.condition,
      purchaseDate: typeof data.purchaseDate === 'number' ? data.purchaseDate : coin.purchaseDate,
      purchasePlace: typeof data.purchasePlace === 'string' ? data.purchasePlace : coin.purchasePlace,
      price: typeof data.price === 'number' ? data.price : coin.price,
      shippingCost: typeof data.shippingCost === 'number' ? data.shippingCost : coin.shippingCost,
      currency: typeof data.currency === 'string' ? data.currency : coin.currency,
      country: typeof data.country === 'string' ? data.country : coin.country,
      composition: typeof data.composition === 'string' ? (data.composition as Coin['composition']) : coin.composition,
      extraData: data.extraData && typeof data.extraData === 'object' ? (data.extraData as Record<string, unknown>) : coin.extraData,
      sold: typeof data.sold === 'boolean' ? data.sold : coin.sold,
      onAuction: typeof data.onAuction === 'boolean' ? data.onAuction : coin.onAuction,
      auctionPrice: typeof data.auctionPrice === 'number' ? data.auctionPrice : coin.auctionPrice,
      salePrice: typeof data.salePrice === 'number' ? data.salePrice : coin.salePrice
    }
    onUpdated(updated)
    setEditing(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800">{t('tabs.details', { defaultValue: 'Details' })}</h3>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          {t('coins.edit', { defaultValue: 'Edit' })}
        </Button>
      </div>

      <dl className="space-y-4">
        {fields.map((f) => (
          <div key={f.label}>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{f.label}</dt>
            <dd className="mt-0.5 text-sm text-gray-800">{f.value || '—'}</dd>
          </div>
        ))}

        {coin.sold && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t('coins.sold')}</dt>
            <dd className="mt-0.5 text-sm text-green-700">
              {coin.salePrice !== null ? `${formatPrice(coin.salePrice)} ${currencySymbol(coin.currency ?? defaultCurrency)}` : '\u2713'}
            </dd>
          </div>
        )}

        {coin.onAuction && (
          <div>
            <dt className="text-xs font-medium text-orange-600 uppercase tracking-wider">{t('coins.onAuction')}</dt>
            <dd className="mt-0.5 text-sm text-orange-800">
              {coin.auctionPrice !== null ? `${formatPrice(coin.auctionPrice)} ${currencySymbol(coin.currency ?? defaultCurrency)}` : '\u2713'}
            </dd>
          </div>
        )}
      </dl>

      {/* Edit modal — opened on demand */}
      <CoinForm
        key={coin.id}
        open={editing}
        coin={coin}
        defaultCurrency={defaultCurrency}
        collections={[]}
        countrySuggestions={[]}
        onSave={handleSave}
        onClose={() => setEditing(false)}
      />
    </div>
  )
}
