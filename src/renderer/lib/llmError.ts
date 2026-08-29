import type { LlmErrorInfo } from '@shared/types'
import i18n from './i18n'

/**
 * Render a friendly, localized, actionable message for an LLM error.
 *
 * `LlmErrorInfo` is produced in the main process (`classifyLlmError`) where the
 * raw error still carries provider/baseUrl/status. Here we map its `code` (and
 * provider, for local servers) to an i18n string.
 */
export function formatLlmError(info: LlmErrorInfo | null | undefined): string {
  if (!info) return ''

  const { code, provider, baseUrl, status } = info

  switch (code) {
    case 'connection_refused':
      if (provider === 'lmstudio') {
        return i18n.t('ai.errors.connectionRefusedLmstudio', { defaultValue: 'Cannot connect to LM Studio. Make sure it is running and a model is loaded ({{baseUrl}}).', baseUrl })
      }
      if (provider === 'ollama') {
        return i18n.t('ai.errors.connectionRefusedOllama', { defaultValue: 'Cannot connect to Ollama. Make sure it is running ({{baseUrl}}).', baseUrl })
      }
      return i18n.t('ai.errors.connectionRefused', { defaultValue: 'Cannot connect to the AI service ({{baseUrl}}). Check your internet connection.', baseUrl })

    case 'host_not_found':
      return i18n.t('ai.errors.hostNotFound', { defaultValue: 'Server not found at {{baseUrl}}. Check the Base URL in AI Settings.', baseUrl })

    case 'timeout':
      return i18n.t('ai.errors.timeout', { defaultValue: 'The AI service did not respond in time. Try again.' })

    case 'auth_error':
      return i18n.t('ai.errors.auth', { defaultValue: 'Authentication failed. Check your API key in AI Settings.' })

    case 'model_not_found':
      return i18n.t('ai.errors.modelNotFound', { defaultValue: 'Model not found ({{model}}). Check the model name in AI Settings.', model: info.model })

    case 'rate_limit':
      return i18n.t('ai.errors.rateLimit', { defaultValue: 'Rate limit exceeded. Wait a moment and try again.' })

    case 'server_error':
      return i18n.t('ai.errors.serverError', { defaultValue: 'The AI service returned an error (HTTP {{status}}).', status: status ?? '5xx' })

    case 'empty_response':
      return i18n.t('ai.errors.emptyResponse', { defaultValue: 'The model returned an empty response. Try a different model.' })

    case 'invalid_response':
      return i18n.t('ai.errors.invalidResponse', { defaultValue: 'The model returned an invalid response. Try again or use a different model.' })

    case 'unknown':
    default:
      return info.detail
        ? i18n.t('ai.errors.unknown', { defaultValue: 'AI request failed: {{detail}}', detail: info.detail })
        : i18n.t('ai.errors.unknownShort', { defaultValue: 'AI request failed.' })
  }
}
