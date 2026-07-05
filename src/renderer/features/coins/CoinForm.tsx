import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Autocomplete } from '@/components/ui/Autocomplete'
import { CURRENCIES } from '@/utils/currency'
import type { Coin, CoinComposition, CoinCondition } from '@shared/types'
import { COIN_CONDITIONS, COIN_COMPOSITIONS } from '@shared/types'

interface CoinFormData {
  collectionId: string
  denomination: string
  country: string
  year: string
  condition: CoinCondition | ''
  composition: CoinComposition | ''
  purchaseDate: string
  purchasePlace: string
  price: string
  shippingCost: string
  currency: string
  sold: boolean
  onAuction: boolean
  auctionPrice: string
  salePrice: string
}

function coinToFormData(coin?: Coin, defaultCurrency = 'RUB'): CoinFormData {
  if (!coin) {
    return {
      collectionId: '',
      denomination: '',
      country: '',
      year: '',
      condition: '',
      composition: '',
      purchaseDate: '',
      purchasePlace: '',
      price: '',
      shippingCost: '',
      currency: defaultCurrency,
      sold: false,
      onAuction: false,
      auctionPrice: '',
      salePrice: ''
    }
  }
  return {
    collectionId: coin.collectionId,
    denomination: coin.denomination,
    country: coin.country ?? '',
    year: coin.year?.toString() ?? '',
    condition: coin.condition ?? '',
    composition: coin.composition ?? '',
    purchaseDate: coin.purchaseDate
      ? new Date(coin.purchaseDate).toISOString().slice(0, 10)
      : '',
    purchasePlace: coin.purchasePlace ?? '',
    price: coin.price?.toString() ?? '',
    shippingCost: coin.shippingCost?.toString() ?? '',
    currency: coin.currency ?? defaultCurrency,
    sold: coin.sold,
    onAuction: coin.onAuction,
    auctionPrice: coin.auctionPrice?.toString() ?? '',
    salePrice: coin.salePrice?.toString() ?? ''
  }
}

interface CoinFormProps {
  open: boolean
  coin?: Coin
  defaultCurrency: string
  collections: Array<{ id: string; name: string }>
  countrySuggestions: string[]
  onSave: (data: {
    collectionId: string
    denomination: string
    country: string | null
    year: number | null
    condition: CoinCondition | null
    composition: CoinComposition | null
    purchaseDate: number | null
    purchasePlace: string | null
    price: number | null
    shippingCost: number | null
    currency: string | null
    sold: boolean
    onAuction: boolean
    auctionPrice: number | null
    salePrice: number | null
  }) => void
  onClose: () => void
}

export function CoinForm({ open, coin, defaultCurrency, collections, countrySuggestions, onSave, onClose }: CoinFormProps): React.ReactElement {
  const { t } = useTranslation()
  const isEdit = !!coin
  const [data, setData] = React.useState<CoinFormData>(() => coinToFormData(coin, defaultCurrency))
  const [error, setError] = React.useState<string | null>(null)
  const fieldId = React.useId()

  // Reset error when the form opens
  React.useEffect(() => {
    if (open) setError(null)
  }, [open])

  const handleChange = (field: keyof CoinFormData, value: string): void => {
    setData((prev) => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  const handleCheckboxChange = (field: 'sold' | 'onAuction', value: boolean): void => {
    setData((prev) => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!data.denomination.trim()) {
      setError(t('coins.errors.denominationRequired'))
      return
    }
    if (!data.collectionId) {
      setError(t('coins.selectCollection'))
      return
    }

    onSave({
      collectionId: data.collectionId,
      denomination: data.denomination.trim(),
      country: data.country.trim() || null,
      year: data.year ? parseInt(data.year, 10) : null,
      condition: data.condition || null,
      composition: data.composition || null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate + 'T00:00:00').getTime() : null,
      purchasePlace: data.purchasePlace.trim() || null,
      price: data.price ? parseFloat(data.price) : null,
      shippingCost: data.shippingCost ? parseFloat(data.shippingCost) : null,
      currency: data.currency || null,
      sold: data.sold,
      onAuction: data.onAuction,
      auctionPrice: data.auctionPrice ? parseFloat(data.auctionPrice) : null,
      salePrice: data.salePrice ? parseFloat(data.salePrice) : null
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
          <label htmlFor={`${fieldId}-collection`} className="text-sm font-medium text-gray-700">
            {t('collections.title')}
          </label>
          <select
            id={`${fieldId}-collection`}
            value={data.collectionId}
            onChange={(e) => handleChange('collectionId', e.target.value)}
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
          placeholder={t('coins.denominationPlaceholder', { defaultValue: 'e.g. 1 рубль, 50 cents' })}
          error={error ?? undefined}
          autoFocus
        />

        <Autocomplete
          label={t('coins.country')}
          value={data.country}
          onChange={(v) => handleChange('country', v)}
          suggestions={countrySuggestions}
          placeholder={t('coins.countryPlaceholder', { defaultValue: 'e.g. UK, Russia, USA…' })}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('coins.year')}
            type="number"
            value={data.year}
            onChange={(e) => handleChange('year', e.target.value)}
            placeholder={t('coins.yearPlaceholder', { defaultValue: 'e.g. 1990' })}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor={`${fieldId}-condition`} className="text-sm font-medium text-gray-700">
              {t('coins.condition')}
            </label>
            <select
              id={`${fieldId}-condition`}
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

        {/* Composition / metal */}
        <div className="flex flex-col gap-1">
          <label htmlFor={`${fieldId}-composition`} className="text-sm font-medium text-gray-700">
            {t('coins.composition', { defaultValue: 'Composition' })}
          </label>
          <select
            id={`${fieldId}-composition`}
            value={data.composition}
            onChange={(e) => handleChange('composition', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">—</option>
            {COIN_COMPOSITIONS.map((c) => (
              <option key={c} value={c}>
                {t(`coins.compositions.${c}`)}
              </option>
            ))}
          </select>
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
            <label htmlFor={`${fieldId}-currency`} className="text-sm font-medium text-gray-700">
              {t('coins.currency')}
            </label>
            <select
              id={`${fieldId}-currency`}
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
          placeholder={t('coins.purchasePlaceholder', { defaultValue: 'eBay, Мешок, аукцион…' })}
        />

        {/* Sold checkbox */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={data.sold}
            onChange={(e) => handleCheckboxChange('sold', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-gray-700">{t('coins.sold')}</span>
        </label>

        {/* Auction checkbox */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={data.onAuction}
            onChange={(e) => handleCheckboxChange('onAuction', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
          />
          <span className="text-sm font-medium text-gray-700">{t('coins.onAuction')}</span>
        </label>

        {/* Auction price — shown only when onAuction is checked */}
        {data.onAuction ? (
          <Input
            label={t('coins.auctionPrice')}
            type="number"
            step="0.01"
            value={data.auctionPrice}
            onChange={(e) => handleChange('auctionPrice', e.target.value)}
            placeholder="0.00"
          />
        ) : null}

        {/* Sale price — shown only when sold is checked */}
        {data.sold ? (
          <Input
            label={t('coins.salePrice')}
            type="number"
            step="0.01"
            value={data.salePrice}
            onChange={(e) => handleChange('salePrice', e.target.value)}
            placeholder="0.00"
          />
        ) : null}

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
