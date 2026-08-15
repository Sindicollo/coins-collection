/**
 * Unit tests for src/main/llm/search.ts — provider fetch helpers, result
 * normalization, DynamicTool error wrapping and the connectivity test.
 *
 * net.fetch (Electron) is mocked; Response is a Node global here.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { net } from 'electron'
import type { SearchConfig } from '@shared/types'
import { createSearchTool, testSearchProvider } from '../../src/main/llm/search'

vi.mock('electron', () => ({
  net: { fetch: vi.fn() }
}))

const mockFetch = vi.mocked(net.fetch)

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function htmlResponse(status = 403): Response {
  return new Response('<html><body><h1>403 Forbidden</h1></body></html>', {
    status,
    headers: { 'content-type': 'text/html' }
  })
}

function makeConfig(overrides: Partial<SearchConfig> = {}): SearchConfig {
  return {
    provider: 'tavily',
    apiKeys: { tavily: 'tvly-test', brave: 'BSA-test' },
    baseUrl: 'http://localhost:8080/',
    maxResults: 5,
    ...overrides
  }
}

async function runSearch(config: SearchConfig, query = '1889 silver crown'): Promise<string> {
  const tool = createSearchTool(config)
  return tool.invoke(query)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockReset()
})

describe('tavilySearch (via createSearchTool)', () => {
  it('normalizes results into [SEARCH]-prefixed lines', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        results: [
          { title: 'Coin 1875', content: 'Silver crown, sold 150$', url: 'https://x.com/1' },
          { title: 'KM# 190', content: 'Silver 0.900', url: 'https://x.com/2' }
        ]
      })
    )

    const out = await runSearch(makeConfig())

    expect(out).toBe(
      '[SEARCH] Coin 1875 — Silver crown, sold 150$ (https://x.com/1)\n\n' +
        '[SEARCH] KM# 190 — Silver 0.900 (https://x.com/2)'
    )
  })

  it('sends the per-provider API key and the query in the request body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [] }))

    await runSearch(makeConfig(), 'test query')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tvly-test' }),
        body: JSON.stringify({ query: 'test query', max_results: 5, search_depth: 'basic' })
      })
    )
  })

  it('truncates long snippets to 500 chars', async () => {
    const long = 'x'.repeat(600)
    mockFetch.mockResolvedValue(jsonResponse({ results: [{ title: 'T', content: long, url: '' }] }))

    const out = await runSearch(makeConfig())

    // The [SEARCH] <title> — prefix is kept; the snippet body itself is capped at 500 chars
    const body = out.replace(/^\[SEARCH\] T — /, '')
    expect(body).toHaveLength(500)
    expect(body).toMatch(/\.\.\.$/)
  })

  it('appends a [SEARCH NOTE] when more results than maxResults exist', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        results: [
          { title: 'A', content: 'a' },
          { title: 'B', content: 'b' },
          { title: 'C', content: 'c' }
        ]
      })
    )

    const out = await runSearch(makeConfig({ maxResults: 2 }))

    expect(out).toContain('[SEARCH NOTE] (showing 2 of 3 results)')
    expect(out).not.toContain('[SEARCH] C')
  })

  it('returns an empty string when there are no results', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [] }))

    const out = await runSearch(makeConfig())

    expect(out).toBe('')
  })

  it('detects a plain-HTML 403 as geo-blocking', async () => {
    mockFetch.mockResolvedValue(htmlResponse(403))

    const out = await runSearch(makeConfig())

    expect(out).toContain('Tavily search failed (403): request blocked at the network edge')
    expect(out).toContain('Try a different query or tell the user the search is unavailable.')
  })

  it('keeps the JSON body for non-HTML API errors (401/429)', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ detail: { error: 'Unauthorized' } }, 401))

    const out = await runSearch(makeConfig())

    expect(out).toContain('Tavily search failed (401)')
    expect(out).toContain('Unauthorized')
  })
})

describe('braveSearch', () => {
  it('strips inline HTML tags from descriptions', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        web: {
          results: [
            {
              title: '1889 Crown',
              description: '<strong>1889</strong> Silver <em>British</em> Crown',
              url: 'https://b.com/c'
            }
          ]
        }
      })
    )

    const out = await runSearch(makeConfig({ provider: 'brave' }))

    expect(out).toContain('1889 Silver British Crown')
    expect(out).not.toContain('<')
  })

  it('sends the X-Subscription-Token header for the brave key', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ web: { results: [] } }))

    await runSearch(makeConfig({ provider: 'brave' }))

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/web/search?q=1889%20silver%20crown&count=5')
    expect((init.headers as Record<string, string>)['X-Subscription-Token']).toBe('BSA-test')
  })

  it('reports non-OK statuses with the API error body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'SUBSCRIPTION_TOKEN_INVALID' }, 422))

    const out = await runSearch(makeConfig({ provider: 'brave' }))

    expect(out).toContain('Brave search failed (422)')
    expect(out).toContain('SUBSCRIPTION_TOKEN_INVALID')
  })
})

describe('ddgSearch', () => {
  const ddgHtml =
    '<html><body><a href="https://e.com/c">1889 British Crown</a><span>Silver 0.925, XF</span>' +
    '<a href="https://e.com/d">1875 1 Dinero</a><span>Peru, YJ mint</span></body></html>'

  it('parses lite HTML results into [SEARCH] lines', async () => {
    mockFetch.mockResolvedValue(new Response(ddgHtml, { status: 200 }))

    const out = await runSearch(makeConfig({ provider: 'ddg' }))

    expect(out).toContain('[SEARCH] 1889 British Crown — Silver 0.925, XF (https://e.com/c)')
    expect(out).toContain('[SEARCH] 1875 1 Dinero — Peru, YJ mint (https://e.com/d)')
  })

  it('respects maxResults when parsing', async () => {
    mockFetch.mockResolvedValue(new Response(ddgHtml, { status: 200 }))

    const out = await runSearch(makeConfig({ provider: 'ddg', maxResults: 1 }))

    expect(out).toContain('1889 British Crown')
    expect(out).not.toContain('1875 1 Dinero')
  })

  it('returns a friendly no-results message instead of throwing when the page has no links', async () => {
    mockFetch.mockResolvedValue(new Response('<html><body>no results</body></html>', { status: 200 }))

    const out = await runSearch(makeConfig({ provider: 'ddg' }), 'zzz')

    expect(out).toContain('No results found for query: "zzz"')
    expect(out).toContain('rate-limiting')
  })

  it('throws on non-OK responses', async () => {
    mockFetch.mockResolvedValue(new Response('ratelimited', { status: 429 }))

    const out = await runSearch(makeConfig({ provider: 'ddg' }))

    expect(out).toContain('DuckDuckGo search failed (429)')
  })
})

describe('searxngSearch', () => {
  it('strips a trailing slash from the base URL when building the query URL', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [] }))

    await runSearch(makeConfig({ provider: 'searxng' }), 'peru')

    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toBe('http://localhost:8080/search?q=peru&format=json&categories=general')
  })

  it('normalizes JSON results', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ results: [{ title: 'Peru 1875', content: 'KM# 190', url: 'https://s.com/1' }] })
    )

    const out = await runSearch(makeConfig({ provider: 'searxng' }), 'peru')

    expect(out).toContain('[SEARCH] Peru 1875 — KM# 190 (https://s.com/1)')
  })

  it('reports non-OK statuses with the response body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'internal' }, 500))

    const out = await runSearch(makeConfig({ provider: 'searxng' }))

    expect(out).toContain('SearXNG search failed (500)')
  })
})

describe('createSearchTool', () => {
  it('is named web_search with a search-oriented description', () => {
    const tool = createSearchTool(makeConfig())

    expect(tool.name).toBe('web_search')
    expect(tool.description).toContain('Search the internet')
  })

  it('wraps any thrown provider error into a Search error string', async () => {
    mockFetch.mockRejectedValue(new Error('network down'))

    const out = await runSearch(makeConfig())

    expect(out).toBe(
      'Search error: network down. Try a different query or tell the user the search is unavailable.'
    )
  })

  it('rejects unsupported providers at construction time', () => {
    expect(() => createSearchTool(makeConfig({ provider: 'none' }))).toThrow(
      'Unsupported search provider'
    )
  })
})

describe('testSearchProvider', () => {
  it('returns ok:true when the provider responds', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [] }))

    const result = await testSearchProvider(makeConfig())

    expect(result).toEqual({ ok: true })
  })

  it('returns ok:false with the error message on failure', async () => {
    mockFetch.mockResolvedValue(htmlResponse(403))

    const result = await testSearchProvider(makeConfig())

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Tavily search failed (403)')
  })

  it('returns ok:false for an unsupported provider', async () => {
    const result = await testSearchProvider(makeConfig({ provider: 'none' }))

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Unsupported search provider')
  })
})
