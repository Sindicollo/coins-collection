import { ChatPromptTemplate } from '@langchain/core/prompts'
import type { BaseMessage } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { AiCoinInfoArraySchema, AiCoinInfoSchema } from './schemas'
import type { AiCoinInfo, QueryType } from '@shared/types'
import type { Coin } from '@shared/types'

const UNKNOWN = 'unknown'

function formatCoinsForPrompt(coins: Coin[]): string {
  return coins
    .map(
      (c) =>
        `- id: ${c.id}\n  denomination: ${c.denomination}\n  country: ${c.country ?? UNKNOWN}\n  year: ${c.year ?? UNKNOWN}\n  condition: ${c.condition ?? UNKNOWN}\n  composition: ${c.composition ?? UNKNOWN}`
    )
    .join('\n')
}

function formatSingleCoinForPrompt(coin: Coin): string {
  return `id: ${coin.id}
denomination: ${coin.denomination}
country: ${coin.country ?? UNKNOWN}
year: ${coin.year ?? UNKNOWN}
condition: ${coin.condition ?? UNKNOWN}
composition: ${coin.composition ?? UNKNOWN}`
}

// ── JSON extraction & repair ─────────────────────────────────────

function extractJsonFromText(text: string): string {
  let cleaned = text.trim()

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  }

  const firstBracket = cleaned.search(/[[{]/)
  if (firstBracket !== -1) {
    cleaned = cleaned.slice(firstBracket)
  }

  return repairTruncatedJson(cleaned)
}

function repairTruncatedJson(json: string): string {
  let inString = false
  let escaped = false
  const stack: string[] = []

  for (let i = 0; i < json.length; i++) {
    const ch = json[i]
    if (escaped) { escaped = false; continue }
    if (ch === '\\' && inString) { escaped = true; continue }
    if (ch === '"' && !escaped) { inString = !inString; continue }
    if (inString) continue

    if (ch === '{' || ch === '[') {
      stack.push(ch === '{' ? '}' : ']')
    } else if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop()
      }
    }
  }

  let repaired = json
  if (inString) repaired += '"'
  while (stack.length > 0) repaired += stack.pop()!
  return repaired
}

// ── Response parsing & validation ───────────────────────────────

function getMessageText(response: BaseMessage): string {
  const content = response.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((block) => (typeof block === 'string' ? block : 'text' in block ? (block as { text: string }).text : ''))
      .join('')
  }
  return String(content)
}

async function invokeAndExtract(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chain: any,
  input: Record<string, string>
): Promise<string> {
  let response: BaseMessage
  try {
    response = await chain.invoke(input)
  } catch (err) {
    if (err instanceof TypeError && String(err.message).includes("reading 'message'")) {
      throw new Error(
        'Model returned empty response. It may be overloaded, rate-limited, or unavailable on the free tier. Try a different model.'
      )
    }
    throw err
  }
  return getMessageText(response)
}

function parseAndValidateResponse(rawText: string): AiCoinInfo[] {
  const cleaned = extractJsonFromText(rawText)

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr)
    throw new Error(`Failed to parse LLM response as JSON: ${msg}`)
  }

  if (!Array.isArray(parsed) && typeof parsed === 'object' && parsed !== null) {
    parsed = [parsed]
  }

  if (!Array.isArray(parsed)) {
    throw new Error('LLM response must be a JSON array of coin objects')
  }

  const validated = AiCoinInfoArraySchema.safeParse(parsed)
  if (!validated.success) {
    const issues =
      validated.error?.issues?.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') || 'unknown issue'
    throw new Error(`LLM response does not match expected schema: ${issues}`)
  }

  return validated.data
}

function extractAndValidateSingle(rawText: string): AiCoinInfo {
  const cleaned = extractJsonFromText(rawText)

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr)
    throw new Error(`Failed to parse LLM response as JSON: ${msg}`)
  }

  // Handle array wrapping
  if (Array.isArray(parsed) && parsed.length > 0) {
    parsed = parsed[0]
  }

  const validated = AiCoinInfoSchema.safeParse(parsed)
  if (!validated.success) {
    const issues =
      validated.error?.issues?.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') || 'unknown issue'
    throw new Error(`LLM response does not match expected schema for single coin: ${issues}`)
  }

  return validated.data as AiCoinInfo
}

// ── Prompts ──────────────────────────────────────────────────────

