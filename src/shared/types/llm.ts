// LLM integration types shared between main and renderer

export type QueryType = 'prices' | 'mintage' | 'info'

export interface AiCoinInfo {
  id: string
  info?: string
  price?: string
  mintage?: string
  rarity?: string
  varieties?: string[]
}

export interface AiBulkQuery {
  collectionId: string
  queryType: QueryType
  config?: LlmConfig
}

export interface AiSingleQuery {
  coinId: string
  queryType: QueryType
  config?: LlmConfig
}

export interface LlmConfig {
  provider: 'openrouter' | 'lmstudio' | 'ollama'
  model: string
  baseUrl: string
  apiKey: string
}

export interface LlmTestResult {
  ok: boolean
  error?: string
}

export type LlmProviderType = LlmConfig['provider']
