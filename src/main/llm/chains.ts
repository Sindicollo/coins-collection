import { ChatPromptTemplate } from '@langchain/core/prompts'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { AiCoinInfoArraySchema } from './schemas'
import type { AiCoinInfo, QueryType } from '@shared/types'
import type { Coin } from '@shared/types'

function formatCoinsForPrompt(coins: Coin[]): string {
  return coins
    .map(
      (c) =>
        `- id: ${c.id}\n  denomination: ${c.denomination}\n  country: ${c.country ?? 'unknown'}\n  year: ${c.year ?? 'unknown'}\n  condition: ${c.condition ?? 'unknown'}`
    )
    .join('\n')
}

function formatSingleCoinForPrompt(coin: Coin): string {
  return `id: ${coin.id}
denomination: ${coin.denomination}
country: ${coin.country ?? 'unknown'}
year: ${coin.year ?? 'unknown'}
condition: ${coin.condition ?? 'unknown'}`
}

const PRICE_PROMPT = `You are a numismatic expert specializing in coin pricing.

For each coin below, estimate the CURRENT market price based on recent auction results, eBay sold listings, and dealer catalogs. Include the price range in the original currency when possible.

CRITICAL: Respond ONLY with a valid JSON array. Each object must have "id" matching the input coin.
Include "price" (required) and optionally "info", "rarity", "varieties".

Coins:
{coins}`

const MINTAGE_PROMPT = `You are a numismatic expert specializing in coin mintage data and varieties.

For each coin below, provide the official mintage figures, rarity assessment, and known die or edge varieties.

CRITICAL: Respond ONLY with a valid JSON array. Each object must have "id" matching the input coin.
Include "mintage" (required), "rarity", "varieties", and optionally "info" for historical minting context.

Coins:
{coins}`

const INFO_PROMPT = `You are a numismatic expert with deep knowledge of world coinage.

For each coin below, provide comprehensive information: historical context, design features and symbolism, interesting facts about the issue, notable design changes across years, and any special significance.

CRITICAL: Respond ONLY with a valid JSON array. Each object must have "id" matching the input coin.
Include "info" (required), and optionally "price", "mintage", "rarity", "varieties".

Coins:
{coins}`

const SINGLE_COIN_PRICE_PROMPT = `You are a numismatic expert specializing in coin pricing.

For this coin, estimate the CURRENT market price based on recent auction results, eBay sold listings, and dealer catalogs. Include the price range in the original currency when possible.

CRITICAL: Respond ONLY with a valid JSON object containing "id" (matching input), "price" (required), and optionally "info", "rarity", "varieties".

Coin:
{coin}`

const SINGLE_COIN_MINTAGE_PROMPT = `You are a numismatic expert specializing in coin mintage data and varieties.

For this coin, provide the official mintage figures, rarity assessment, and known die or edge varieties.

CRITICAL: Respond ONLY with a valid JSON object containing "id" (matching input), "mintage" (required), "rarity", "varieties", and optionally "info".

Coin:
{coin}`

const SINGLE_COIN_INFO_PROMPT = `You are a numismatic expert with deep knowledge of world coinage.

For this coin, provide comprehensive information: historical context, design features and symbolism, interesting facts, notable changes, and any special significance.

CRITICAL: Respond ONLY with a valid JSON object containing "id" (matching input), "info" (required), and optionally "price", "mintage", "rarity", "varieties".

Coin:
{coin}`

const PROMPTS: Record<QueryType, string> = {
  prices: PRICE_PROMPT,
  mintage: MINTAGE_PROMPT,
  info: INFO_PROMPT
}

const SINGLE_PROMPTS: Record<QueryType, string> = {
  prices: SINGLE_COIN_PRICE_PROMPT,
  mintage: SINGLE_COIN_MINTAGE_PROMPT,
  info: SINGLE_COIN_INFO_PROMPT
}

export async function queryBulkCoins(
  model: BaseChatModel,
  coins: Coin[],
  queryType: QueryType
): Promise<AiCoinInfo[]> {
  const modelWithStructure = model.withStructuredOutput(AiCoinInfoArraySchema, {
    name: 'coin_info_array'
  })

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', PROMPTS[queryType]],
    ['user', '{coins}']
  ])

  const chain = prompt.pipe(modelWithStructure)

  const coinsText = formatCoinsForPrompt(coins)
  const result = await chain.invoke({ coins: coinsText })

  return result
}

export async function querySingleCoin(
  model: BaseChatModel,
  coin: Coin,
  queryType: QueryType
): Promise<AiCoinInfo> {
  const modelWithStructure = model.withStructuredOutput(AiCoinInfoArraySchema.element, {
    name: 'single_coin_info'
  })

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', SINGLE_PROMPTS[queryType]],
    ['user', '{coin}']
  ])

  const chain = prompt.pipe(modelWithStructure)

  const coinText = formatSingleCoinForPrompt(coin)
  const result = await chain.invoke({ coin: coinText })

  return result as AiCoinInfo
}
