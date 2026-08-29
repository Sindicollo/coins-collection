// LLM integration types shared between main and renderer

export type QueryType = 'prices' | 'mintage' | 'info'

export type SearchProvider =
  | 'tavily'
  | 'brave'
  | 'ddg'
  | 'searxng'
  | 'openrouter_builtin'
  | 'none'

export interface SearchConfig {
  provider: SearchProvider
  /** API keys keyed by provider — switching providers preserves each key. */
  apiKeys: Partial<Record<SearchProvider, string>>
  /** SearXNG instance base URL. */
  baseUrl: string
  maxResults: number
}

export interface AiCoinInfo {
  id: string
  info?: string
  price?: string
  mintage?: string
  rarity?: string
  varieties?: string[]
  /** Which query produced this result (stamped renderer-side; not part of LLM output) */
  queryType?: QueryType
}

export interface AiBulkQuery {
  collectionId: string
  queryType: QueryType
  config?: LlmConfig
  locale?: string
  /** Coin IDs to skip (used for resume) */
  excludeCoinIds?: string[]
}

export interface AiSingleQuery {
  coinId: string
  queryType: QueryType
  config?: LlmConfig
  locale?: string
}

export interface LlmConfig {
  provider: 'openrouter' | 'lmstudio' | 'ollama'
  model: string
  baseUrl: string
  apiKey: string
  enableWebSearch: boolean
  search?: SearchConfig
}

export interface LlmTestResult {
  ok: boolean
  error?: string
  /** Structured classification of the error (when ok=false) for friendly messages. */
  errorInfo?: LlmErrorInfo
  /** Whether the model supports OpenAI tool-calling (for local models) */
  toolCallSupported?: boolean
  /** Whether the search provider is reachable/auth'd */
  searchProviderOk?: boolean
  /** Human-readable reason the search provider failed (status code, etc.) */
  searchProviderError?: string
}

/** Machine-readable error codes used to render localized, actionable messages. */
export type LlmErrorCode =
  | 'connection_refused' // ECONNREFUSED / fetch failed — local server not running
  | 'host_not_found' // ENOTFOUND / getaddrinfo
  | 'timeout' // ETIMEDOUT / request timeout
  | 'auth_error' // HTTP 401/403
  | 'model_not_found' // HTTP 404
  | 'rate_limit' // HTTP 429
  | 'server_error' // HTTP 5xx
  | 'empty_response' // model returned nothing usable
  | 'invalid_response' // not JSON / failed schema validation
  | 'unknown'

export interface LlmErrorInfo {
  code: LlmErrorCode
  provider: LlmConfig['provider']
  baseUrl: string
  model: string
  status?: number
  /** Raw underlying message, for fallback display / debugging. */
  detail?: string
}

/** Structured result returned by LLM IPC handlers instead of throwing. */
export type LlmQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: LlmErrorInfo }

export interface LlmBulkProgress {
  processed: number
  total: number
  currentBatch: number
  totalBatches: number
  results: AiCoinInfo[]
}

export interface BulkSessionState {
  collectionId: string
  queryType: QueryType
  processedCoinIds: string[]
  startedAt: number
}

export type LlmProviderType = LlmConfig['provider']

/** Title prefix for AI-generated coin notes */
export const AI_NOTE_TITLE_PREFIX = 'AI: '

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  provider: 'ddg',
  apiKeys: {},
  baseUrl: '',
  maxResults: 5
}
