import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Autocomplete } from '@/components/ui/Autocomplete'
import { CURRENCIES } from '@/utils/currency'
import type { Coin, CoinCondition } from '@shared/types'
import { COIN_CONDITIONS } from '@shared/types'

interface CoinFormData {
  countryId: string
  denomination: string
  country: string
  year: string
  condition: CoinCondition | ''
  purchaseDate: string
  purchasePlace: string
  price: string
  shippingCost: string
  currency: string
  notes: string
}

function coinToFormData(coin?: Coin, defaultCurrency = 'RUB'): CoinFormData {
  if (!coin) {
    return {
      countryId: '',
      denomination: '',
      country: '',
      year: '',
      condition: '',
      purchaseDate: '',
      purchasePlace: '',
      price: '',
      shippingCost: '',
      currency: defaultCurrency,
      notes: ''
    }
  }
  return {
    countryId: coin.countryId,
    denomination: coin.denomination,
    country: coin.country ?? '',
    year: coin.year?.toString() ?? '',
    condition: coin.condition ?? '',
    purchaseDate: coin.purchaseDate
      ? new Date(coin.purchaseDate).toISOString().slice(0, 10)
      : '',
    purchasePlace: coin.purchasePlace ?? '',
    price: coin.price?.toString() ?? '',
    shippingCost: coin.shippingCost?.toString() ?? '',
    currency: coin.currency ?? defaultCurrency,
    notes: coin.notes ?? ''
  }
}

interface CoinFormProps {
  open: boolean
  coin?: Coin
  defaultCurrency: string
  collections: Array<{ id: string; name: string }>
  countrySuggestions: string[]
  onSave: (data: {
    countryId: string
    denomination: string
    country: string | null
    year: number | null
    condition: CoinCondition | null
    purchaseDate: number | null
    purchasePlace: string | null
    price: number | null
    shippingCost: number | null
    currency: string | null
    notes: string | null
  }) => void
  onClose: () => void
}

export function CoinForm({ open, coin, defaultCurrency, collections, countrySuggestions, onSave, onClose }: CoinFormProps): React.ReactElement {
  const { t } = useTranslation()
  const isEdit = !!coin
  const [data, setData] = React.useState<CoinFormData>(coinToFormData(coin, defaultCurrency))
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setData(coinToFormData(coin, defaultCurrency))
    setError(null)
  }, [coin, open, defaultCurrency])

  const handleChange = (field: keyof CoinFormData, value: string): void => {
    setData((prev) => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!data.denomination.trim()) {
      setError(t('coins.errors.denominationRequired'))
      return
    }
    if (!data.countryId) {
      setError(t('coins.selectCountry'))
      return
    }

    onSave({
      countryId: data.countryId,
      denomination: data.denomination.trim(),
      country: data.country.trim() || null,
      year: data.year ? parseInt(data.year, 10) : null,
      condition: data.condition || null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate).getTime() : null,
      purchasePlace: data.purchasePlace.trim() || null,
      price: data.price ? parseFloat(data.price) : null,
      shippingCost: data.shippingCost ? parseFloat(data.shippingCost) : null,
      currency: data.currency || null,
      notes: data.notes.trim() || null
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('coins.editTitle') : t('coins.createTitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Collection select */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            {t('countries.title')}
          </label>
          <select
            value={data.countryId}
            onChange={(e) => handleChange('countryId', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">—</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <Input
          label={t('coins.denomination')}
          value={data.denomination}
          onChange={(e) => handleChange('denomination', e.target.value)}
          placeholder="e.g. 1 рубль, 50 cents"
          error={error ?? undefined}
          autoFocus
        />

        <Autocomplete
          label={t('coins.country')}
          value={data.country}
          onChange={(v) => handleChange('country', v)}
          suggestions={countrySuggestions}
          placeholder="e.g. UK, Russia, USA..."
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('coins.year')}
            type="number"
            value={data.year}
            onChange={(e) => handleChange('year', e.target.value)}
            placeholder="e.g. 1990"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('coins.condition')}
            </label>
            <select
              value={data.condition}
              onChange={(e) => handleChange('condition', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">—</option>
              {COIN_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {t(`coins.conditions.${c}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('coins.price')}
            type="number"
            step="0.01"
            value={data.price}
            onChange={(e) => handleChange('price', e.target.value)}
            placeholder="0.00"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('coins.currency')}
            </label>
            <select
              value={data.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label={t('coins.shippingCost')}
          type="number"
          step="0.01"
          value={data.shippingCost}
          onChange={(e) => handleChange('shippingCost', e.target.value)}
          placeholder="0.00"
        />

        <Input
          label={t('coins.purchaseDate')}
          type="date"
          value={data.purchaseDate}
          onChange={(e) => handleChange('purchaseDate', e.target.value)}
        />

        <Input
          label={t('coins.purchasePlace')}
          value={data.purchasePlace}
          onChange={(e) => handleChange('purchasePlace', e.target.value)}
          placeholder="eBay, Мешок, аукцион..."
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            {t('coins.notes')}
          </label>
          <textarea
            value={data.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={2}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm resize-none
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('coins.cancel')}
          </Button>
          <Button type="submit" size="sm">
            {t('coins.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
