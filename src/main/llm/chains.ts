import { ChatPromptTemplate } from '@langchain/core/prompts'
import type { BaseMessage } from '@langchain/core/messages'
import { AIMessage, ToolMessage, SystemMessage, HumanMessage } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { DynamicTool } from '@langchain/core/tools'
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
        // If the top-level bracket pair just closed, truncate here (ignore trailing text)
        if (stack.length === 0) {
          return json.slice(0, i + 1)
        }
      }
    }
  }

  // If we reach the end and the top-level bracket isn't closed, add missing brackets
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
  if (!rawText || rawText.trim().length === 0) {
    throw new Error(
      'Model returned empty response. Check that the model name is correct and the API key is valid.'
    )
  }

  const cleaned = extractJsonFromText(rawText)

  if (!cleaned || cleaned.trim().length === 0) {
    throw new Error(
      `Model response contained no JSON. Raw response: ${rawText.slice(0, 200)}`
    )
  }

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
  if (!rawText || rawText.trim().length === 0) {
    throw new Error(
      'Model returned empty response. Check that the model name is correct and the API key is valid.'
    )
  }

  const cleaned = extractJsonFromText(rawText)

  if (!cleaned || cleaned.trim().length === 0) {
    throw new Error(
      `Model response contained no JSON. Raw response: ${rawText.slice(0, 200)}`
    )
  }

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

const EN_PRICE = `You are a professional numismatist-expert. For each coin below, estimate current market value USING WEB SEARCH.

YOUR TOOLS: you have internet search access. You MUST use it for every step below.

SEARCH PLAN (execute for each coin):
1. Find the EXACT catalog number (KM#) — search "[year] [denomination] [country] Krause KM#". VERIFY the number matches THIS coin, not a similar one (e.g., don't confuse crown with half-crown or 5 pounds).
2. Find exact weight and fineness — search "[denomination] [year] [country] specifications".
3. Find RECENT (2025-2026) sold prices on eBay — search "sold [year] [denomination] [country] eBay". Use RANGE of actual sold prices, not asking prices.
4. Calculate melt value for silver/gold (metal spot price × pure metal weight). Use as MINIMUM floor price.
5. If web search yields no results — honestly state "no web search data available, estimate from training data".

OUTPUT FORMAT:
Quote price as RANGE: "500-800 RUB (~$6-9 USD)". For Russian coins, primary in RUB.
In "info" field include catalog number, source, weight and fineness.
Do NOT invent prices — if no data, write "needs verification".

OUTPUT ONLY raw JSON — no markdown, no code fences, no extra text.
STRICTLY follow this format (only fields: id, price, info, rarity, varieties):
{{"id": "...", "price": "150-300 $ (~13500-27000 ₽)", "info": "KM# 765. Silver 925, 28.28g. Melt ~25$.", "rarity": "Common", "varieties": "London mint, reeded edge"}}`

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

STRICTLY follow this format (only fields id, mintage, info, rarity, varieties):
{{"id": "...", "mintage": "1807200", "info": "KM# 765. Royal Mint London.", "rarity": "Common", "varieties": "No significant varieties"}}`

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

STRICTLY follow this format (only fields id, info, price, mintage, rarity, varieties):
{{"id": "...", "info": "Silver crown Victoria 1889. KM# 765. London mint.", "price": "150-300 $", "mintage": "1807200", "rarity": "Common", "varieties": "London mint, reeded edge"}}`

const RU_PRICE = `
Ты — профессиональный нумизмат-эксперт. Для каждой монеты ниже оцени текущую рыночную стоимость, ИСПОЛЬЗУЯ ВЕБ-ПОИСК.

ТВОИ ИНСТРУМЕНТЫ: у тебя есть доступ к поиску в интернете. ОБЯЗАТЕЛЬНО используй его для каждого пункта.

ПЛАН ПОИСКА (выполни для каждой монеты):
1. Найди точный каталожный номер (KM#) — ищи "[год] [номинал] [страна] Krause KM#". ПРОВЕРЬ, что номер соответствует именно этой монете, а не похожей (например, не путай крону с полкроной или 5 фунтов).
2. Найди точный вес и пробу — ищи "[номинал] [год] [страна] технические характеристики".
3. Найди НЕДАВНИЕ (2025-2026) цены продаж на eBay — ищи "sold [year] [denomination] [country] eBay". Бери ДИАПАЗОН реальных продаж, а не запрашиваемые цены.
4. Рассчитай стоимость лома для серебра/золота (цена металла × вес чистого металла). Используй КАК МИНИМУМ цены.
5. Если веб-поиск не дал результатов — честно напиши «нет данных веб-поиска, оценка по памяти».

ФОРМАТ ОТВЕТА:
Указывай цену ДИАПАЗОНОМ: "500-800 ₽ (~$6-9)". Для российских монет — основная цена в ₽.
В поле "info" укажи каталожный номер, источник, вес и пробу.
Не выдумывай — если нет данных, пиши «требуется проверка».

ВЫВОДИ ТОЛЬКО чистый JSON — без markdown, без code fences, без лишнего текста.
СТРОГО следуй этому формату (только поля id, price, info, rarity, varieties):
{{"id": "...", "price": "150-300 $ (~13500-27000 ₽)", "info": "KM# 765. Серебро 925, 28.28 г. Лом ~25$.", "rarity": "Обычная", "varieties": "Лондонский МД, рубчатый гурт"}}`

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

