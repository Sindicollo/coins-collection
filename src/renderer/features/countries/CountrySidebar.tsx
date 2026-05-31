import React from 'react'
import { useTranslation } from 'react-i18next'
import { CountryList } from './CountryList'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCountryManager } from './useCountries'
import type { Country } from '@shared/types'

export function CountrySidebar(): React.ReactElement {
  const { t } = useTranslation()
  const {
    countries,
    selectedId,
    loading,
    error,
    selectCountry,
    addCountry,
    updateCountry,
    deleteCountry,
    loadCountries
  } = useCountryManager()

  const [showAddForm, setShowAddForm] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const [countryToDelete, setCountryToDelete] = React.useState<Country | null>(null)

  const [editingCountry, setEditingCountry] = React.useState<Country | null>(null)
  const [editName, setEditName] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    loadCountries()
  }, [loadCountries])

  React.useEffect(() => {
    if (editingCountry && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCountry])

  const handleAdd = (): void => {
    if (newName.trim()) {
      addCountry(newName.trim())
      setNewName('')
      setShowAddForm(false)
    }
  }

  const handleStartEdit = (country: Country): void => {
    setEditingCountry(country)
    setEditName(country.name)
  }

  const handleSaveEdit = (): void => {
    const trimmed = editName.trim()
    if (trimmed && editingCountry && trimmed !== editingCountry.name) {
      updateCountry(editingCountry.id, trimmed)
    }
    setEditingCountry(null)
    setEditName('')
  }

  const handleCancelEdit = (): void => {
    setEditingCountry(null)
    setEditName('')
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') handleSaveEdit()
    if (e.key === 'Escape') handleCancelEdit()
  }

  const handleSaveMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    handleSaveEdit()
  }

  const handleCancelMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    handleCancelEdit()
  }

  const handleDeleteConfirm = (): void => {
    if (countryToDelete) {
      deleteCountry(countryToDelete.id)
      setCountryToDelete(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-primary-700 mb-3">
          {t('countries.title')}
        </h2>

        {!showAddForm ? (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => setShowAddForm(true)}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('countries.addButton')}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder={t('countries.placeholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') {
                  setShowAddForm(false)
                  setNewName('')
                }
              }}
              autoFocus
              className="flex-1"
            />
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
              {t('countries.add')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAddForm(false)
                setNewName('')
              }}
            >
              ✕
            </Button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <CountryList
          countries={countries}
          selectedId={selectedId}
          loading={loading}
          error={error}
          onSelect={selectCountry}
          onEdit={handleStartEdit}
          onDelete={setCountryToDelete}
        />
      </div>

      {/* Edit panel */}
      {editingCountry && (
        <div className="p-3 border-t border-gray-200 bg-primary-50">
          <label className="text-xs font-medium text-primary-600 mb-1 block">
            {t('countries.rename')}
          </label>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={handleSaveEdit}
              className="flex-1"
            />
            <Button size="sm" onMouseDown={handleSaveMouseDown} disabled={!editName.trim()}>
              {t('countries.save')}
            </Button>
            <Button size="sm" variant="ghost" onMouseDown={handleCancelMouseDown}>
              {t('countries.cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={countryToDelete !== null}
        onClose={() => setCountryToDelete(null)}
        title={t('countries.deleteTitle')}
      >
        <p className="text-sm text-gray-600 mb-4">
          {t('countries.deleteConfirm')}{' '}
          <strong>{countryToDelete?.name}</strong>
          ? {t('countries.deleteWarning')}
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setCountryToDelete(null)}>
            {t('countries.cancel')}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDeleteConfirm}>
            {t('countries.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
