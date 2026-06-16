import { ChatPromptTemplate } from '@langchain/core/prompts'
import type { BaseMessage } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { AiCoinInfoArraySchema, AiCoinInfoSchema } from './schemas'
import type { AiCoinInfo, QueryType } from '@shared/types'
import type { Coin } from '@shared/types'

function formatCoinsForPrompt(coins: Coin[]): string {
  return coins
    .map(
      (c) =>
        `- id: ${c.id}\n  denomination: ${c.denomination}\n  country: ${c.country ?? 'unknown'}\n  year: ${c.year ?? 'unknown'}\n  condition: ${c.condition ?? 'unknown'}\n  composition: ${c.composition ?? 'unknown'}`
    )
    .join('\n')
}

function formatSingleCoinForPrompt(coin: Coin): string {
  return `id: ${coin.id}
denomination: ${coin.denomination}
country: ${coin.country ?? 'unknown'}
year: ${coin.year ?? 'unknown'}
condition: ${coin.condition ?? 'unknown'}
composition: ${coin.composition ?? 'unknown'}`
}

/** Strip markdown code fences and extract/repair JSON from model output */
function extractJsonFromText(text: string): string {
  let cleaned = text.trim()

  // Remove markdown code fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  }

  // Remove any leading non-JSON text (find first [ or {)
  const firstBracket = cleaned.search(/[[{]/)
  if (firstBracket !== -1) {
    cleaned = cleaned.slice(firstBracket)
  }

  // Try to repair truncated JSON by closing unclosed brackets/braces
  return repairTruncatedJson(cleaned)
}

/** Close unclosed brackets and braces to salvage truncated JSON */
function repairTruncatedJson(json: string): string {
  let inString = false
  let escaped = false
  const stack: string[] = []

  for (let i = 0; i < json.length; i++) {
    const ch = json[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\' && inString) {
      escaped = true
      continue
    }
    if (ch === '"' && !escaped) {
      inString = !inString
      continue
    }
    if (inString) continue

    if (ch === '{' || ch === '[') {
      stack.push(ch === '{' ? '}' : ']')
    } else if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop()
      }
    }
  }

  // Close any unclosed structures
  let repaired = json
  if (inString) {
    repaired += '"'
  }
  while (stack.length > 0) {
    repaired += stack.pop()!
  }
  return repaired
}

// ── English prompts ──────────────────────────────────────────────
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
// ──────────────────────────────────────────────────────────────────
const EN_MINTAGE = `You are a professional numismatist specializing in mintage data. For each coin below, provide official mintage figures from authoritative sources (Krause Standard Catalog of World Coins, national mint records).

CRITICAL RULES:
1. Provide EXACT mintage numbers where known. Distinguish between "total mintage" and "by mint" (e.g., "Leningrad: 8M, Moscow: 5M").
2. Soviet coins before 1960s: check for rare mint mark varieties (Л = Leningrad, МЛ = Moscow, ЛМД/ММД later).
3. Specify source: "KM# 89.1" or "Conros catalog" or "Uzdenikov".
4. Rarity assessment based on mintage and survival rate (not just mintage number — some high-mintage coins are rare in high grades).
5. If exact data unavailable, say so and give best estimate with confidence level.

OUTPUT ONLY raw JSON — no markdown, no code fences, no extra text.
Required: "id" (match input), "mintage" (figure or "unknown").
Optional: "rarity", "varieties" (mint marks, edge varieties, die varieties), "info" (historical context, source reference).

`

const EN_INFO = `You are a professional numismatist with deep knowledge of world coinage. For each coin below, provide comprehensive numismatic information.

CRITICAL RULES:
1. IDENTIFY the coin precisely: metal composition (fineness), weight (grams), diameter (mm), edge type, design details (obverse/reverse), catalog numbers (KM#, Y#, Conros).
2. Historical context: why was this coin issued? Monetary reform? Commemorative? Key events of that year?
3. Design: who designed it? Symbolism? Notable design features?
4. Interesting facts: errors, varieties, recalls, historical anecdotes.
5. Relation to other coins in the series: first year? last year? design changes?

OUTPUT ONLY raw JSON — no markdown, no code fences, no extra text.
Required: "id" (match input), "info" (comprehensive text).
Optional: "price", "mintage", "rarity", "varieties".

`

