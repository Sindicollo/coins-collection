import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import type { LlmConfig, LlmProviderType } from '@shared/types'
import * as aiApi from './api'

interface AiSettingsModalProps {
  open: boolean
  onClose: () => void
}

const PROVIDERS: { value: LlmProviderType; label: string }[] = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'lmstudio', label: 'LM Studio' },
  { value: 'ollama', label: 'Ollama' }
]

export function AiSettingsModal({ open, onClose }: AiSettingsModalProps): React.ReactElement {
  const { t } = useTranslation()
  const [config, setConfig] = React.useState<LlmConfig>({
    provider: 'openrouter',
    model: '',
    baseUrl: '',
    apiKey: ''
  })
  const [testing, setTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{ ok: boolean; error?: string } | null>(null)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    if (open && !loaded) {
      aiApi.getConfig().then((cfg) => {
        setConfig(cfg)
        setLoaded(true)
        setTestResult(null)
      })
    }
  }, [open, loaded])

  const handleTest = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      // Save config before testing so the test uses saved values
      await aiApi.setConfig(config)
      const result = await aiApi.testConnection(config)
      setTestResult(result)
    } catch {
      setTestResult({ ok: false, error: 'Connection test failed' })
    } finally {
      setTesting(false)
    }
  }

  const handleClose = async (): Promise<void> => {
    await aiApi.setConfig(config)
    setLoaded(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('ai.settings.title', { defaultValue: 'AI Settings' })}>
      <div className="space-y-3">
        {/* Provider */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            {t('ai.settings.provider', { defaultValue: 'Provider' })}
          </label>
          <select
            value={config.provider}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, provider: e.target.value as LlmProviderType }))
            }
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
          onChange={(e) => setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
          placeholder="https://openrouter.ai/api/v1"
        />

        {/* Model */}
        <Input
          label={t('ai.settings.model', { defaultValue: 'Model' })}
          value={config.model}
          onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))}
          placeholder="openai/gpt-4.1"
        />

        {/* API Key */}
        <Input
          label={t('ai.settings.apiKey', { defaultValue: 'API Key' })}
          type="password"
          value={config.apiKey}
          onChange={(e) => setConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
          placeholder="sk-..."
        />

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

        {/* Buttons */}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={handleTest} disabled={testing}>
            {testing
              ? '...'
              : t('ai.settings.testConnection', { defaultValue: 'Test Connection' })}
          </Button>
          <Button size="sm" onClick={handleClose}>
            {t('coins.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
