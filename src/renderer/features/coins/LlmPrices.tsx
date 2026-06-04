import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'

interface LlmPricesProps {
  collectionId: string
  onExported?: (filePath: string) => void
  onImported?: (updated: number, skipped: number) => void
}

export function LlmPrices({ collectionId, onExported, onImported }: LlmPricesProps): React.ReactElement {
  const { t } = useTranslation()
  const [exporting, setExporting] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const [lastExported, setLastExported] = React.useState<string | null>(null)
  const [lastResult, setLastResult] = React.useState<{
    updated: number
    skipped: number
  } | null>(null)

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const filePath = await window.api.prices.exportAll(collectionId)
      if (filePath) {
        setLastExported(filePath)
        onExported?.(filePath)
      }
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (): Promise<void> => {
    setImporting(true)
    try {
      const result = await window.api.prices.importPrices()
      if (result) {
        setLastResult({ updated: result.updated, skipped: result.skipped })
        onImported?.(result.updated, result.skipped)
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        size="sm"
        variant="ghost"
        onClick={handleExport}
        disabled={exporting}
      >
        {exporting ? '...' : t('coins.exportLlm', { defaultValue: 'Export for LLM' })}
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={handleImport}
        disabled={importing}
      >
        {importing ? '...' : t('coins.importPrices', { defaultValue: 'Import prices' })}
      </Button>

      {lastExported && (
        <span className="text-xs text-gray-500">
          {lastExported.split('/').pop()}
        </span>
      )}

      {lastResult && (
        <span className="text-xs text-gray-500">
          {t('coins.priceResult', {
            defaultValue: '{{ updated }} updated, {{ skipped }} skipped',
            updated: lastResult.updated,
            skipped: lastResult.skipped
          })}
        </span>
      )}
    </div>
  )
}