const EN_PRICE = `You are a professional numismatist. For each coin below, estimate current market value (retail price from dealer catalogs, recent eBay sold listings, and auction results).

CRITICAL RULES:
1. FIRST identify the coin correctly: determine metal composition (silver, gold, copper, nickel, etc.), weight, and catalog reference (KM#, Y#, etc.). Metal value matters — silver/gold coins have a melt value floor.
2. Soviet/Russian coins: 1921-1931 silver coins are 0.900 fine (e.g., 1924 1 ruble = 20g, 18g pure silver). Copper/bronze coins are different denominations (kopecks). DO NOT confuse silver rubles with copper kopecks.
3. Quote price as a RANGE with currency: "500-800 RUB (~$6-9 USD)". For Russian coins, primary price in RUB, secondary in USD.
4. Price varies by condition — use the provided condition grade (UNC, XF, VF, etc.).
5. Be conservative: prefer actual sold prices over asking prices. If uncertain, state so.

OUTPUT ONLY raw JSON — no markdown, no code fences, no extra text.
Required fields per coin: "id" (match input), "price" (range + currency).
Optional: "info" (metal, weight, catalog #), "rarity" (common/scarce/rare), "varieties" (mint marks, edge types).
`

const EN_MINTAGE = `You are a professional numismatist specializing in mintage data. For each coin below, provide official mintage figures from authoritative sources (Krause Standard Catalog of World Coins, national mint records).

CRITICAL RULES:
1. Provide EXACT mintage numbers where known. Distinguish between "total mintage" and "by mint" (e.g., "Leningrad: 8M, Moscow: 5M").
2. Soviet coins before 1960s: check for rare mint mark varieties (Л = Leningrad, МЛ = Moscow, ЛМД/ММД later).
3. Specify source: "KM# 89.1" or "Conros catalog" or "Uzdenikov".
4. Rarity assessment based on mintage and survival rate (not just mintage number — some high-mintage coins are rare in high grades).
5. If exact data unavailable, say so and give best estimate with confidence level.

OUTPUT ONLY raw JSON — no markdown, no code fences, no extra text.
Required: "id" (match input), "mintage" (figure or "unknown").
Optional: "rarity", "varieties" (mint marks, edge varieties, die varieties), "info" (historical context, source reference).`

const EN_INFO = `You are a professional numismatist with deep knowledge of world coinage. For each coin below, provide comprehensive numismatic information.

CRITICAL RULES:
1. IDENTIFY the coin precisely: metal composition (fineness), weight (grams), diameter (mm), edge type, design details (obverse/reverse), catalog numbers (KM#, Y#, Conros).
2. Historical context: why was this coin issued? Monetary reform? Commemorative? Key events of that year?
3. Design: who designed it? Symbolism? Notable design features?
4. Interesting facts: errors, varieties, recalls, historical anecdotes.
5. Relation to other coins in the series: first year? last year? design changes?

OUTPUT ONLY raw JSON — no markdown, no code fences, no extra text.
Required: "id" (match input), "info" (comprehensive text).
Optional: "price", "mintage", "rarity", "varieties".`

const RU_PRICE = `Ты — профессиональный нумизмат. Для каждой монеты ниже оцени текущую рыночную стоимость (розничные цены из каталогов дилеров, недавние продажи на eBay и аукционах).

ВАЖНЫЕ ПРАВИЛА:
1. СНАЧАЛА правильно определи монету: металл (серебро, золото, медь, никель и т.д.), вес, каталожный номер (KM#, Y#, Conros). Стоимость металла имеет значение — у серебряных/золотых монет есть минимальная цена лома.
2. Советские/российские монеты: серебряные монеты 1921-1931 гг. — 900 проба (например, 1 рубль 1924 = 20г, 18г чистого серебра). Медные/бронзовые — это копейки. НЕ путай серебряные рубли с медными копейками.
3. Указывай цену ДИАПАЗОНОМ с валютой: "500-800 ₽ (~$6-9)". Для российских монет — основная цена в рублях, дополнительно в USD.
4. Цена зависит от состояния — используй указанную степень сохранности (UNC, XF, VF и т.д.).
5. Будь консервативен: предпочитай реальные цены продаж, а не запрашиваемые. Если не уверен — укажи это.

ВЫВОДИ ТОЛЬКО чистый JSON — без markdown, без code fences, без лишнего текста.
Обязательные поля: "id" (совпадает с входным), "price" (диапазон + валюта).
Опционально: "info" (металл, вес, каталог), "rarity" (обычная/редкая), "varieties" (знаки монетного двора, гурты).`

