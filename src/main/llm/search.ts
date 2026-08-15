/**
 * Web search tool factory for LangChain tool-calling agents.
 *
 * Creates a DynamicTool for each supported search provider. The tool
 * is bound to the ChatOpenAI model and invoked during the manual
 * tool-call loop (see chains.ts).
 */

import { DynamicTool } from '@langchain/core/tools'
import type { SearchConfig, SearchProvider } from '@shared/types'
import { net } from 'electron'

// NOTE: search requests use Electron's `net.fetch` (Chromium network stack)
// instead of Node's `fetch`. Node's fetch ignores the OS system proxy, so a
// proxy-based VPN (e.g. a local HTTP/SOCKS proxy configured in macOS) would be
// bypassed and requests would egress with the machine's real IP — causing
// geo-blocking (e.g. Tavily 403 from RU). `net.fetch` honors the system proxy.

// ── Result normalization ──────────────────────────────────────────

/** Timeout for individual search API requests (15 seconds). */
const SEARCH_TIMEOUT_MS = 15000

/** AbortSignal with a fixed timeout. Falls back to undefined on old runtimes. */
const timeoutSignal = (): AbortSignal | undefined => {
  try {
    return AbortSignal.timeout(SEARCH_TIMEOUT_MS)
  } catch {
    return undefined
  }
}

interface SearchResult {
  title: string
  snippet: string
  url?: string
}

// ── Typed response shapes for each search provider ───────────────

interface TavilyResponse {
  results?: Array<{ title?: string; content?: string; snippet?: string; url?: string }>
}

interface BraveResponse {
  web?: {
    results?: Array<{ title?: string; description?: string; snippet?: string; url?: string }>
  }
}

interface SearxngResponse {
  results?: Array<{ title?: string; content?: string; snippet?: string; url?: string }>
}

/**
 * Compress search results into a compact format.
 * Each result is prefixed with `[SEARCH]` to help the model distinguish
 * internet content from its own knowledge, reducing prompt-injection risk.
 * Limits each result to 500 chars to avoid overflowing the model context.
 */
function normalizeResults(
  results: SearchResult[],
  maxResults: number,
  maxChars = 500
): string {
  const sliced = results.slice(0, maxResults)
  const lines = sliced.map((r) => {
    const body = r.snippet.length > maxChars ? r.snippet.slice(0, maxChars - 3) + '...' : r.snippet
    return `[SEARCH] ${r.title} — ${body}${r.url ? ` (${r.url})` : ''}`
  })
  if (results.length > maxResults) {
    lines.push(`[SEARCH NOTE] (showing ${maxResults} of ${results.length} results)`)
  }
  return lines.join('\n\n')
}

// ── Provider-specific fetch helpers ──────────────────────────────

