import type { AiCoinInfo, AiBulkQuery, AiSingleQuery, LlmConfig, LlmTestResult, QueryType } from '@shared/types'
import i18n from '@/lib/i18n'

function getLocale(): string {
  return i18n.language?.split('-')[0] || 'en'
}

export async function queryBulk(
  collectionId: string,
  queryType: QueryType
): Promise<AiCoinInfo[]> {
  console.log('[aiApi] queryBulk:', { collectionId, queryType })
  const query: AiBulkQuery = {
    collectionId,
    queryType,
    locale: getLocale()
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