const RU_MINTAGE = `Ты — профессиональный нумизмат, специализирующийся на тиражах. Для каждой монеты ниже предоставь официальные данные о тиражах из авторитетных источников (Krause Standard Catalog of World Coins, записи монетных дворов).

ВАЖНЫЕ ПРАВИЛА:
1. Указывай ТОЧНЫЕ цифры тиражей, где известны. Различай «общий тираж» и «по монетным дворам» (например, «Ленинград: 8 млн, Москва: 5 млн»).
2. Советские монеты до 1960-х: проверь редкие знаки монетного двора (Л = Ленинград, МЛ = Москва, позже ЛМД/ММД).
3. Указывай источник: «KM# 89.1» или «каталог Conros» или «Уздеников».
4. Оценка редкости — на основе тиража И сохранности (некоторые массовые монеты редки в высоких степенях).
5. Если точных данных нет — скажи об этом и дай лучшую оценку с уровнем уверенности.

ВЫВОДИ ТОЛЬКО чистый JSON — без markdown, без code fences, без лишнего текста.
Обязательные: "id" (совпадает с входным), "mintage" (цифра или "неизвестно").
Опционально: "rarity", "varieties" (знаки МД, разновидности гурта, штемпелей), "info" (контекст, источник).`

const RU_INFO = `Ты — профессиональный нумизмат с глубокими знаниями мировых монет. Для каждой монеты ниже предоставь исчерпывающую нумизматическую информацию.

ВАЖНЫЕ ПРАВИЛА:
1. ТОЧНО идентифицируй монету: металл (проба), вес (граммы), диаметр (мм), тип гурта, детали дизайна (аверс/реверс), каталожные номера (KM#, Y#, Conros).
2. Исторический контекст: почему выпущена? Денежная реформа? Памятная? Ключевые события года?
3. Дизайн: кто автор? Символика? Примечательные особенности?
4. Интересные факты: ошибки, разновидности, изъятия из обращения, исторические анекдоты.
5. Связь с другими монетами серии: первый год? последний? изменения дизайна?

ВЫВОДИ ТОЛЬКО чистый JSON — без markdown, без code fences, без лишнего текста.
Обязательные: "id" (совпадает с входным), "info" (исчерпывающий текст).
Опционально: "price", "mintage", "rarity", "varieties".`

// ── Prompt selection ─────────────────────────────────────────────

type Locale = 'en' | 'ru'

const PROMPTS: Record<Locale, Record<QueryType, string>> = {
  en: { prices: EN_PRICE, mintage: EN_MINTAGE, info: EN_INFO },
  ru: { prices: RU_PRICE, mintage: RU_MINTAGE, info: RU_INFO }
}

function getPrompt(locale: string, queryType: QueryType, single: boolean): string {
  const lang = locale.startsWith('ru') ? 'ru' : 'en'
  const base = PROMPTS[lang][queryType]
  if (single) {
    return base + '\n' + (lang === 'ru' ? 'Монета:' : 'Coin:') + '\n{coin}'
  }
  const note =
    lang === 'ru'
      ? '\n\nВАЖНО: обработай ВСЕ монеты выше. Будь КРАТКИМ — максимум 2-3 предложения на монету. Не пропускай ни одной.'
      : '\n\nIMPORTANT: process ALL coins above. Be CONCISE — 2-3 sentences per coin maximum. Do NOT skip any coin.'
  return base + '\n' + (lang === 'ru' ? 'Монеты:' : 'Coins:') + '\n{coins}' + note
}

// ── Exported functions ──────────────────────────────────────────

export async function queryBulkCoins(
  model: BaseChatModel,
  coins: Coin[],
  queryType: QueryType,
  locale = 'en'
): Promise<AiCoinInfo[]> {
  console.log('[chains] queryBulkCoins:', { coinCount: coins.length, queryType, locale })

  const promptText = getPrompt(locale, queryType, false)
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', promptText],
    ['user', '{coins}']
  ])

  const chain = prompt.pipe(model)
  const coinsText = formatCoinsForPrompt(coins)

  const rawText = await invokeAndExtract(chain, { coins: coinsText })
  return parseAndValidateResponse(rawText)
}

export async function querySingleCoin(
  model: BaseChatModel,
  coin: Coin,
  queryType: QueryType,
  locale = 'en'
): Promise<AiCoinInfo> {
  console.log('[chains] querySingleCoin:', { coinId: coin.id, queryType, locale })

  const promptText = getPrompt(locale, queryType, true)
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', promptText],
    ['user', '{coin}']
  ])

  const chain = prompt.pipe(model)
  const coinText = formatSingleCoinForPrompt(coin)

  const rawText = await invokeAndExtract(chain, { coin: coinText })
  return extractAndValidateSingle(rawText)
}
