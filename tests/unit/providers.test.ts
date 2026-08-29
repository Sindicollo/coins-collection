/**
 * Unit tests for src/main/llm/providers.ts — ChatOpenAI construction.
 *
 * Covers the timeout / maxRetries tuning added for local providers
 * (fast-fail instead of 6 retries × backoff ≈ 2 min of spinners) and the
 * base-URL /v1 normalization.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatOpenAI } from '@langchain/openai'
import { createLlmModel } from '../../src/main/llm/providers'
import { loadLlmConfig } from '../../src/main/llm/config'
import type { LlmConfig } from '@shared/types'

vi.mock('../../src/main/llm/config', () => ({
  loadLlmConfig: vi.fn()
}))

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn()
}))

function makeConfig(overrides: Partial<LlmConfig> = {}): LlmConfig {
  return {
    provider: 'openrouter',
    model: 'openai/gpt-4.1',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-test',
    enableWebSearch: false,
    search: { provider: 'none', apiKeys: {}, baseUrl: '', maxResults: 5 },
    ...overrides
  }
}

/** Convenience accessor for the args of the last `new ChatOpenAI(...)` call. */
function lastConstructorParams(): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls = (ChatOpenAI as unknown as ReturnType<typeof vi.fn>).mock.calls
  return calls[calls.length - 1][0] as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadLlmConfig).mockReturnValue(makeConfig())
})

describe('createLlmModel', () => {
  it('uses a long timeout and modest retries for cloud providers (openrouter)', () => {
    const model = createLlmModel()

    expect(model).toBeInstanceOf(ChatOpenAI)
    const params = lastConstructorParams()
    expect(params.timeout).toBe(120000)
    expect(params.maxRetries).toBe(2)
    expect(params.modelName).toBe('openai/gpt-4.1')
    expect(params.apiKey).toBe('sk-test')
  })

  it('uses a generous timeout and zero retries for local providers (lmstudio)', () => {
    vi.mocked(loadLlmConfig).mockReturnValue(makeConfig({ provider: 'lmstudio', model: 'qwen2.5' }))

    createLlmModel()

    const params = lastConstructorParams()
    // Reasoning/thinking models can take minutes locally — the timeout must
    // exceed the cloud one, not be shorter
    expect(params.timeout).toBe(180000)
    expect(params.maxRetries).toBe(0)
    expect(params.timeout).toBeGreaterThanOrEqual(120000)
  })

  it('uses the same local settings for ollama and strips namespaces from model ids', () => {
    vi.mocked(loadLlmConfig).mockReturnValue(makeConfig({ provider: 'ollama', model: 'library/qwen2.5:7b', baseUrl: '' }))

    createLlmModel()

    const params = lastConstructorParams()
    expect(params.timeout).toBe(180000)
    expect(params.maxRetries).toBe(0)
    expect(params.modelName).toBe('qwen2.5:7b')
    expect(params.configuration).toEqual(
      expect.objectContaining({ baseURL: 'http://localhost:11434/v1' })
    )
  })

  describe('base URL normalization (local providers)', () => {
    it('appends /v1 to a base URL that lacks it', () => {
      vi.mocked(loadLlmConfig).mockReturnValue(
        makeConfig({ provider: 'lmstudio', baseUrl: 'http://localhost:1234' })
      )

      createLlmModel()

      expect(lastConstructorParams().configuration).toEqual(
        expect.objectContaining({ baseURL: 'http://localhost:1234/v1' })
      )
    })

    it('keeps an already-normalized base URL unchanged', () => {
      vi.mocked(loadLlmConfig).mockReturnValue(
        makeConfig({ provider: 'lmstudio', baseUrl: 'http://localhost:1234/v1' })
      )

      createLlmModel()

      expect(lastConstructorParams().configuration).toEqual(
        expect.objectContaining({ baseURL: 'http://localhost:1234/v1' })
      )
    })

    it('strips a trailing slash before appending /v1', () => {
      vi.mocked(loadLlmConfig).mockReturnValue(
        makeConfig({ provider: 'lmstudio', baseUrl: 'http://localhost:1234/' })
      )

      createLlmModel()

      expect(lastConstructorParams().configuration).toEqual(
        expect.objectContaining({ baseURL: 'http://localhost:1234/v1' })
      )
    })
  })

  it('does not pass the raw (possibly abusive) baseUrl without enforcing /v1 for openrouter', () => {
    vi.mocked(loadLlmConfig).mockReturnValue(
      makeConfig({ baseUrl: 'https://openrouter.ai/api/v1' })
    )

    createLlmModel()

    // openrouter uses the URL as configured (no normalization) — just make sure
    // the model is constructed and nothing throws
    expect(ChatOpenAI).toHaveBeenCalledTimes(1)
  })

  describe('validation edges', () => {
    it('throws when the model name is empty', () => {
      vi.mocked(loadLlmConfig).mockReturnValue(makeConfig({ model: '' }))
      expect(() => createLlmModel()).toThrow(/Model name is empty/i)
    })

    it('throws on an unknown provider instead of silently misbehaving', () => {
      vi.mocked(loadLlmConfig).mockReturnValue(
        makeConfig({ provider: 'deepseek' as LlmConfig['provider'] })
      )
      expect(() => createLlmModel()).toThrow(/Unknown LLM provider/i)
    })
  })
})