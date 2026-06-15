import type { AiCoinInfo, AiBulkQuery, AiSingleQuery, LlmConfig, LlmTestResult } from '@shared/types'

export async function queryBulk(
  collectionId: string,
  queryType: string
): Promise<AiCoinInfo[]> {
  const query: AiBulkQuery = {
    collectionId,
    queryType: queryType as AiBulkQuery['queryType']
  }
  return window.api.llm.queryBulk(query)
}

export async function querySingle(
  coinId: string,
  queryType: string
): Promise<AiCoinInfo> {
  const query: AiSingleQuery = {
    coinId,
    queryType: queryType as AiSingleQuery['queryType']
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
