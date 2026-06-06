import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'

interface CollectionFormProps {
  initialName?: string
  onSubmit: (name: string) => void
  onCancel: () => void
  submitLabel?: string
}

export function CollectionForm({
  initialName = '',
  onSubmit,
  onCancel,
  submitLabel
}: CollectionFormProps): React.ReactElement {
  const { t } = useTranslation()
  const [name, setName] = React.useState(initialName)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t('form.errors.required'))
      return
    }
    if (trimmed.length < 2) {
      setError(t('form.errors.tooShort'))
      return
    }
    if (trimmed.length > 100) {
      setError(t('form.errors.tooLong'))
      return
    }
    onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="collection-name" className="block text-sm font-medium text-gray-700 mb-1">
          {t('form.collectionName')}
        </label>
        <input
          id="collection-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError(null)
          }}
          placeholder={t('form.placeholder')}
          autoFocus
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-gray-100"
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('form.cancel')}
        </Button>
        <Button type="submit" size="sm">
          {submitLabel ?? t('form.create')}
        </Button>
      </div>
    </form>
  )
}
