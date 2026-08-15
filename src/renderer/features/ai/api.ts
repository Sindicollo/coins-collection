import type { AiCoinInfo, AiBulkQuery, AiSingleQuery, LlmConfig, LlmTestResult, QueryType, BulkSessionState } from '@shared/types'
import i18n from '@/lib/i18n'

function getLocale(): string {
  return i18n.language?.split('-')[0] || 'en'
}

export async function queryBulk(
  collectionId: string,
  queryType: QueryType,
  excludeCoinIds?: string[]
): Promise<AiCoinInfo[]> {
  console.log('[aiApi] queryBulk:', { collectionId, queryType, excludeCount: excludeCoinIds?.length })
  const query: AiBulkQuery = {
    collectionId,
    queryType,
    locale: getLocale(),
    excludeCoinIds
  }
  const result = await window.api.llm.queryBulk(query)
  console.log('[aiApi] queryBulk response:', result.length, 'items')
  return result
}

export async function querySingle(
  coinId: string,
  queryType: QueryType
): Promise<AiCoinInfo> {
  const query: AiSingleQuery = {
    coinId,
    queryType,
    locale: getLocale()
  }
  return window.api.llm.querySingle(query)
}

export async function getConfig(): Promise<LlmConfig> {
  return window.api.llm.getConfig()
}

export async function setConfig(config: LlmConfig): Promise<void> {
  return window.api.llm.setConfig(config)
}

export async function testConnection(config?: LlmConfig): Promise<LlmTestResult> {
  return window.api.llm.testConnection(config)
}

export async function getBulkSession(
  collectionId: string,
  queryType: QueryType
): Promise<BulkSessionState | null> {
  return window.api.llm.getBulkSession(collectionId, queryType)
}

export async function clearBulkSession(
  collectionId: string,
  queryType: QueryType
): Promise<void> {
  return window.api.llm.clearBulkSession(collectionId, queryType)
}