async function tavilySearch(query: string, config: SearchConfig): Promise<string> {
  const body = {
    query,
    max_results: config.maxResults,
    search_depth: 'basic' as const
  }
  const res = await net.fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKeys?.tavily ?? ''}`,
      'User-Agent': 'coin-collection/1.0'
    },
    body: JSON.stringify(body),
    signal: timeoutSignal()
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error(`[search:tavily] ${res.status} — ${errText}`)
    // Tavily returns JSON errors (401/429/…). A plain HTML 403 means the
    // request was dropped at the network edge (geo-blocking), not an API error.
    const isHtml = /^\s*</.test(errText)
    const message =
      res.status === 403 && isHtml
        ? 'Tavily search failed (403): request blocked at the network edge (likely geo-blocking). Try a VPN or switch search provider.'
        : `Tavily search failed (${res.status}): ${errText.slice(0, 200)}`
    throw new Error(message)
  }
  const data = (await res.json()) as TavilyResponse
  const results: SearchResult[] = (data.results || []).map(
    (r) => ({
      title: r.title || '',
      snippet: r.content || r.snippet || '',
      url: r.url || ''
    })
  )
  return normalizeResults(results, config.maxResults)
}

async function braveSearch(query: string, config: SearchConfig): Promise<string> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${config.maxResults}`
  const res = await net.fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'User-Agent': 'coin-collection/1.0',
      'X-Subscription-Token': config.apiKeys?.brave ?? ''
    },
    signal: timeoutSignal()
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Brave search failed (${res.status}): ${errText.slice(0, 200)}`)
  }
  const data = (await res.json()) as BraveResponse
  const webResults = data.web?.results || []
  const results: SearchResult[] = webResults.map(
    (r) => ({
      title: r.title || '',
      // Brave returns descriptions with inline HTML (e.g. <strong>) — strip tags
      snippet: (r.description || r.snippet || '').replace(/<[^>]*>/g, ''),
      url: r.url || ''
    })
  )
  return normalizeResults(results, config.maxResults)
}

async function ddgSearch(query: string, config: SearchConfig): Promise<string> {
  // DuckDuckGo lite API — no key required, but rate-limited
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
  const res = await net.fetch(url, {
    signal: timeoutSignal(),
    headers: { 'User-Agent': 'coin-collection/1.0' }
  })
  if (!res.ok) {
    throw new Error(`DuckDuckGo search failed (${res.status})`)
  }
  const html = await res.text()

  // Parse DDG lite results (simple HTML table)
  const results: SearchResult[] = []
  const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>\s*(?:<span[^>]*>([^<]*)<\/span>)?/gi
  let match: RegExpExecArray | null = null
  let count = 0
  while ((match = linkRegex.exec(html)) !== null && count < config.maxResults) {
    const url = match[1]
    const title = match[2].replace(/<[^>]*>/g, '').trim()
    const snippet = (match[3] || '').replace(/<[^>]*>/g, '').trim()
    if (title && url) {
      results.push({ title, snippet, url })
      count++
    }
  }

  if (results.length === 0) {
    console.warn('[search:ddg] No results parsed — DDG may have changed HTML format or be rate-limiting')
    return `No results found for query: "${query}". DuckDuckGo may be rate-limiting — try again later.`
  }

  return normalizeResults(results, config.maxResults)
}

async function searxngSearch(query: string, config: SearchConfig): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`
  const res = await net.fetch(url, {
    signal: timeoutSignal(),
    headers: { 'User-Agent': 'coin-collection/1.0' }
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`SearXNG search failed (${res.status}): ${errText.slice(0, 200)}`)
  }
  const data = (await res.json()) as SearxngResponse
  const results: SearchResult[] = (data.results || []).map(
    (r) => ({
      title: r.title || '',
      snippet: r.content || r.snippet || '',
      url: r.url || ''
    })
  )
  return normalizeResults(results, config.maxResults)
}

// ── Tool factory ──────────────────────────────────────────────────

type SearchFunction = (query: string, config: SearchConfig) => Promise<string>

/**
 * Resolve a provider's search implementation. Throws for unsupported
 * providers ('none' / 'openrouter_builtin' never reach the agentic path).
 */
function getSearchFunction(provider: SearchProvider): SearchFunction {
  switch (provider) {
    case 'tavily':
      return tavilySearch
    case 'brave':
      return braveSearch
    case 'ddg':
      return ddgSearch
    case 'searxng':
      return searxngSearch
    default:
      throw new Error(`Unsupported search provider: ${provider}`)
  }
}

/**
 * Create a LangChain DynamicTool for web search.
 *
 * The tool name is `web_search` so that prompt instructions like
 * "use the web_search tool" match. The function receives the query
 * string and returns normalized search results.
 */
export function createSearchTool(config: SearchConfig): DynamicTool {
  const search = getSearchFunction(config.provider)

  return new DynamicTool({
    name: 'web_search',
    description:
      'Search the internet for current information about coins, prices, catalog numbers, mintage data, and numismatic facts. Input: a search query string. Output: search result titles with snippets.',
    func: async (query: string) => {
      try {
        return await search(query, config)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return `Search error: ${msg}. Try a different query or tell the user the search is unavailable.`
      }
    }
  })
}

// ── Provider connectivity test ────────────────────────────────────

/**
 * Test that the search provider is reachable and the API key (if needed)
 * is valid. Returns `{ ok, error }`.
 */
export async function testSearchProvider(config: SearchConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const search = getSearchFunction(config.provider)
    // Run a quick test query — keep it very short
    await search('test', config)
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