СТРОГО следуй формату (только поля id, mintage, info, rarity, varieties):
{{"id": "...", "mintage": "1807200", "info": "KM# 765. Королевский монетный двор Лондона.", "rarity": "Обычная", "varieties": "Значимых разновидностей нет"}}`

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

СТРОГО следуй формату (только поля id, info, price, mintage, rarity, varieties):
{{"id": "...", "info": "Крона Виктории 1889. Серебро 925, 28.28г. KM# 765. Лондонский МД.", "price": "150-300 $ (~13500-27000 ₽)", "mintage": "1807200", "rarity": "Обычная", "varieties": "Лондонский МД, рубчатый гурт"}}`

// ── Prompt selection ─────────────────────────────────────────────

type Locale = 'en' | 'ru'

const PROMPTS: Record<Locale, Record<QueryType, string>> = {
  en: { prices: EN_PRICE, mintage: EN_MINTAGE, info: EN_INFO },
  ru: { prices: RU_PRICE, mintage: RU_MINTAGE, info: RU_INFO }
}

/**
 * System prompt without any message placeholder — for the agentic loop,
 * where the coin data is passed as a separate human message.
 */
function getBasePrompt(locale: string, queryType: QueryType): string {
  const lang = locale.startsWith('ru') ? 'ru' : 'en'
  return PROMPTS[lang][queryType]
}

function getPrompt(locale: string, queryType: QueryType, single: boolean): string {
  const lang = locale.startsWith('ru') ? 'ru' : 'en'
  const base = getBasePrompt(locale, queryType)
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

// ── Tool-calling loop (agentic search path) ──────────────────────

export interface TextualToolCall {
  name: string
  args: Record<string, unknown>
}

/**
 * Recover a tool call emitted as plain text instead of a structured
 * OpenAI tool_call. Reasoning models (e.g. Qwen3-family) sometimes
 * "think" the call: it lands in reasoning_content (or content) while
 * the server returns an empty tool_calls array. Two formats are handled:
 *   1. <tool_call>{"name": "...", "arguments": {...}}</tool_call>
 *   2. <tool_call><function=name><parameter=key>value</parameter></function></tool_call>
 */
export function extractTextualToolCall(text: string): TextualToolCall | null {
  if (!text) return null

  const jsonMatch = text.match(/<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/)
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[1])
      if (obj && typeof obj.name === 'string') {
        const args = obj.arguments ?? obj.args ?? {}
        return { name: obj.name, args: typeof args === 'object' && args !== null ? args : {} }
      }
    } catch {
      /* not valid JSON — try the next format */
    }
  }

  const fnMatch = text.match(/<function=([\w.-]+)>([\s\S]*?)<\/function>/)
  if (fnMatch) {
    const [, name, body] = fnMatch
    const args: Record<string, string> = {}
    const paramRe = /<parameter=([\w.-]+)>([\s\S]*?)<\/parameter>/g
    let m: RegExpExecArray | null
    while ((m = paramRe.exec(body)) !== null) {
      args[m[1]] = m[2].trim()
    }
    return { name, args }
  }

  return null
}

/**
 * Run a model with bound tools in a manual agent loop.
 *
 * The model is invoked repeatedly: each time it emits tool_calls,
 * we execute them and feed results back as ToolMessages, then
 * invoke again. Stops when the model returns content without
 * further tool_calls (or maxIterations is reached).
 *
 * Robustness for reasoning models: if structured tool_calls is empty,
 * we look for a textual tool call in reasoning_content/content and
 * execute it; if the answer is empty entirely, the model is nudged
 * towards the final JSON (see nudgeMessage) instead of failing fast.
 */
