import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'

interface LlmToolsProps {
  collectionId: string
  onExported?: (filePath: string) => void
  onImported?: (updated: number, skipped: number) => void
}

interface ExportCoin {
  id: string
  country: string | null
  denomination: string
  year: number | null
  condition: string | null
}

export function LlmTools({ collectionId, onExported, onImported }: LlmToolsProps): React.ReactElement {
  const { t } = useTranslation()
  const [exporting, setExporting] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const [lastExported, setLastExported] = React.useState<string | null>(null)
  const [lastResult, setLastResult] = React.useState<{
    updated: number
    skipped: number
  } | null>(null)
  const [exportData, setExportData] = React.useState<ExportCoin[]>([])
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    window.api.llm.getExportData(collectionId).then(setExportData).catch(console.error)
  }, [collectionId])

  const promptText = React.useMemo(() => {
    if (exportData.length === 0) return ''
    const json = JSON.stringify(exportData, null, 2)
    return t('coins.llmPrompt', { json })
  }, [exportData, t])

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const filePath = await window.api.llm.exportAll(collectionId)
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
      const result = await window.api.llm.importInfo()
      if (result) {
        setLastResult({ updated: result.updated, skipped: result.skipped })
        onImported?.(result.updated, result.skipped)
      }
    } finally {
      setImporting(false)
    }
  }

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(promptText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <span className="relative group cursor-help inline-flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? '...' : t('coins.exportLlm', { defaultValue: 'Export for LLM' })}
          </Button>
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[10px] leading-none text-gray-400 border border-gray-300">
            ?
          </span>
          <span className="absolute top-full left-0 mt-1.5 px-3 py-1.5 bg-gray-800 text-white text-[11px] leading-relaxed rounded shadow-lg opacity-0 invisible group-hover:opacity-85 group-hover:visible transition-all duration-150 max-w-[280px] pointer-events-none whitespace-normal z-50">
            {t('coins.llmExportTooltip')}
          </span>
        </span>

        <span className="relative group cursor-help inline-flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? '...' : t('coins.importLlm', { defaultValue: 'Import from LLM' })}
          </Button>
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[10px] leading-none text-gray-400 border border-gray-300">
            ?
          </span>
          <span className="absolute top-full left-0 mt-1.5 px-3 py-1.5 bg-gray-800 text-white text-[11px] leading-relaxed rounded shadow-lg opacity-0 invisible group-hover:opacity-85 group-hover:visible transition-all duration-150 max-w-[280px] pointer-events-none whitespace-normal z-50">
            {t('coins.llmImportTooltip')}
          </span>
        </span>

        {lastExported && (
          <span className="text-xs text-gray-500">
            {lastExported.split('/').pop()}
          </span>
        )}

        {lastResult && (
          <span className="text-xs text-gray-500">
            {t('coins.llmResult', {
              defaultValue: '{{updated}} updated, {{skipped}} skipped',
              updated: lastResult.updated,
              skipped: lastResult.skipped
            })}
          </span>
        )}
      </div>

      {promptText && (
        <details className="mt-2 group">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 inline-flex items-center gap-2 select-none">
            <span className="group-open:rotate-90 transition-transform text-[10px]">▶</span>
            {t('coins.llmTemplate', { defaultValue: 'LLM Prompt Template' })}
            <Button
              size="xs"
              variant="ghost"
              onClick={(e) => {
                e.preventDefault()
                handleCopy()
              }}
            >
              {copied
                ? t('coins.llmCopied', { defaultValue: 'Copied!' })
                : t('coins.llmCopyPrompt', { defaultValue: 'Copy prompt' })}
            </Button>
          </summary>
          <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md text-[11px] leading-relaxed text-gray-700 overflow-auto max-h-64 whitespace-pre-wrap max-w-[400px]">
            {promptText}
          </pre>
        </details>
      )}
    </div>
  )
}
