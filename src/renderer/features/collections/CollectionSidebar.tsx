import React from 'react'
import { useTranslation } from 'react-i18next'
import { CollectionList } from './CollectionList'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Plus } from '@/components/ui/icons/Plus'
import { useCollectionManager } from './useCollections'
import type { Collection } from '@shared/types'

export function CollectionSidebar(): React.ReactElement {
  const { t } = useTranslation()
  const {
    collections,
    selectedId,
    loading,
    error,
    selectCollection,
    addCollection,
    updateCollection,
    deleteCollection,
    loadCollections
  } = useCollectionManager()

  const [showAddForm, setShowAddForm] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const [collectionToDelete, setCollectionToDelete] = React.useState<Collection | null>(null)

  const [editingCollection, setEditingCollection] = React.useState<Collection | null>(null)
  const [editName, setEditName] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    loadCollections()
  }, [loadCollections])

  React.useEffect(() => {
    if (editingCollection && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCollection])

  const handleAdd = (): void => {
    if (newName.trim()) {
      addCollection(newName.trim())
      setNewName('')
      setShowAddForm(false)
    }
  }

  const handleStartEdit = (collection: Collection): void => {
    setEditingCollection(collection)
    setEditName(collection.name)
  }

  const handleSaveEdit = (): void => {
    const trimmed = editName.trim()
    if (trimmed && editingCollection && trimmed !== editingCollection.name) {
      updateCollection(editingCollection.id, trimmed)
    }
    setEditingCollection(null)
    setEditName('')
  }

  const handleCancelEdit = (): void => {
    setEditingCollection(null)
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
    if (collectionToDelete) {
      deleteCollection(collectionToDelete.id)
      setCollectionToDelete(null)
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
            <Plus className="w-4 h-4 mr-1" />
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
        <CollectionList
          collections={collections}
          selectedId={selectedId}
          loading={loading}
          error={error}
          onSelect={selectCollection}
          onEdit={handleStartEdit}
          onDelete={setCollectionToDelete}
        />
      </div>

      {/* Edit panel */}
      {editingCollection && (
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
        open={collectionToDelete !== null}
        onClose={() => setCollectionToDelete(null)}
        title={t('countries.deleteTitle')}
      >
        <p className="text-sm text-gray-600 mb-4">
          {t('countries.deleteConfirm')}{' '}
          <strong>{collectionToDelete?.name}</strong>
          ? {t('countries.deleteWarning')}
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setCollectionToDelete(null)}>
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
