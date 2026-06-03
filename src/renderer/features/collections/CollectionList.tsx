import React from 'react'
import type { Collection } from '@shared/types'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/Skeleton'

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
        <p className="text-sm text-gray-400 text-center">{t('countries.noCountries')}</p>
        <p className="text-xs text-gray-400 text-center mt-1">
          {t('countries.noCountriesHint')}
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
                title={t('countries.rename')}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(collection)
                }}
                className="p-1 text-gray-400 hover:text-red-600 rounded"
                title={t('countries.delete')}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
