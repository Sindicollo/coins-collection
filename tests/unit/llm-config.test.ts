/**
 * Unit tests for src/main/llm/config.ts — search config load/save, legacy key
 * migration and the bulk session (resume) lifecycle.
 *
 * The preferences repository is mocked with an in-memory map that mimics the
 * real table semantics (setting '' clears the key).
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPreference, setPreference } from '../../src/main/database/repositories/preferences'
import {
  loadLlmConfig,
  saveLlmConfig,
  loadBulkSession,
  saveBulkSession,
  clearBulkSession
} from '../../src/main/llm/config'
import type { BulkSessionState } from '@shared/types'

vi.mock('../../src/main/database/repositories/preferences', () => ({
  getPreference: vi.fn(),
  setPreference: vi.fn()
}))

const store = new Map<string, string>()

beforeEach(() => {
  vi.clearAllMocks()
  store.clear()

  vi.mocked(getPreference).mockImplementation((key: string) => store.get(key))
  vi.mocked(setPreference).mockImplementation((key: string, value: string) => {
    // Real table stores the value as-is (INSERT OR REPLACE); consumers treat '' as absent
    store.set(key, value)
  })

  // Neutralize env-based config so tests only exercise the DB layer
  delete process.env.LLM_PROVIDER
  delete process.env.LLM_MODEL
  delete process.env.LLM_BASE_URL
  delete process.env.LLM_API_KEY
  delete process.env.LLM_WEB_SEARCH
})

describe('loadSearchConfig', () => {
  it('returns DEFAULT_SEARCH_CONFIG when nothing is stored', () => {
    const search = loadLlmConfig().search!

    expect(search).toEqual({ provider: 'ddg', apiKeys: {}, baseUrl: '', maxResults: 5 })
  })

  it('reads stored provider, keys, baseUrl and maxResults', () => {
    store.set('llm.search.provider', 'brave')
    store.set('llm.search.apiKeys', JSON.stringify({ brave: 'BSA-1', tavily: 'tvly-1' }))
    store.set('llm.search.baseUrl', 'https://searx.example')
    store.set('llm.search.maxResults', '7')

    const search = loadLlmConfig().search!

    expect(search).toEqual({
      provider: 'brave',
      apiKeys: { brave: 'BSA-1', tavily: 'tvly-1' },
      baseUrl: 'https://searx.example',
      maxResults: 7
    })
  })

  it('falls back to defaults for malformed apiKeys JSON', () => {
    store.set('llm.search.apiKeys', '{not-json')

    const search = loadLlmConfig().search!

    expect(search.apiKeys).toEqual({})
  })
})

describe('legacy search key migration', () => {
  it('migrates llm.search.apiKey into the per-provider map of the stored provider', () => {
    store.set('llm.search.provider', 'tavily')
    store.set('llm.search.apiKey', 'tvly-legacy')

    const search = loadLlmConfig().search!

    expect(search.apiKeys.tavily).toBe('tvly-legacy')
    // The migrated value is persisted and the legacy key is cleared (stored as '')
    expect(store.get('llm.search.apiKeys')).toBe(JSON.stringify({ tavily: 'tvly-legacy' }))
    expect(getPreference('llm.search.apiKey')).toBeFalsy()
  })

  it('does not overwrite an existing per-provider key with a legacy key', () => {
    store.set('llm.search.provider', 'tavily')
    store.set('llm.search.apiKeys', JSON.stringify({ tavily: 'tvly-new' }))
    store.set('llm.search.apiKey', 'tvly-legacy')

    const search = loadLlmConfig().search!

    expect(search.apiKeys.tavily).toBe('tvly-new')
    expect(store.get('llm.search.apiKeys')).toBe(JSON.stringify({ tavily: 'tvly-new' }))
  })
})

describe('saveLlmConfig', () => {
  it('round-trips a search config through save + load', () => {
    saveLlmConfig({
      provider: 'lmstudio',
      model: 'qwen2.5',
      baseUrl: 'http://localhost:1234/v1',
      apiKey: 'sk-abc',
      enableWebSearch: true,
      search: { provider: 'brave', apiKeys: { brave: 'BSA-x' }, baseUrl: '', maxResults: 7 }
    })

    const cfg = loadLlmConfig()

    expect(cfg.provider).toBe('lmstudio')
    expect(cfg.model).toBe('qwen2.5')
    expect(cfg.enableWebSearch).toBe(true)
    expect(cfg.search).toEqual({ provider: 'brave', apiKeys: { brave: 'BSA-x' }, baseUrl: '', maxResults: 7 })
  })

  it('persists an empty apiKey (allows clearing it)', () => {
    saveLlmConfig({
      provider: 'openrouter',
      model: 'x',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: '',
      enableWebSearch: false
    })

    expect(store.get('llm.apiKey')).toBe('')
  })

  it('does not touch search preferences when config.search is undefined', () => {
    saveLlmConfig({
      provider: 'openrouter',
      model: 'x',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: '',
      enableWebSearch: false
    })

    expect([...store.keys()].some((k) => k.startsWith('llm.search.'))).toBe(false)
  })
})

describe('bulk session (resume)', () => {
  const state: BulkSessionState = {
    collectionId: 'col-1',
    queryType: 'info',
    processedCoinIds: ['c1', 'c2'],
    startedAt: Date.now()
  }

  it('returns null when no session is stored', () => {
    expect(loadBulkSession('col-1', 'info')).toBeNull()
  })

  it('saves and loads a session for the same collection+queryType', () => {
    saveBulkSession(state)

    expect(loadBulkSession('col-1', 'info')).toEqual(state)
  })

  it('scopes sessions per collection+queryType', () => {
    saveBulkSession(state)

    expect(loadBulkSession('col-1', 'prices')).toBeNull()
    expect(loadBulkSession('col-2', 'info')).toBeNull()
  })

  it('clears and ignores stale sessions (older than 24h)', () => {
    const key = 'llm.bulkSession.col-1.info'
    store.set(key, JSON.stringify({ ...state, startedAt: Date.now() - 25 * 60 * 60 * 1000 }))

    expect(loadBulkSession('col-1', 'info')).toBeNull()
    expect(getPreference(key)).toBeFalsy() // cleared to ''
  })

  it('clears and ignores corrupt JSON', () => {
    const key = 'llm.bulkSession.col-1.info'
    store.set(key, '{corrupt')

    expect(loadBulkSession('col-1', 'info')).toBeNull()
    expect(getPreference(key)).toBeFalsy() // cleared to ''
  })

  it('clears the session on demand', () => {
    saveBulkSession(state)
    clearBulkSession('col-1', 'info')

    expect(loadBulkSession('col-1', 'info')).toBeNull()
  })
})
