/**
 * Unit tests for src/main/llm/errors.ts — error classification into
 * machine-readable codes used to render localized, actionable messages.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import { classifyLlmError, isFatalLlmError } from '../../src/main/llm/errors'
import type { LlmConfig } from '@shared/types'

const cfg: LlmConfig = {
  provider: 'lmstudio',
  model: 'qwen2.5',
  baseUrl: 'http://localhost:1234/v1',
  apiKey: 'lm-studio',
  enableWebSearch: false
}

describe('classifyLlmError', () => {
  it('detects connection refused from a cause code (ECONNREFUSED)', () => {
    const err = new Error('fetch failed')
    ;(err as Error & { cause: { code: string } }).cause = { code: 'ECONNREFUSED' }

    expect(classifyLlmError(err, cfg).code).toBe('connection_refused')
  })

  it('detects connection refused from the message text', () => {
    expect(classifyLlmError(new Error('connect ECONNREFUSED 127.0.0.1:1234'), cfg).code).toBe(
      'connection_refused'
    )
  })

  it('detects a generic APIConnectionError ("Connection error.")', () => {
    expect(classifyLlmError(new Error('Connection error.'), cfg).code).toBe('connection_refused')
  })

  it('detects host not found (ENOTFOUND)', () => {
    expect(classifyLlmError(new Error('getaddrinfo ENOTFOUND localhost'), cfg).code).toBe(
      'host_not_found'
    )
  })

  it('detects timeout (ETIMEDOUT)', () => {
    expect(classifyLlmError(new Error('connect ETIMEDOUT'), cfg).code).toBe('timeout')
  })

  it('detects HTTP 401 as auth error', () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 })
    expect(classifyLlmError(err, cfg).code).toBe('auth_error')
  })

  it('detects HTTP 404 as model_not_found', () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 })
    expect(classifyLlmError(err, cfg).code).toBe('model_not_found')
  })

  it('detects HTTP 429 as rate_limit', () => {
    const err = Object.assign(new Error('Too Many Requests'), { status: 429 })
    expect(classifyLlmError(err, cfg).code).toBe('rate_limit')
  })

  it('detects HTTP 5xx as server_error', () => {
    const err = Object.assign(new Error('Internal Server Error'), { status: 500 })
    expect(classifyLlmError(err, cfg).code).toBe('server_error')
  })

  it('detects invalid response (parse/schema failures)', () => {
    expect(
      classifyLlmError(new Error('LLM response does not match expected schema: foo'), cfg).code
    ).toBe('invalid_response')
  })

  it('detects empty response', () => {
    expect(
      classifyLlmError(new Error('Model returned empty response. It may be overloaded'), cfg).code
    ).toBe('empty_response')
  })

  it('falls back to unknown and carries provider context', () => {
    const info = classifyLlmError(new Error('something weird'), cfg)
    expect(info.code).toBe('unknown')
    expect(info.provider).toBe('lmstudio')
    expect(info.baseUrl).toBe('http://localhost:1234/v1')
  })
})

describe('isFatalLlmError', () => {
  it('treats network/auth errors as fatal', () => {
    expect(isFatalLlmError('connection_refused')).toBe(true)
    expect(isFatalLlmError('host_not_found')).toBe(true)
    expect(isFatalLlmError('timeout')).toBe(true)
    expect(isFatalLlmError('auth_error')).toBe(true)
    expect(isFatalLlmError('rate_limit')).toBe(true)
    expect(isFatalLlmError('server_error')).toBe(true)
  })

  it('treats per-coin content errors as non-fatal', () => {
    expect(isFatalLlmError('empty_response')).toBe(false)
    expect(isFatalLlmError('invalid_response')).toBe(false)
    expect(isFatalLlmError('unknown')).toBe(false)
  })
})
