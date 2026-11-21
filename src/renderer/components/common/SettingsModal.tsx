import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { CURRENCIES } from '@/utils/currency'
import * as aiApi from '@/features/ai/api'
import { formatLlmError } from '@/lib/llmError'
import type {
  LlmConfig,
  LlmErrorInfo,
  LlmProviderType,
  SearchProvider,
  UnslothConnectErrorCode,
  UnslothModel
} from '@shared/types'

// ── Constants ──────────────────────────────────────────

const TAB = { GENERAL: 'general', AI: 'ai' } as const

const LANGS = [
  { code: 'en', key: 'lang.en' },
  { code: 'ru', key: 'lang.ru' }
] as const

const PROVIDERS: { value: LlmProviderType; label: string }[] = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'lmstudio', label: 'LM Studio' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'unsloth', label: 'Unsloth Studio' }
]

const DEFAULT_URLS: Record<LlmProviderType, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  lmstudio: 'http://localhost:1234/v1',
  ollama: 'http://localhost:11434/v1',
  unsloth: 'http://127.0.0.1:8888/v1'
}

const SEARCH_PROVIDERS: { value: SearchProvider; label: string }[] = [
  { value: 'tavily', label: 'Tavily' },
  { value: 'brave', label: 'Brave Search' },
  { value: 'ddg', label: 'DuckDuckGo' },
  { value: 'searxng', label: 'SearXNG' },
  { value: 'openrouter_builtin', label: 'OpenRouter Built-in' },
  { value: 'none', label: 'None' }
]

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

// ── WebSearchSection ───────────────────────────────────

interface WebSearchSectionProps {
  config: LlmConfig
  onChange: (config: LlmConfig) => void
}

function WebSearchSection({ config, onChange }: WebSearchSectionProps): React.ReactElement {
  const { t } = useTranslation()
  const search = config.search || { provider: 'tavily', apiKeys: {}, baseUrl: '', maxResults: 5 }

  function updateSearch(patch: Partial<typeof search>): void {
    onChange({ ...config, search: { ...search, ...patch } })
  }

  const needsApiKey = search.provider === 'tavily' || search.provider === 'brave'
  const needsBaseUrl = search.provider === 'searxng'
  // Show search section only when web search is ON and provider is not 'openrouter_builtin' and not 'none'
  const showSearchOptions =
    config.enableWebSearch &&
    search.provider !== 'openrouter_builtin' &&
    search.provider !== 'none'

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3 mt-3">
      <h4 className="text-sm font-semibold text-gray-600">
        {t('ai.settings.searchTitle', { defaultValue: 'Search Configuration' })}
      </h4>

      {/* Search provider */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          {t('ai.settings.searchProvider', { defaultValue: 'Search Provider' })}
        </label>
        <select
          value={search.provider}
          onChange={(e) => {
            const provider = e.target.value as SearchProvider
            updateSearch({ provider })
          }}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          {SEARCH_PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* API Key (Tavily/Brave only) */}
      {needsApiKey && (
        <PasswordInput
          label={t('ai.settings.searchApiKey', { defaultValue: 'Search API Key' })}
          value={search.apiKeys?.[search.provider] || ''}
          onChange={(e) =>
            updateSearch({ apiKeys: { ...search.apiKeys, [search.provider]: e.target.value } })
          }
          placeholder={search.provider === 'brave' ? 'BSA...' : 'tvly-...'}
        />
      )}

      {/* Base URL (SearXNG only) */}
      {needsBaseUrl && (
        <Input
          label={t('ai.settings.searchBaseUrl', { defaultValue: 'Search Base URL' })}
          value={search.baseUrl}
          onChange={(e) => updateSearch({ baseUrl: e.target.value })}
          placeholder="http://localhost:8080"
        />
      )}

      {/* Max results */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          {t('ai.settings.searchMaxResults', { defaultValue: 'Max Results' })}
        </label>
        <input
          type="number"
          min={1}
          max={10}
          value={search.maxResults}
          onChange={(e) => updateSearch({ maxResults: Number(e.target.value) || 5 })}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm w-24
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Provider-specific hints */}
      {showSearchOptions && (
        <p className="text-xs text-gray-400">
          {search.provider === 'tavily' &&
            t('ai.settings.searchHintTavily', {
              defaultValue: 'Optimized for LLMs. Free tier: 1000 queries/month. Get API key at tavily.com'
            })}
          {search.provider === 'brave' &&
            t('ai.settings.searchHintBrave', {
              defaultValue: 'Good coverage. $5 free credits/month (~1000 queries). Card required even on the free plan. Get API key at api-dashboard.search.brave.com'
            })}
          {search.provider === 'ddg' &&
            t('ai.settings.searchHintDdg', {
              defaultValue: 'No API key needed. Rate-limited — use for testing only.'
            })}
          {search.provider === 'searxng' &&
            t('ai.settings.searchHintSearxng', {
              defaultValue: 'Self-hosted metasearch. Docker: docker run -p 8080:8080 searxng/searxng'
            })}
        </p>
      )}
    </div>
  )
}