// ── Russian prompts ──────────────────────────────────────────────
const RU_PRICE = `Ты — профессиональный нумизмат. Для каждой монеты ниже оцени текущую рыночную стоимость (розничные цены из каталогов дилеров, недавние продажи на eBay и аукционах).

ВАЖНЫЕ ПРАВИЛА:
1. СНАЧАЛА правильно определи монету: металл (серебро, золото, медь, никель и т.д.), вес, каталожный номер (KM#, Y#, Conros). Стоимость металла имеет значение — у серебряных/золотых монет есть минимальная цена лома.
2. Советские/российские монеты: серебряные монеты 1921-1931 гг. — 900 проба (например, 1 рубль 1924 = 20г, 18г чистого серебра). Медные/бронзовые — это копейки. НЕ путай серебряные рубли с медными копейками.
3. Указывай цену ДИАПАЗОНОМ с валютой: "500-800 ₽ (~$6-9)". Для российских монет — основная цена в рублях, дополнительно в USD.
4. Цена зависит от состояния — используй указанную степень сохранности (UNC, XF, VF и т.д.).
5. Будь консервативен: предпочитай реальные цены продаж, а не запрашиваемые. Если не уверен — укажи это.

ВЫВОДИ ТОЛЬКО чистый JSON — без markdown, без code fences, без лишнего текста.
Обязательные поля: "id" (совпадает с входным), "price" (диапазон + валюта).
Опционально: "info" (металл, вес, каталог), "rarity" (обычная/редкая), "varieties" (знаки монетного двора, гурты).

`


const RU_MINTAGE = `Ты — профессиональный нумизмат, специализирующийся на тиражах. Для каждой монеты ниже предоставь официальные данные о тиражах из авторитетных источников (Krause Standard Catalog of World Coins, записи монетных дворов).

ВАЖНЫЕ ПРАВИЛА:
1. Указывай ТОЧНЫЕ цифры тиражей, где известны. Различай «общий тираж» и «по монетным дворам» (например, «Ленинград: 8 млн, Москва: 5 млн»).
2. Советские монеты до 1960-х: проверь редкие знаки монетного двора (Л = Ленинград, МЛ = Москва, позже ЛМД/ММД).
3. Указывай источник: «KM# 89.1» или «каталог Conros» или «Уздеников».
4. Оценка редкости — на основе тиража И сохранности (некоторые массовые монеты редки в высоких степенях).
5. Если точных данных нет — скажи об этом и дай лучшую оценку с уровнем уверенности.

ВЫВОДИ ТОЛЬКО чистый JSON — без markdown, без code fences, без лишнего текста.
Обязательные: "id" (совпадает с входным), "mintage" (цифра или "неизвестно").
Опционально: "rarity", "varieties" (знаки МД, разновидности гурта, штемпелей), "info" (контекст, источник).

`


const RU_INFO = `Ты — профессиональный нумизмат с глубокими знаниями мировых монет. Для каждой монеты ниже предоставь исчерпывающую нумизматическую информацию.

ВАЖНЫЕ ПРАВИЛА:
1. ТОЧНО идентифицируй монету: металл (проба), вес (граммы), диаметр (мм), тип гурта, детали дизайна (аверс/реверс), каталожные номера (KM#, Y#, Conros).
2. Исторический контекст: почему выпущена? Денежная реформа? Памятная? Ключевые события года?
3. Дизайн: кто автор? Символика? Примечательные особенности?
4. Интересные факты: ошибки, разновидности, изъятия из обращения, исторические анекдоты.
5. Связь с другими монетами серии: первый год? последний? изменения дизайна?

ВЫВОДИ ТОЛЬКО чистый JSON — без markdown, без code fences, без лишнего текста.
Обязательные: "id" (совпадает с входным), "info" (исчерпывающий текст).
Опционально: "price", "mintage", "rarity", "varieties".

`


// ── Prompt selection ─────────────────────────────────────────────
type Locale = 'en' | 'ru'

const PROMPTS: Record<Locale, Record<QueryType, string>> = {
  en: { prices: EN_PRICE, mintage: EN_MINTAGE, info: EN_INFO },
  ru: { prices: RU_PRICE, mintage: RU_MINTAGE, info: RU_INFO }
}

function getPrompt(locale: string, queryType: QueryType, single: boolean): string {
  const lang = locale.startsWith('ru') ? 'ru' : 'en'
  const base = PROMPTS[lang][queryType]
  // Prepend no-reasoning directive — must be at the TOP for max impact
  /*
  const noThink =
    lang === 'ru'
      ? 'ВАЖНЕЙШЕЕ ПРАВИЛО: НЕ размышляй, НЕ рассуждай, НЕ пиши внутренний монолог. Сразу выдай готовый JSON. Никаких мыслей перед ответом — только JSON.\n\n'
      : 'CRITICAL RULE: Do NOT think, reason, or write internal monologue. Output ONLY the final JSON immediately. No thoughts before the answer — just JSON.\n\n'
  */
      // Append coin list instruction
  if (single) {
    return base + '\n' + (lang === 'ru' ? 'Монета:' : 'Coin:') + '\n{coin}'
  }
  const note =
    lang === 'ru'
      ? '\n\nВАЖНО: обработай ВСЕ монеты выше. Будь КРАТКИМ — максимум 2-3 предложения на монету. Не пропускай ни одной.'
      : '\n\nIMPORTANT: process ALL coins above. Be CONCISE — 2-3 sentences per coin maximum. Do NOT skip any coin.'
  return base + '\n' + (lang === 'ru' ? 'Монеты:' : 'Coins:') + '\n{coins}' + note
}

