import React from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Delete } from '@/components/ui/icons/Delete'
import type { CoinNote, UpdateCoinNoteInput } from '@shared/types'

interface CoinNoteCardProps {
  note: CoinNote
  onUpdate: (input: UpdateCoinNoteInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function displayTitle(note: CoinNote): string {
  if (note.title) return note.title
  // First 50 chars of content
  const firstLine = note.content.split('\n')[0]
  if (firstLine.length <= 50) return firstLine
  return firstLine.slice(0, 47) + '...'
}

function previewText(content: string, hasTitle: boolean): string {
  const lines = content.split('\n')
  const start = hasTitle ? 0 : 0
  const text = lines.slice(start).join(' ').trim()
  if (text.length <= 120) return text
  return text.slice(0, 117) + '...'
}

function formatTimestamp(ts: number, i18nLang: string): string {
  const d = new Date(ts)
  const locale = i18nLang === 'ru' ? 'ru-RU' : undefined
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function CoinNoteCard({ note, onUpdate, onDelete }: CoinNoteCardProps): React.ReactElement {
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState(note.title ?? '')
  const [editContent, setEditContent] = React.useState(note.content)
  const [deleting, setDeleting] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const handleEditSave = async (): Promise<void> => {
    setSaving(true)
    await onUpdate({
      id: note.id,
      title: editTitle.trim() || null,
      content: editContent.trim()
    })
    setEditing(false)
    setSaving(false)
  }

  const handleDelete = async (): Promise<void> => {
    setDeleting(true)
    await onDelete(note.id)
    setDeleting(false)
  }

  const handleCancelEdit = (): void => {
    setEditTitle(note.title ?? '')
    setEditContent(note.content)
    setEditing(false)
  }

  const title = displayTitle(note)
  const isModified = note.updatedAt !== note.createdAt
  const dateLabel = isModified
    ? t('notes.modified', { defaultValue: 'Modified' })
    : t('notes.created', { defaultValue: 'Created' })

  return (
    <Card className="p-4">
      {editing ? (
        /* Edit mode */
        <div>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder={t('notes.titlePlaceholder', { defaultValue: 'Title (optional)' })}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium mb-2
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            autoFocus
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-vertical
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="ghost" size="xs" onClick={handleCancelEdit}>
              {t('coins.cancel')}
            </Button>
            <Button size="xs" onClick={handleEditSave} disabled={saving || !editContent.trim()}>
              {t('coins.save')}
            </Button>
          </div>
        </div>
      ) : (
        /* View mode */
        <div>
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h4
                className="font-medium text-gray-800 text-sm cursor-pointer hover:text-primary-600"
                onClick={() => setExpanded(!expanded)}
              >
                {title}
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                {dateLabel}: {formatTimestamp(note.updatedAt, i18n.language)}
              </p>
            </div>

            <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setEditTitle(note.title ?? '')
                  setEditContent(note.content)
                  setEditing(true)
                }}
              >
                ✏️
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Delete className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
              </Button>
            </div>
          </div>

          {(expanded || !note.title) && (
            <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap leading-relaxed">
              {expanded ? note.content : previewText(note.content, !!note.title)}
            </p>
          )}

          {!expanded && note.title && note.content.length > 120 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-primary-500 hover:text-primary-600 mt-1"
            >
              {t('notes.readMore', { defaultValue: 'Read more' })}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