async function invokeWithTools(
  boundModel: BaseChatModel,
  messages: BaseMessage[],
  tools: DynamicTool[],
  options: { maxIterations?: number; nudgeMessage?: string } = {}
): Promise<string> {
  const { maxIterations = 6, nudgeMessage } = options
  let nudges = 0

  for (let i = 0; i < maxIterations; i++) {
    const response = await boundModel.invoke(messages)

    // LC normalizes OpenAI tool calls: { name, args, type, id }
    // (the raw OpenAI format { function: { name, arguments } } is
    //  also accessible via additional_kwargs.tool_calls for compat)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolCalls: any[] =
      (response as any).tool_calls ||
      response.additional_kwargs?.tool_calls ||
      []

    if (toolCalls.length === 0) {
      const text = getMessageText(response)

      const reasoning = String(response.additional_kwargs?.reasoning_content ?? '')
      const textual = extractTextualToolCall(reasoning) ?? extractTextualToolCall(text)

      if (textual) {
        const tool = tools.find((t) => t.name === textual.name)
        if (tool) {
          console.log('[chains] recovered textual tool call from model output:', textual.name)
          const id = `textual_call_${i}`
          const input = textual.args.query || textual.args.input || JSON.stringify(textual.args)
          const result = await tool.invoke(String(input))
          messages = [
            ...messages,
            new AIMessage({
              content: '',
              tool_calls: [{ id, name: textual.name, args: textual.args, type: 'tool_call' }]
            }),
            new ToolMessage({ content: String(result), tool_call_id: id })
          ]
          continue
        }
      }

      if (!text.trim() && nudgeMessage && nudges < 2) {
        nudges++
        console.log('[chains] empty response without tool calls, nudging model')
        messages = [...messages, new HumanMessage(nudgeMessage)]
        continue
      }

      return text
    }

    // Execute each tool call and collect results
    const toolMessages: ToolMessage[] = []
    for (const tc of toolCalls) {
      const fn = tc.function || tc
      const name = fn.name || tc.name
      const rawArgs = fn.args || fn.arguments
      const args =
        typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs || {}

      const tool = tools.find((t) => t.name === name)
      if (tool) {
        const input = args.query || args.input || JSON.stringify(args)
        const result = await tool.invoke(input)
        toolMessages.push(
          new ToolMessage({
            content: String(result),
            tool_call_id: tc.id || name || `call_${i}`
          })
        )
      }
    }

    messages = [...messages, response, ...toolMessages]
  }

  throw new Error(
    `Tool-call loop exceeded max iterations (${maxIterations}). ` +
      'The model may be stuck in a loop — try a different model or disable web search.'
  )
}

// ── Agentic search functions ────────────────────────────────────

/**
 * Query a single coin with web search via tool-calling agent.
 *
 * Binds the search tool, constructs system+user messages, runs
 * the agentic loop, then parses the final JSON response.
 */
export async function querySingleCoinWithSearch(
  model: BaseChatModel,
  searchTool: DynamicTool,
  coin: Coin,
  queryType: QueryType,
  locale = 'en'
): Promise<AiCoinInfo> {
  console.log('[chains] querySingleCoinWithSearch:', {
    coinId: coin.id,
    queryType,
    locale
  })

  // Use the bare system prompt: the coin data goes into the human message,
  // so the prompt must not contain the literal '{coin}' placeholder.
  const promptText = getBasePrompt(locale, queryType)
  const coinText = formatSingleCoinForPrompt(coin)
  const lang = locale.startsWith('ru') ? 'ru' : 'en'
  const coinLabel = lang === 'ru' ? 'Монета' : 'Coin'

  const nudgeMessage =
    lang === 'ru'
      ? 'Теперь выведи ТОЛЬКО финальный JSON по монете — без рассуждений, без вызовов инструментов, без markdown.'
      : 'Now output ONLY the final JSON for the coin — no reasoning, no tool calls, no markdown.'

  const messages: BaseMessage[] = [
    new SystemMessage(promptText),
    new HumanMessage(`${coinLabel}:\n${coinText}`)
  ]

  if (!model.bindTools) {
    throw new Error('Model does not support tool binding (bindTools is not available)')
  }
  // bindTools returns Runnable<...>, but invoke accepts the same message format.
  // We use bind and cast back to BaseChatModel for the invoke interface.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boundModel = model.bindTools([searchTool]) as any as BaseChatModel
  const rawText = await invokeWithTools(boundModel, messages, [searchTool], { nudgeMessage })

  return extractAndValidateSingle(rawText)
}
