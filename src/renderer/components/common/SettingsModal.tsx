import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { CURRENCIES } from '@/utils/currency'

interface SettingsModalProps {
  open: boolean
  currency: string
  onSaveCurrency: (currency: string) => void
  onClose: () => void
}

export function SettingsModal({
  open,
  currency,
  onSaveCurrency,
  onClose
}: SettingsModalProps): React.ReactElement {
  const { t } = useTranslation()
  const [selected, setSelected] = React.useState(currency)

  React.useEffect(() => {
    setSelected(currency)
  }, [currency, open])

  return (
    <Modal open={open} onClose={onClose} title={t('settings.title')}>
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            {t('settings.defaultCurrency')}
          </label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code} — {c.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">{t('settings.currencyHint')}</p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('countries.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onSaveCurrency(selected)
              onClose()
            }}
          >
            {t('countries.save')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
