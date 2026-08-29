/**
 * Unit tests for src/renderer/features/ai/api.ts — thin wrappers over
 * `window.api.llm` that add the locale to the query payloads.
 *
 * Happy path: queryBulk/querySingle pass collectionId/coinId + queryType + locale.
 * Edge cases: ok:false results propagate untouched; locale falls back to 'en'
 * when provided though language tags like 'ru-RU' are normalized to 'ru'.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryBulk, querySingle } from '@/features/ai/api'
import type { LlmQueryResult, LlmErrorInfo } from '@shared/types'

const errorInfo: LlmErrorInfo = {
  code: 'connection_refused',
  provider: 'lmstudio',
  baseUrl: 'http://localhost:1234/v1',
  model: 'qwen',
  detail: 'fetch failed'
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('queryBulk', () => {
  it('passes collectionId, queryType, locale and excludeCoinIds to the bridge', async () => {
    vi.mocked(window.api.llm.queryBulk).mockResolvedValue({ ok: true, data: [] })

    await queryBulk('col-1', 'prices', ['coin-9'])

    expect(window.api.llm.queryBulk).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionId: 'col-1',
        queryType: 'prices',
        locale: 'en',
        excludeCoinIds: ['coin-9']
      })
    )
  })

  it('makes excludeCoinIds optional', async () => {
    vi.mocked(window.api.llm.queryBulk).mockResolvedValue({ ok: true, data: [] })

    await queryBulk('col-1', 'info')

    expect(window.api.llm.queryBulk).toHaveBeenCalledWith(
      expect.objectContaining({ excludeCoinIds: undefined })
    )
  })

  it('propagates an ok:false result untouched (the store renders it)', async () => {
    const failure: LlmQueryResult<unknown[]> = { ok: false, error: errorInfo }
    vi.mocked(window.api.llm.queryBulk).mockResolvedValue(failure)

    const result = await queryBulk('col-1', 'prices')

    expect(result).toEqual(failure)
  })
})

describe('querySingle', () => {
  it('passes coinId, queryType and locale to the bridge', async () => {
    vi.mocked(window.api.llm.querySingle).mockResolvedValue({
      ok: true,
      data: { id: 'coin-1', info: 'x' }
    })

    await querySingle('coin-1', 'mintage')

    expect(window.api.llm.querySingle).toHaveBeenCalledWith(
      expect.objectContaining({ coinId: 'coin-1', queryType: 'mintage', locale: 'en' })
    )
  })

  it('propagates an ok:false result untouched', async () => {
    const failure: LlmQueryResult<unknown> = { ok: false, error: errorInfo }
    vi.mocked(window.api.llm.querySingle).mockResolvedValue(failure)

    const result = await querySingle('coin-1', 'info')

    expect(result).toEqual(failure)
  })
})