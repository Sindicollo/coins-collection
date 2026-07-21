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
  apiKey: string
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
  /** Whether the model supports OpenAI tool-calling (for local models) */
  toolCallSupported?: boolean
  /** Whether the search provider is reachable/auth'd */
  searchProviderOk?: boolean
}

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
  provider: 'tavily',
  apiKey: '',
  baseUrl: '',
  maxResults: 5
}
