import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Plus } from '@/components/ui/icons/Plus'
import { CoinNoteCard } from './CoinNoteCard'
import type { CoinNote, CreateCoinNoteInput, UpdateCoinNoteInput } from '@shared/types'

interface CoinNotesListProps {
  coinId: string
  onCountChange: (count: number) => void
}

export function CoinNotesList({ coinId, onCountChange }: CoinNotesListProps): React.ReactElement {
  const { t, i18n } = useTranslation()
  const [notes, setNotes] = React.useState<CoinNote[]>([])
  const [loading, setLoading] = React.useState(true)
  const [adding, setAdding] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState('')
  const [newContent, setNewContent] = React.useState('')
  const [aiLoading, setAiLoading] = React.useState(false)
  const [aiError, setAiError] = React.useState<string | null>(null)
  const mountedRef = React.useRef(true)

  const loadNotes = React.useCallback(async (): Promise<void> => {
    try {
      const data = await window.api.notes.list(coinId)
      if (mountedRef.current) {
        setNotes(data)
        onCountChange(data.length)
      }
    } catch {
      // silently fail
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [coinId, onCountChange])

  React.useEffect(() => {
    mountedRef.current = true
    setLoading(true)
    loadNotes()
    return () => { mountedRef.current = false }
  }, [coinId, loadNotes])

  const handleCreate = async (): Promise<void> => {
    if (!newContent.trim()) return

    try {
      const input: CreateCoinNoteInput = {
        coinId,
        title: newTitle.trim() || null,
        content: newContent.trim()
      }
      await window.api.notes.create(input)
      setNewTitle('')
      setNewContent('')
      setAdding(false)
      loadNotes()
    } catch (err) {
      console.error('Failed to create note:', err)
    }
  }

  const handleUpdate = async (input: UpdateCoinNoteInput): Promise<void> => {
    try {
      await window.api.notes.update(input)
      loadNotes()
    } catch (err) {
      console.error('Failed to update note:', err)
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await window.api.notes.delete(id)
      loadNotes()
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }

  const handleAiQuery = async (queryType: 'prices' | 'info' | 'mintage'): Promise<void> => {
    if (aiLoading) return // prevent duplicate clicks
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await window.api.llm.querySingle({
        coinId,
        queryType,
        locale: i18n.language
      })

      const parts: string[] = []
      if (result.info) parts.push(result.info)
      if (result.price) parts.push(`Price: ${result.price}`)
      if (result.mintage) parts.push(`Mintage: ${result.mintage}`)
      if (result.rarity) parts.push(`Rarity: ${result.rarity}`)
      if (result.varieties && result.varieties.length > 0) {
        parts.push(`Varieties: ${result.varieties.join(', ')}`)
      }

      const content = parts.join('\n')
      if (content) {
        const titleMap: Record<string, string> = {
          prices: 'AI: eBay Prices',
          info: 'AI: Coin Info',
          mintage: 'AI: Mintage'
        }
        await window.api.notes.create({
          coinId,
          title: titleMap[queryType] ?? 'AI Result',
          content
        })
        loadNotes()
      } else {
        setAiError(t('notes.aiEmpty', { defaultValue: 'AI returned no data. Try again or check API key.' }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setAiError(msg)
    } finally {
      if (mountedRef.current) {
        setAiLoading(false)
      }
    }
  }

  const handleCancelAdd = (): void => {
    setNewTitle('')
    setNewContent('')
    setAdding(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative">
      {/* AI Loading overlay */}
      {aiLoading && (
        <div className="absolute inset-0 z-10 bg-white/60 flex items-center justify-center rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">
              {t('ai.querying', { defaultValue: 'Querying...' })}
            </p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {aiError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between">
          <p className="text-sm text-red-700 pr-4">{aiError}</p>
          <button
            onClick={() => setAiError(null)}
            className="text-red-400 hover:text-red-600 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Header with actions */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800">
          {t('notes.title', { defaultValue: 'Notes' })}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => handleAiQuery('prices')}
            disabled={aiLoading}
          >
            💰 {t('ai.queryPrice', { defaultValue: 'eBay price' })}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => handleAiQuery('info')}
            disabled={aiLoading}
          >
            ℹ️ {t('ai.queryInfo', { defaultValue: 'Info' })}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => handleAiQuery('mintage')}
            disabled={aiLoading}
          >
            📊 {t('ai.queryMintage', { defaultValue: 'Mintage' })}
          </Button>
          <span className="text-gray-300 mx-0.5">|</span>
          <Button size="xs" variant="ghost" onClick={() => setAdding(true)} disabled={adding}>
            <Plus className="w-4 h-4 mr-1" />
            {t('notes.add', { defaultValue: 'Add' })}
          </Button>
        </div>
      </div>

      {/* Inline form for creating new note */}
      {adding && (
        <div className="mb-4 border border-primary-200 rounded-lg p-4 bg-primary-50/30">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t('notes.titlePlaceholder', { defaultValue: 'Title (optional)' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            autoFocus
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={t('notes.contentPlaceholder', { defaultValue: 'Note content...' })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-vertical min-h-[80px]
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <div className="flex gap-2 justify-end mt-3">
            <Button variant="ghost" size="sm" onClick={handleCancelAdd}>
              {t('coins.cancel')}
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!newContent.trim()}>
              {t('coins.save')}
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      <div className="space-y-3">
        {notes.length === 0 && !adding ? (
          <p className="text-sm text-gray-400 text-center py-8">
            {t('notes.empty', { defaultValue: 'No notes yet' })}
          </p>
        ) : (
          notes.map((note) => (
            <CoinNoteCard
              key={note.id}
              note={note}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
