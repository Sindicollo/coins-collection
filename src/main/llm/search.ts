/**
 * Web search tool factory for LangChain tool-calling agents.
 *
 * Creates a DynamicTool for each supported search provider. The tool
 * is bound to the ChatOpenAI model and invoked during the manual
 * tool-call loop (see chains.ts).
 */

import { DynamicTool } from '@langchain/core/tools'
import type { SearchConfig, SearchProvider } from '@shared/types'

// ── Result normalization ──────────────────────────────────────────

interface SearchResult {
  title: string
  snippet: string
  url?: string
}

/**
 * Compress search results into a compact format.
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
    return `${r.title} — ${body}${r.url ? ` (${r.url})` : ''}`
  })
  if (results.length > maxResults) {
    lines.push(`(showing ${maxResults} of ${results.length} results)`)
  }
  return lines.join('\n\n')
}

// ── Provider-specific fetch helpers ──────────────────────────────

async function tavilySearch(query: string, config: SearchConfig): Promise<string> {
  const body = {
    api_key: config.apiKey,
    query,
    max_results: config.maxResults,
    search_depth: 'basic' as const
  }
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Tavily search failed (${res.status}): ${errText.slice(0, 200)}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any
  const results: SearchResult[] = (data.results || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      title: r.title || '',
      snippet: r.content || r.snippet || '',
      url: r.url || ''
    })
  )
  return normalizeResults(results, config.maxResults)
}

async function braveSearch(query: string, config: SearchConfig): Promise<string> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${config.maxResults}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': config.apiKey
    }
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Brave search failed (${res.status}): ${errText.slice(0, 200)}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any
  const results: SearchResult[] = ((data.web?.results as any[]) || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      title: r.title || '',
      snippet: r.description || r.snippet || '',
      url: r.url || ''
    })
  )
  return normalizeResults(results, config.maxResults)
}

async function ddgSearch(query: string, config: SearchConfig): Promise<string> {
  // DuckDuckGo lite API — no key required, but rate-limited
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
  const res = await fetch(url)
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
    return `No results found for query: "${query}". DuckDuckGo may be rate-limiting — try again later.`
  }

  return normalizeResults(results, config.maxResults)
}

async function searxngSearch(query: string, config: SearchConfig): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`
  const res = await fetch(url)
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`SearXNG search failed (${res.status}): ${errText.slice(0, 200)}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any
  const results: SearchResult[] = ((data.results as any[]) || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      title: r.title || '',
      snippet: r.content || r.snippet || '',
      url: r.url || ''
    })
  )
  return normalizeResults(results, config.maxResults)
}

// ── Tool factory ──────────────────────────────────────────────────

/**
 * Create a LangChain DynamicTool for web search.
 *
 * The tool name is `web_search` so that prompt instructions like
 * "use the web_search tool" match. The function receives the query
 * string and returns normalized search results.
 */
export function createSearchTool(config: SearchConfig): DynamicTool {
  const searchFn = (provider: SearchProvider) => {
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

  const search = searchFn(config.provider)

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
  // If no key needed (DDG), or already validated — skip? Actually always test.
  try {
    const tool = createSearchTool(config)
    // Run a quick test query — keep it very short
    const result = await tool.func('test')
    if (result.startsWith('Search error:')) {
      return { ok: false, error: result }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
