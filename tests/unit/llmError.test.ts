/**
 * Unit tests for src/renderer/lib/llmError.ts — mapping a structured
 * `LlmErrorInfo` (produced by the main process `classifyLlmError`) to a
 * friendly, localized, actionable message.
 *
 * Happy path: every error code maps to its dedicated message.
 * Edge cases: unknown code fallback, missing status on server_error,
 * null/undefined input.
 */

import { describe, it, expect } from 'vitest'
import { formatLlmError } from '@/lib/llmError'
import type { LlmErrorInfo } from '@shared/types'

function makeInfo(overrides: Partial<LlmErrorInfo> = {}): LlmErrorInfo {
  return {
    code: 'unknown',
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4.1',
    ...overrides
  }
}

describe('formatLlmError', () => {
  it('returns an empty string for null/undefined input', () => {
    expect(formatLlmError(null)).toBe('')
    expect(formatLlmError(undefined)).toBe('')
  })

  describe('connection_refused', () => {
    it('gives LM Studio specific guidance for the lmstudio provider', () => {
      const msg = formatLlmError(makeInfo({ code: 'connection_refused', provider: 'lmstudio', baseUrl: 'http://localhost:1234/v1' }))
      expect(msg).toMatch(/Cannot connect to LM Studio/)
      expect(msg).toContain('http://localhost:1234/v1')
    })

    it('gives Ollama specific guidance for the ollama provider', () => {
      const msg = formatLlmError(makeInfo({ code: 'connection_refused', provider: 'ollama', baseUrl: 'http://localhost:11434/v1' }))
      expect(msg).toMatch(/Cannot connect to Ollama/)
      expect(msg).toContain('http://localhost:11434/v1')
    })

    it('falls back to a generic message for cloud providers', () => {
      const msg = formatLlmError(makeInfo({ code: 'connection_refused', provider: 'openrouter' }))
      expect(msg).toMatch(/Cannot connect to the AI service/)
    })
  })

  it('includes the base URL for host_not_found', () => {
    const msg = formatLlmError(makeInfo({ code: 'host_not_found', baseUrl: 'http://localhost:1234/v1' }))
    expect(msg).toMatch(/Server not found/)
    expect(msg).toContain('http://localhost:1234/v1')
  })

  it('maps a timeout to a retry hint', () => {
    expect(formatLlmError(makeInfo({ code: 'timeout' }))).toMatch(/did not respond in time/i)
  })

  it('maps auth errors to an API-key hint', () => {
    expect(formatLlmError(makeInfo({ code: 'auth_error' }))).toMatch(/Authentication failed/i)
  })

  it('names the model for model_not_found', () => {
    const msg = formatLlmError(makeInfo({ code: 'model_not_found', model: 'qwen2.5:7b' }))
    expect(msg).toMatch(/Model not found/)
    expect(msg).toContain('qwen2.5:7b')
  })

  it('maps rate_limit to a wait hint', () => {
    expect(formatLlmError(makeInfo({ code: 'rate_limit' }))).toMatch(/Rate limit exceeded/i)
  })

  describe('server_error', () => {
    it('surfaces the HTTP status when present', () => {
      const msg = formatLlmError(makeInfo({ code: 'server_error', status: 503 }))
      expect(msg).toMatch(/HTTP 503/)
    })

    it('falls back to 5xx when the status is missing', () => {
      const msg = formatLlmError(makeInfo({ code: 'server_error' }))
      expect(msg).toMatch(/HTTP 5xx/)
    })
  })

  it('maps empty_response to a model-switch hint', () => {
    expect(formatLlmError(makeInfo({ code: 'empty_response' }))).toMatch(/empty response/i)
  })

  it('maps invalid_response to a retry hint', () => {
    expect(formatLlmError(makeInfo({ code: 'invalid_response' }))).toMatch(/invalid response/i)
  })

  describe('unknown', () => {
    it('shows the raw detail for debugging when present', () => {
      const msg = formatLlmError(makeInfo({ code: 'unknown', detail: 'ENOTFOUND api.example.com' }))
      expect(msg).toMatch(/AI request failed/)
      expect(msg).toContain('ENOTFOUND api.example.com')
    })

    it('uses a short fallback when there is no detail', () => {
      expect(formatLlmError(makeInfo({ code: 'unknown' }))).toMatch(/AI request failed/i)
    })

    it('treats any unrecognized code as unknown', () => {
      const msg = formatLlmError(makeInfo({ code: 'unknown' as LlmErrorInfo['code'], detail: 'weird' }))
      expect(msg).toContain('weird')
    })
  })
})