/** Extract text content from a LangChain message, handling both string and complex content */
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

/** Safe invoke wrapper — catches LangChain bug with empty generations */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeInvoke<T>(chain: any, input: Record<string, string>): Promise<T> {
  try {
    return (await chain.invoke(input)) as T
  } catch (err) {
    if (
      err instanceof TypeError &&
      String(err.message).includes("reading 'message'")
    ) {
      throw new Error(
        'Model returned empty response. It may be overloaded, rate-limited, or unavailable on the free tier. Try a different model.'
      )
    }
    throw err
  }
}

export async function queryBulkCoins(
  model: BaseChatModel,
  coins: Coin[],
  queryType: QueryType,
  locale = 'en'
): Promise<AiCoinInfo[]> {
  console.log('[chains] queryBulkCoins:', { coinCount: coins.length, queryType, locale })

  const promptText = getPrompt(locale, queryType, false)
  // Replace {coins} placeholder (already in the prompt via getPrompt)
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', promptText],
    ['user', '{coins}']
  ])

  const chain = prompt.pipe(model)
  const coinsText = formatCoinsForPrompt(coins)
  console.log('[chains] prompt length:', coinsText.length, 'chars, invoking...')

  const response = await safeInvoke<BaseMessage>(chain, { coins: coinsText })
  const rawText = getMessageText(response)
  console.log('[chains] raw response first 300 chars:', rawText.slice(0, 300))

  const jsonText = extractJsonFromText(rawText)
  console.log('[chains] cleaned JSON first 200 chars:', jsonText.slice(0, 200))

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (parseErr) {
    console.error('[chains] JSON parse error:', parseErr instanceof Error ? parseErr.message : parseErr)
    console.error('[chains] Failed JSON text:', jsonText.slice(0, 500))
    throw new Error(`Failed to parse LLM response as JSON: ${parseErr instanceof Error ? parseErr.message : parseErr}`)
  }

  // If model returned a single object instead of array, wrap it
  if (!Array.isArray(parsed) && typeof parsed === 'object' && parsed !== null) {
    console.log('[chains] Model returned object instead of array, wrapping in array')
    parsed = [parsed]
  }

  const validated = AiCoinInfoArraySchema.safeParse(parsed)
  if (!validated.success) {
    const issues =
      validated.error?.issues?.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') ||
      'unknown issue'
    console.error('[chains] Schema validation failed:', issues)
    console.error('[chains] Parsed JSON:', JSON.stringify(parsed).slice(0, 500))
    throw new Error(`LLM response does not match expected schema: ${issues}`)
  }

  console.log('[chains] validated result:', validated.data.length, 'coins')
  return validated.data
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

  const response = await safeInvoke<BaseMessage>(chain, { coin: coinText })
  const rawText = getMessageText(response)
  console.log('[chains] raw response first 300 chars:', rawText.slice(0, 300))

  const jsonText = extractJsonFromText(rawText)
  console.log('[chains] cleaned JSON first 200 chars:', jsonText.slice(0, 200))

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (parseErr) {
    console.error('[chains] JSON parse error:', parseErr instanceof Error ? parseErr.message : parseErr)
    throw new Error(`Failed to parse LLM response as JSON: ${parseErr instanceof Error ? parseErr.message : parseErr}`)
  }

  let validated = AiCoinInfoSchema.safeParse(parsed)

  // If model wrapped single coin in an array, extract first element
  if (!validated.success && Array.isArray(parsed) && parsed.length > 0) {
    console.log('[chains] Model returned array for single coin, extracting first element')
    validated = AiCoinInfoSchema.safeParse(parsed[0])
  }

  if (!validated.success) {
    const issues =
      validated.error?.issues?.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') ||
      'unknown issue'
    console.error('[chains] Schema validation failed:', issues)
    console.error('[chains] Parsed JSON:', JSON.stringify(parsed).slice(0, 500))
    throw new Error(`LLM response does not match expected schema for single coin: ${issues}`)
  }

  console.log('[chains] validated single result:', validated.data.id)
  return validated.data as AiCoinInfo
}
