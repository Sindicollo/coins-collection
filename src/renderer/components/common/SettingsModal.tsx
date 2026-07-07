import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { CURRENCIES } from '@/utils/currency'
import * as aiApi from '@/features/ai/api'
import type { LlmConfig, LlmProviderType } from '@shared/types'

// ── Constants ──────────────────────────────────────────

const TAB = { GENERAL: 'general', AI: 'ai' } as const

const LANGS = [
  { code: 'en', key: 'lang.en' },
  { code: 'ru', key: 'lang.ru' }
] as const

const PROVIDERS: { value: LlmProviderType; label: string }[] = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'lmstudio', label: 'LM Studio' },
  { value: 'ollama', label: 'Ollama' }
]

const DEFAULT_URLS: Record<LlmProviderType, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  lmstudio: 'http://localhost:1234/v1',
  ollama: 'http://localhost:11434/v1'
}

// ── Props ───────────────────────────────────────────────

interface SettingsModalProps {
  open: boolean
  currency: string
  onSaveCurrency: (currency: string) => void
  onClose: () => void
}

// ── TabButton ──────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
        ${active
          ? 'border-primary-600 text-primary-700'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
    >
      {children}
    </button>
  )
}

// ── AiSettingsPanel ────────────────────────────────────

interface AiSettingsPanelProps {
  config: LlmConfig
  onChange: (config: LlmConfig) => void
  testing: boolean
  testResult: { ok: boolean; error?: string } | null
  saveError: string | null
  onTest: () => void
  loaded: boolean
}

