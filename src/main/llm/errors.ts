import type { LlmConfig, LlmErrorCode, LlmErrorInfo } from '@shared/types'

/**
 * Classify a raw LLM error into a machine-readable code + context, so the
 * renderer can display a localized, actionable message instead of a raw
 * `connect ECONNREFUSED` string.
 *
 * The classifier inspects, in order:
 *   1. HTTP status (`err.status` / `err.statusCode`) — auth / not-found / rate-limit / 5xx
 *   2. Network codes in `err.cause.code` / `err.code` / `err.message` — connection refused,
 *      host not found, timeout (LangChain's ChatOpenAI wraps Node fetch failures this way)
 *   3. Message patterns for parse/empty-response failures thrown by our own chains.ts
 */
export function classifyLlmError(err: unknown, cfg: LlmConfig): LlmErrorInfo {
  const detail = toDetail(err)
  const message = detail.toLowerCase()
  const status = extractStatus(err)

  const base: LlmErrorInfo = {
    code: 'unknown',
    provider: cfg.provider,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    detail
  }

  if (status !== undefined) {
    if (status === 401 || status === 403) return { ...base, code: 'auth_error', status }
    if (status === 404) return { ...base, code: 'model_not_found', status }
    if (status === 429) return { ...base, code: 'rate_limit', status }
    if (status >= 500) return { ...base, code: 'server_error', status }
  }

  // Aggregate all machine-readable error indicators (cause chain + code + message)
  const indicators = collectIndicators(err).toLowerCase()

  if (/econnrefused|connection refused|connection error|fetch failed|connect econnrefused/.test(indicators)) {
    return { ...base, code: 'connection_refused' }
  }
  if (/enotfound|getaddrinfo|eai_again/.test(indicators)) {
    return { ...base, code: 'host_not_found' }
  }
  if (/etimedout|timed? ?out|request timed out|abort/.test(indicators)) {
    return { ...base, code: 'timeout' }
  }
  if (/401|403/.test(message) && /unauthorized|forbidden/.test(message)) {
    return { ...base, code: 'auth_error' }
  }
  if (/rate ?limit|429/.test(message)) {
    return { ...base, code: 'rate_limit' }
  }

  // Parse/response failures thrown by chains.ts
  if (/returned empty response|overloaded|unavailable/.test(message)) {
    return { ...base, code: 'empty_response' }
  }
  if (/no json|does not match expected schema|failed to parse llm response|must be a json array/.test(message)) {
    return { ...base, code: 'invalid_response' }
  }

  return base
}

/** True when the error should abort a bulk query (vs skip a single coin). */
export function isFatalLlmError(code: LlmErrorCode): boolean {
  switch (code) {
    case 'connection_refused':
    case 'host_not_found':
    case 'timeout':
    case 'auth_error':
    case 'model_not_found':
    case 'rate_limit':
    case 'server_error':
      return true
    case 'empty_response':
    case 'invalid_response':
    case 'unknown':
      return false
  }
}

function toDetail(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

function extractStatus(err: unknown): number | undefined {
  if (err == null || typeof err !== 'object') return undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = err as any
  const status = anyErr.status ?? anyErr.statusCode
  if (typeof status === 'number') return status
  return undefined
}

function collectIndicators(err: unknown): string {
  const parts: string[] = []
  let current: unknown = err
  // Walk the cause chain (Node wraps fetch errors in `cause`)
  for (let depth = 0; current != null && depth < 5; depth++) {
    if (typeof current === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj = current as any
      if (typeof obj.code === 'string') parts.push(obj.code)
      if (typeof obj.message === 'string') parts.push(obj.message)
      current = obj.cause
    } else {
      parts.push(String(current))
      current = null
    }
  }
  return parts.join(' ')
}