// ── UnslothSection ─────────────────────────────────────

type UnslothError = { code: UnslothConnectErrorCode; detail?: string }

interface UnslothSectionProps {
  baseUrl: string
  connecting: boolean
  error: UnslothError | null
  onConnect: () => void
}

/**
 * "Connect" flow for the local Unsloth Studio server.
 *
 * Pressing the button asks the main process to mint (or reuse) an inference API
 * key from Studio's local desktop credential — no manual key copying needed.
 */
function UnslothSection({
  baseUrl,
  connecting,
  error,
  onConnect
}: UnslothSectionProps): React.ReactElement {
  const { t } = useTranslation()

  function errorText(): string | null {
    if (!error) return null
    switch (error.code) {
      case 'not_installed':
        return t('ai.settings.unslothNotInstalled', {
          defaultValue:
            'Unsloth Studio was not found on this machine. Install and start the desktop app, then try again.'
        })
      case 'not_running':
        return t('ai.settings.unslothNotRunning', {
          defaultValue: 'Unsloth Studio is not running ({{baseUrl}}). Start it and try again.',
          baseUrl
        })
      case 'invalid_base_url':
        return t('ai.settings.unslothInvalidBaseUrl', {
          defaultValue:
            'Unsloth Studio must run on localhost (127.0.0.1). For a remote server, create an API key in Studio → Settings → API keys and paste it below.'
        })
      case 'auth_failed':
        return t('ai.settings.unslothAuthFailed', {
          defaultValue:
            'Unsloth Studio rejected the local desktop credential. Restart Unsloth Studio and try again.'
        })
      case 'key_create_failed':
        return t('ai.settings.unslothKeyCreateFailed', {
          defaultValue:
            'Could not create an API key. Create one manually in Unsloth Studio → Settings → API keys and paste it below.'
        })
      case 'unknown':
      default:
        return t('ai.settings.unslothUnknownError', {
          defaultValue: 'Could not connect to Unsloth Studio: {{detail}}',
          detail: error.detail || 'unknown error'
        })
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-500">
        {t('ai.settings.unslothHint', {
          defaultValue:
            'Unsloth Studio must be running locally with a model loaded. Connecting creates an inference API key inside Studio and fills it in automatically.'
        })}
      </p>
      <Button variant="ghost" size="sm" onClick={onConnect} disabled={connecting}>
        {connecting && (
          <span
            aria-hidden="true"
            className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin"
          />
        )}
        {t('ai.settings.unslothConnect', { defaultValue: 'Connect to Unsloth Studio' })}
      </Button>
      {errorText() && <p className="text-xs text-red-600">{errorText()}</p>}
    </div>
  )
}

// ── AiSettingsPanel ────────────────────────────────────

interface AiSettingsPanelProps {
  config: LlmConfig
  onChange: (config: LlmConfig) => void
  testing: boolean
  testResult: { ok: boolean; error?: string; errorInfo?: LlmErrorInfo; toolCallSupported?: boolean; searchProviderOk?: boolean; searchProviderError?: string } | null
  saveError: string | null
  onTest: () => void
  loaded: boolean
  unslothConnecting: boolean
  unslothError: UnslothError | null
  unslothModels: UnslothModel[]
  onConnectUnsloth: () => void
}

function AiSettingsPanel({
  config,
  onChange,
  testing,
  testResult,
  saveError,
  onTest,
  loaded,
  unslothConnecting,
  unslothError,
  unslothModels,
  onConnectUnsloth
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

      {/* Unsloth Studio (local server) — auto-provision API key */}
      {config.provider === 'unsloth' && (
        <UnslothSection
          baseUrl={config.baseUrl || DEFAULT_URLS.unsloth}
          connecting={unslothConnecting}
          error={unslothError}
          onConnect={onConnectUnsloth}
        />
      )}

      {/* Base URL */}
      <Input
        label={t('ai.settings.baseUrl', { defaultValue: 'Base URL' })}
        value={config.baseUrl}
        onChange={(e) => onChange({ ...config, baseUrl: e.target.value })}
        placeholder="https://openrouter.ai/api/v1"
      />

      {/* Model — a picker for Unsloth Studio, free text everywhere else */}
      {config.provider === 'unsloth' && unslothModels.length > 0 ? (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            {t('ai.settings.model', { defaultValue: 'Model' })}
          </label>
          <select
            value={config.model}
            onChange={(e) => onChange({ ...config, model: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {config.model && !unslothModels.some((m) => m.id === config.model) && (
              <option value={config.model}>{config.model}</option>
            )}
            {unslothModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.loaded
                  ? `${m.id} — ${t('ai.settings.unslothModelLoaded', { defaultValue: 'loaded' })}`
                  : m.id}
              </option>
            ))}
          </select>
          {!unslothModels.some((m) => m.loaded) && (
            <p className="text-xs text-amber-600">
              {t('ai.settings.unslothNoModelLoaded', {
                defaultValue: 'No model is loaded in Unsloth Studio yet — load one there before querying.'
              })}
            </p>
          )}
        </div>
      ) : (
        <Input
          label={t('ai.settings.model', { defaultValue: 'Model' })}
          value={config.model}
          onChange={(e) => onChange({ ...config, model: e.target.value })}
          placeholder={config.provider === 'unsloth' ? 'unsloth/Qwen3-27B-GGUF' : 'openai/gpt-4.1'}
        />
      )}

      {/* API Key */}
      <PasswordInput
        label={t('ai.settings.apiKey', { defaultValue: 'API Key' })}
        value={config.apiKey}
        onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
        placeholder={config.provider === 'unsloth' ? 'sk-unsloth-...' : 'sk-...'}
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
            defaultValue: 'When enabled, the model can search the internet for current coin prices and data.'
          })}
        </p>
      </div>

      {/* Web search configuration */}
      <WebSearchSection config={config} onChange={onChange} />

      {/* Test result */}
      {testResult && (
        <div className="space-y-1">
          {/* Connection */}
          <div
            className={`text-xs px-3 py-2 rounded-md border ${
              testResult.ok
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {testResult.ok
              ? t('ai.settings.testOk', { defaultValue: 'Connection successful!' })
              : formatLlmError(testResult.errorInfo) ||
                testResult.error ||
                t('ai.settings.testFailed', { defaultValue: 'Connection failed' })}
          </div>

          {/* Tool-calling support */}
          {testResult.toolCallSupported !== undefined && (
            <div
              className={`text-xs px-3 py-2 rounded-md border ${
                testResult.toolCallSupported
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {testResult.toolCallSupported
                ? t('ai.settings.toolCallSupported', { defaultValue: 'Tool-calling: supported ✓' })
                : t('ai.settings.toolCallNotSupported', {
                    defaultValue: 'Tool-calling: not supported — web search will not work with this model'
                  })}
            </div>
          )}

          {/* Search provider */}
          {testResult.searchProviderOk !== undefined && (
            <div
              className={`text-xs px-3 py-2 rounded-md border ${
                testResult.searchProviderOk
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {testResult.searchProviderOk
                ? t('ai.settings.searchTestOk', { defaultValue: 'Search provider: ok ✓' })
                : testResult.searchProviderError ||
                  t('ai.settings.searchTestFail', {
                    defaultValue: 'Search provider: unreachable — check your API key or base URL'
                  })}
            </div>
          )}
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
          {testing && (
            <span
              aria-hidden="true"
              className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin"
            />
          )}
          {t('ai.settings.testConnection', { defaultValue: 'Test Connection' })}
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
  const [aiTestResult, setAiTestResult] = React.useState<{
    ok: boolean
    error?: string
    toolCallSupported?: boolean
    searchProviderOk?: boolean
    searchProviderError?: string
  } | null>(null)
  const [aiLoaded, setAiLoaded] = React.useState(false)
  const [aiSaveError, setAiSaveError] = React.useState<string | null>(null)

  // Unsloth Studio connect state
  const [unslothConnecting, setUnslothConnecting] = React.useState(false)
  const [unslothError, setUnslothError] = React.useState<UnslothError | null>(null)
  const [unslothModels, setUnslothModels] = React.useState<UnslothModel[]>([])

  // Load AI config when modal opens
  React.useEffect(() => {
    if (open) {
      let cancelled = false
      setAiLoaded(false)
      setAiTestResult(null)
      setAiSaveError(null)
      setUnslothError(null)
      setUnslothConnecting(false)
      aiApi.getConfig().then((cfg) => {
        if (cancelled) return
        setAiConfig(cfg)
        setAiLoaded(true)
      }).catch((err) => {
        if (cancelled) return
        console.warn('[SettingsModal] Failed to load AI config:', err)
        setAiLoaded(true) // don't block the UI with infinite spinner
      })
      return () => { cancelled = true }
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

  const handleUnslothConnect = async (): Promise<void> => {
    setUnslothConnecting(true)
    setUnslothError(null)
    try {
      const result = await aiApi.connectUnsloth(aiConfig.baseUrl || DEFAULT_URLS.unsloth)
      if (!result.ok) {
        setUnslothError({ code: result.code, detail: result.detail })
        return
      }
      setUnslothModels(result.models)
      setAiConfig((cfg) => {
        const loadedId = result.models.find((m) => m.loaded)?.id
        // Keep an already chosen model; otherwise pick the loaded one, then anything.
        const model = cfg.model || loadedId || result.models[0]?.id || ''
        return { ...cfg, provider: 'unsloth', apiKey: result.apiKey, baseUrl: result.baseUrl, model }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[SettingsModal] Unsloth connect failed:', message)
      setUnslothError({ code: 'unknown', detail: message })
    } finally {
      setUnslothConnecting(false)
    }
  }

  const handleClose = async (): Promise<void> => {
    // Auto-save AI config on close
    setAiSaveError(null)
    try {
      await aiApi.setConfig(aiConfig)
    } catch (err) {
      console.warn('[SettingsModal] Failed to save AI config on close:', err)
    }
    onClose()
  }

  const handleSave = async (): Promise<void> => {
    onSaveCurrency(selectedCurrency)
    // Save AI config too — handleClose persists it and closes the modal
    await handleClose()
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
          unslothConnecting={unslothConnecting}
          unslothError={unslothError}
          unslothModels={unslothModels}
          onConnectUnsloth={handleUnslothConnect}
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