function AiSettingsPanel({
  config,
  onChange,
  testing,
  testResult,
  saveError,
  onTest,
  loaded
}: AiSettingsPanelProps): React.ReactElement {
  const { t } = useTranslation()

  if (!loaded) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-5 h-5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Provider */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          {t('ai.settings.provider', { defaultValue: 'Provider' })}
        </label>
        <select
          value={config.provider}
          onChange={(e) => {
            const provider = e.target.value as LlmProviderType
            onChange({ ...config, provider, baseUrl: DEFAULT_URLS[provider] })
          }}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Base URL */}
      <Input
        label={t('ai.settings.baseUrl', { defaultValue: 'Base URL' })}
        value={config.baseUrl}
        onChange={(e) => onChange({ ...config, baseUrl: e.target.value })}
        placeholder="https://openrouter.ai/api/v1"
      />

      {/* Model */}
      <Input
        label={t('ai.settings.model', { defaultValue: 'Model' })}
        value={config.model}
        onChange={(e) => onChange({ ...config, model: e.target.value })}
        placeholder="openai/gpt-4.1"
      />

      {/* API Key */}
      <Input
        label={t('ai.settings.apiKey', { defaultValue: 'API Key' })}
        type="password"
        value={config.apiKey}
        onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
        placeholder="sk-..."
      />

      {/* Web search toggle */}
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.enableWebSearch}
            onChange={(e) => onChange({ ...config, enableWebSearch: e.target.checked })}
            className="rounded border-gray-300 accent-primary-600"
          />
          <span className="text-gray-700">
            {t('ai.settings.webSearch', { defaultValue: 'Enable web search' })}
          </span>
        </label>
        <p className="text-xs text-gray-400 ml-6">
          {t('ai.settings.webSearchHint', {
            defaultValue: 'Uses OpenRouter tools API. Works with most models. Adds ~10s per query.'
          })}
        </p>
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`text-xs px-3 py-2 rounded-md ${
            testResult.ok
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {testResult.ok
            ? t('ai.settings.testOk', { defaultValue: 'Connection successful!' })
            : testResult.error || t('ai.settings.testFailed', { defaultValue: 'Connection failed' })}
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="text-xs px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-200">
          {t('ai.settings.saveError', { defaultValue: 'Failed to save: {{message}}', message: saveError })}
        </div>
      )}

      {/* Test button */}
      <div className="pt-1">
        <Button variant="ghost" size="sm" onClick={onTest} disabled={testing}>
          {testing
            ? '...'
            : t('ai.settings.testConnection', { defaultValue: 'Test Connection' })}
        </Button>
      </div>
    </div>
  )
}

// ── SettingsModal ──────────────────────────────────────

export function SettingsModal({
  open,
  currency,
  onSaveCurrency,
  onClose
}: SettingsModalProps): React.ReactElement {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = React.useState<string>(TAB.GENERAL)

  // General state
  const [selectedCurrency, setSelectedCurrency] = React.useState(currency)
  const currentLang = i18n.language?.startsWith('ru') ? 'ru' : 'en'

  // AI state (lifted up so save works correctly)
  const [aiConfig, setAiConfig] = React.useState<LlmConfig>({
    provider: 'openrouter',
    model: '',
    baseUrl: '',
    apiKey: '',
    enableWebSearch: false
  })
  const [aiTesting, setAiTesting] = React.useState(false)
  const [aiTestResult, setAiTestResult] = React.useState<{ ok: boolean; error?: string } | null>(null)
  const [aiLoaded, setAiLoaded] = React.useState(false)
  const [aiSaveError, setAiSaveError] = React.useState<string | null>(null)

  // Load AI config when modal opens
  React.useEffect(() => {
    if (open) {
      setAiLoaded(false)
      setAiTestResult(null)
      setAiSaveError(null)
      aiApi.getConfig().then((cfg) => {
        setAiConfig(cfg)
        setAiLoaded(true)
      })
    }
  }, [open])

  // Reset tab when modal opens
  React.useEffect(() => {
    if (open) {
      setTab(TAB.GENERAL)
      setSelectedCurrency(currency)
    }
  }, [open, currency])

  const handleAiTest = async (): Promise<void> => {
    setAiTesting(true)
    setAiTestResult(null)
    try {
      await aiApi.setConfig(aiConfig)
      const result = await aiApi.testConnection(aiConfig)
      setAiTestResult(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[SettingsModal] Test connection failed:', message)
      setAiTestResult({ ok: false, error: message })
    } finally {
      setAiTesting(false)
    }
  }

  const handleClose = async (): Promise<void> => {
    // Auto-save AI config on close
    setAiSaveError(null)
    try {
      await aiApi.setConfig(aiConfig)
    } catch {
      // silently fail on close — config will be stale but not lost
    }
    onClose()
  }

  const handleSave = (): void => {
    onSaveCurrency(selectedCurrency)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('settings.title')}>
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-4">
        <TabButton active={tab === TAB.GENERAL} onClick={() => setTab(TAB.GENERAL)}>
          {t('settings.general', { defaultValue: 'General' })}
        </TabButton>
        <TabButton active={tab === TAB.AI} onClick={() => setTab(TAB.AI)}>
          {t('settings.ai', { defaultValue: 'AI' })}
        </TabButton>
      </div>

      {/* General tab */}
      {tab === TAB.GENERAL && (
        <div className="space-y-4">
          {/* Language */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('settings.language', { defaultValue: 'Language' })}
            </label>
            <select
              value={currentLang}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {LANGS.map(({ code, key }) => (
                <option key={code} value={code}>
                  {t(key)}
                </option>
              ))}
            </select>
          </div>

          {/* Currency */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {t('settings.defaultCurrency')}
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
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
        </div>
      )}

      {/* AI tab */}
      {tab === TAB.AI && (
        <AiSettingsPanel
          config={aiConfig}
          onChange={setAiConfig}
          testing={aiTesting}
          testResult={aiTestResult}
          saveError={aiSaveError}
          onTest={handleAiTest}
          loaded={aiLoaded}
        />
      )}

      {/* Footer */}
      <div className="flex gap-2 justify-end pt-4 mt-2 border-t border-gray-200">
        <Button variant="ghost" size="sm" onClick={handleClose}>
          {t('collections.cancel')}
        </Button>
        <Button size="sm" onClick={handleSave}>
          {t('collections.save')}
        </Button>
      </div>
    </Modal>
  )
}
