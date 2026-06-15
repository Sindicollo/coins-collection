import type { LlmConfig, LlmProviderType } from '@shared/types'
import { getPreference, setPreference } from '../database/repositories/preferences'

const PREF_KEYS = {
  provider: 'llm.provider',
  model: 'llm.model',
  baseUrl: 'llm.baseUrl',
  apiKey: 'llm.apiKey'
} as const

function envConfig(): LlmConfig {
  return {
    provider: (process.env.LLM_PROVIDER as LlmProviderType) || 'openrouter',
    model: process.env.LLM_MODEL || 'openai/gpt-4.1',
    baseUrl: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: process.env.LLM_API_KEY || ''
  }
}

function validateProvider(p: string): LlmProviderType {
  const valid: LlmProviderType[] = ['openrouter', 'lmstudio', 'ollama']
  return valid.includes(p as LlmProviderType) ? (p as LlmProviderType) : 'openrouter'
}

export function loadLlmConfig(): LlmConfig {
  const env = envConfig()

  // Prefer preferences DB values, fall back to env
  const dbProvider = getPreference(PREF_KEYS.provider)
  const dbModel = getPreference(PREF_KEYS.model)
  const dbBaseUrl = getPreference(PREF_KEYS.baseUrl)
  const dbApiKey = getPreference(PREF_KEYS.apiKey)

  // If at least one preference is set, use DB values (with env fallback)
  const hasDbConfig = dbProvider || dbModel || dbBaseUrl || dbApiKey

  return {
    provider: hasDbConfig ? validateProvider(dbProvider || env.provider) : env.provider,
    model: hasDbConfig ? (dbModel || env.model) : env.model,
    baseUrl: hasDbConfig ? (dbBaseUrl || env.baseUrl) : env.baseUrl,
    apiKey: hasDbConfig ? (dbApiKey ?? env.apiKey) : env.apiKey
  }
}

export function saveLlmConfig(config: LlmConfig): void {
  setPreference(PREF_KEYS.provider, config.provider)
  setPreference(PREF_KEYS.model, config.model)
  setPreference(PREF_KEYS.baseUrl, config.baseUrl)
  // Only save API key if provided (don't overwrite with empty)
  if (config.apiKey) {
    setPreference(PREF_KEYS.apiKey, config.apiKey)
  }
}
