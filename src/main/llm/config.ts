import type { LlmConfig, LlmProviderType, SearchConfig, BulkSessionState, QueryType } from '@shared/types'
import { DEFAULT_SEARCH_CONFIG } from '@shared/types'
import { getPreference, setPreference } from '../database/repositories/preferences'

const PREF_KEYS = {
  provider: 'llm.provider',
  model: 'llm.model',
  baseUrl: 'llm.baseUrl',
  apiKey: 'llm.apiKey',
  webSearch: 'llm.webSearch',

  // Search config
  searchProvider: 'llm.search.provider',
  searchApiKey: 'llm.search.apiKey',
  searchBaseUrl: 'llm.search.baseUrl',
  searchMaxResults: 'llm.search.maxResults',

  // Bulk session (resume)
  bulkSession: 'llm.bulkSession'
} as const

function envConfig(): LlmConfig {
  return {
    provider: (process.env.LLM_PROVIDER as LlmProviderType) || 'openrouter',
    model: process.env.LLM_MODEL || 'openai/gpt-4.1',
    baseUrl: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: process.env.LLM_API_KEY || '',
    enableWebSearch: process.env.LLM_WEB_SEARCH === 'true'
  }
}

function validateProvider(p: string): LlmProviderType {
  const valid: LlmProviderType[] = ['openrouter', 'lmstudio', 'ollama']
  return valid.includes(p as LlmProviderType) ? (p as LlmProviderType) : 'openrouter'
}

function loadSearchConfig(): SearchConfig {
  const provider = getPreference(PREF_KEYS.searchProvider)
  return {
    provider: (provider as SearchConfig['provider']) || DEFAULT_SEARCH_CONFIG.provider,
    apiKey: getPreference(PREF_KEYS.searchApiKey) || DEFAULT_SEARCH_CONFIG.apiKey,
    baseUrl: getPreference(PREF_KEYS.searchBaseUrl) || DEFAULT_SEARCH_CONFIG.baseUrl,
    maxResults: Number(getPreference(PREF_KEYS.searchMaxResults)) || DEFAULT_SEARCH_CONFIG.maxResults
  }
}

function saveSearchConfig(search: SearchConfig): void {
  setPreference(PREF_KEYS.searchProvider, search.provider)
  setPreference(PREF_KEYS.searchApiKey, search.apiKey)
  setPreference(PREF_KEYS.searchBaseUrl, search.baseUrl)
  setPreference(PREF_KEYS.searchMaxResults, String(search.maxResults))
}

export function loadLlmConfig(): LlmConfig {
  const env = envConfig()

  // Prefer preferences DB values, fall back to env
  const dbProvider = getPreference(PREF_KEYS.provider)
  const dbModel = getPreference(PREF_KEYS.model)
  const dbBaseUrl = getPreference(PREF_KEYS.baseUrl)
  const dbApiKey = getPreference(PREF_KEYS.apiKey)
  const dbWebSearch = getPreference(PREF_KEYS.webSearch)

  // If at least one preference is set, use DB values (with env fallback)
  const hasDbConfig = dbProvider || dbModel || dbBaseUrl || dbApiKey || !!dbWebSearch

  return {
    provider: hasDbConfig ? validateProvider(dbProvider || env.provider) : env.provider,
    model: hasDbConfig ? (dbModel || env.model) : env.model,
    baseUrl: hasDbConfig ? (dbBaseUrl || env.baseUrl) : env.baseUrl,
    apiKey: hasDbConfig ? (dbApiKey ?? env.apiKey) : env.apiKey,
    enableWebSearch: hasDbConfig ? (dbWebSearch === 'true') : env.enableWebSearch,
    search: loadSearchConfig()
  }
}

export function saveLlmConfig(config: LlmConfig): void {
  setPreference(PREF_KEYS.provider, config.provider)
  setPreference(PREF_KEYS.model, config.model)
  setPreference(PREF_KEYS.baseUrl, config.baseUrl)
  // Save API key (even if empty — allows clearing it)
  if (config.apiKey !== undefined) {
    setPreference(PREF_KEYS.apiKey, config.apiKey)
  }
  setPreference(PREF_KEYS.webSearch, String(config.enableWebSearch))
  if (config.search) {
    saveSearchConfig(config.search)
  }
}

// ── Bulk session (resume) ────────────────────────────────────────

/**
 * Session key scoped to collection + queryType so different
 * collections/tasks can have independent sessions.
 */
function sessionKey(collectionId: string, queryType: QueryType): string {
  return `${PREF_KEYS.bulkSession}.${collectionId}.${queryType}`
}

/**
 * Load an active (incomplete) bulk session.
 * Returns null if no session exists or the session is stale (>24h).
 */
export function loadBulkSession(
  collectionId: string,
  queryType: QueryType
): BulkSessionState | null {
  const raw = getPreference(sessionKey(collectionId, queryType))
  if (!raw) return null

  try {
    const state = JSON.parse(raw) as BulkSessionState
    // Auto-clear stale sessions (older than 24h)
    if (Date.now() - state.startedAt > 24 * 60 * 60 * 1000) {
      clearBulkSession(collectionId, queryType)
      return null
    }
    return state
  } catch {
    clearBulkSession(collectionId, queryType)
    return null
  }
}

/** Save an active (incomplete) bulk session for later resume. */
export function saveBulkSession(state: BulkSessionState): void {
  setPreference(sessionKey(state.collectionId, state.queryType), JSON.stringify(state))
}

/** Remove a stored bulk session (on completion or explicit discard). */
export function clearBulkSession(collectionId: string, queryType: QueryType): void {
  setPreference(sessionKey(collectionId, queryType), '')
}
