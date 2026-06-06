import React from 'react'
import type { Collection } from '@shared/types'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/Skeleton'
import { Edit } from '@/components/ui/icons/Edit'
import { Delete } from '@/components/ui/icons/Delete'

interface CollectionListProps {
  collections: Collection[]
  selectedId: string | null
  loading: boolean
  error: string | null
  onSelect: (id: string) => void
  onEdit: (collection: Collection) => void
  onDelete: (collection: Collection) => void
}

export function CollectionList({
  collections,
  selectedId,
  loading,
  error,
  onSelect,
  onEdit,
  onDelete
}: CollectionListProps): React.ReactElement {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {t(error)}
        </p>
      </div>
    )
  }

  if (collections.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-400 text-center">{t('collections.noCountries')}</p>
        <p className="text-xs text-gray-400 text-center mt-1">
          {t('collections.noCountriesHint')}
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-0.5">
      {collections.map((collection) => (
        <li key={collection.id}>
          <div
            className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm
              cursor-pointer transition-colors
              ${
                selectedId === collection.id
                  ? 'bg-primary-100 text-primary-800 font-medium'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            onClick={() => onSelect(collection.id)}
          >
            <span className="truncate flex-1">{collection.name}</span>
            <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(collection)
                }}
                className="p-1 text-gray-400 hover:text-primary-600 rounded"
                title={t('collections.rename')}
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(collection)
                }}
                className="p-1 text-gray-400 hover:text-red-600 rounded"
                title={t('collections.delete')}
              >
                <Delete className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
