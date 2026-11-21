/**
 * Unit tests for src/main/llm/unsloth.ts — Unsloth Studio key provisioning.
 *
 * The Studio server is stubbed at the `fetch` boundary; the filesystem is
 * stubbed so tests never depend on a real Unsloth install.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}))

import { existsSync, readFileSync } from 'fs'
import {
  DEFAULT_UNSLOTH_BASE_URL,
  connectUnslothStudio,
  readDesktopSecret,
  studioRootFromBaseUrl
} from '../../src/main/llm/unsloth'

const SECRET = 'desktop-2rHrmUgEa2L1w0ExDB7Yx2D57bYOt0YraKPu0kWyaAiwtSLL4NrU9Jd_OXntopGm'
const API_KEY = 'sk-unsloth-test-key'

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload)
  } as unknown as Response
}

/** Route a URL to a stubbed response. */
function stubFetch(routes: Array<{ match: (url: string) => boolean; respond: () => Response | Promise<Response> }>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request) => {
      const target = String(url)
      const route = routes.find((r) => r.match(target))
      if (!route) throw new Error(`Unexpected fetch: ${target}`)
      return route.respond()
    })
  )
}

const modelsPayload = {
  object: 'list',
  data: [
    { id: 'unsloth/Qwen3-27B-GGUF', loaded: true },
    { id: 'ollama/qwen3.5:27b', loaded: false }
  ]
}

beforeEach(() => {
  vi.mocked(existsSync).mockReturnValue(false)
  vi.mocked(readFileSync).mockReturnValue('')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('readDesktopSecret', () => {
  it('returns the trimmed desktop credential', () => {
    vi.mocked(existsSync).mockImplementation((p) => String(p).endsWith('/auth/.desktop_secret'))
    vi.mocked(readFileSync).mockReturnValue(`${SECRET}\n`)

    expect(readDesktopSecret()).toBe(SECRET)
  })

  it('ignores files that do not look like a desktop credential', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue('not-a-secret')

    expect(readDesktopSecret()).toBeNull()
  })

  it('returns null when the install is absent or unreadable', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(readDesktopSecret()).toBeNull()

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('EACCES')
    })
    expect(readDesktopSecret()).toBeNull()
  })
})

describe('studioRootFromBaseUrl', () => {
  it('strips the OpenAI-compatible /v1 suffix and trailing slashes', () => {
    expect(studioRootFromBaseUrl('http://127.0.0.1:8888/v1')).toBe('http://127.0.0.1:8888')
    expect(studioRootFromBaseUrl('http://127.0.0.1:8888/v1/')).toBe('http://127.0.0.1:8888')
    expect(studioRootFromBaseUrl('http://localhost:9000')).toBe('http://localhost:9000')
  })

  it('falls back to the default Studio root', () => {
    expect(studioRootFromBaseUrl(undefined)).toBe('http://127.0.0.1:8888')
    expect(studioRootFromBaseUrl('')).toBe('http://127.0.0.1:8888')
  })
})

describe('connectUnslothStudio', () => {
  it('reuses a working stored key without minting a new one', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, modelsPayload))
    vi.stubGlobal('fetch', fetchMock)

    const result = await connectUnslothStudio({
      baseUrl: DEFAULT_UNSLOTH_BASE_URL,
      existingApiKey: API_KEY
    })

    expect(result).toEqual({
      ok: true,
      apiKey: API_KEY,
      baseUrl: 'http://127.0.0.1:8888/v1',
      models: [
        { id: 'unsloth/Qwen3-27B-GGUF', loaded: true },
        { id: 'ollama/qwen3.5:27b', loaded: false }
      ]
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://127.0.0.1:8888/v1/models')
  })

  it('mints an inference key from the desktop credential and lists models', async () => {
    vi.mocked(existsSync).mockImplementation((p) => String(p).endsWith('/auth/.desktop_secret'))
    vi.mocked(readFileSync).mockReturnValue(SECRET)

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url)
      if (target.endsWith('/api/auth/desktop-login')) {
        expect(JSON.parse(String(init?.body))).toEqual({ secret: SECRET })
        return jsonResponse(200, { access_token: 'owner-token' })
      }
      if (target.endsWith('/api/auth/api-keys')) {
        expect(init?.headers).toEqual(
          expect.objectContaining({ Authorization: 'Bearer owner-token' })
        )
        expect(JSON.parse(String(init?.body))).toEqual({
          name: 'Coin Collection',
          access: 'inference'
        })
        return jsonResponse(200, { key: API_KEY, api_key: { id: 1 } })
      }
      if (target.endsWith('/v1/models')) {
        expect(init?.headers).toEqual(expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }))
        return jsonResponse(200, modelsPayload)
      }
      throw new Error(`Unexpected fetch: ${target}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await connectUnslothStudio({})

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.apiKey).toBe(API_KEY)
      expect(result.baseUrl).toBe('http://127.0.0.1:8888/v1')
      expect(result.models).toHaveLength(2)
    }
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('reports not_installed when no desktop credential exists', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await connectUnslothStudio({})

    expect(result).toEqual({ ok: false, code: 'not_installed' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports not_running when nothing answers on the base URL', async () => {
    vi.mocked(existsSync).mockImplementation((p) => String(p).endsWith('/auth/.desktop_secret'))
    vi.mocked(readFileSync).mockReturnValue(SECRET)
    stubFetch([
      {
        match: (url) => url.endsWith('/api/auth/desktop-login'),
        respond: () => {
          throw new TypeError('fetch failed')
        }
      }
    ])

    const result = await connectUnslothStudio({})

    expect(result).toEqual(expect.objectContaining({ ok: false, code: 'not_running' }))
  })

  it('reports auth_failed when Studio rejects the credential', async () => {
    vi.mocked(existsSync).mockImplementation((p) => String(p).endsWith('/auth/.desktop_secret'))
    vi.mocked(readFileSync).mockReturnValue(SECRET)
    stubFetch([
      {
        match: (url) => url.endsWith('/api/auth/desktop-login'),
        respond: () => jsonResponse(401, { detail: 'Desktop authentication failed' })
      }
    ])

    const result = await connectUnslothStudio({})

    expect(result).toEqual(expect.objectContaining({ ok: false, code: 'auth_failed' }))
  })

  it('reports key_create_failed when Studio returns no key', async () => {
    vi.mocked(existsSync).mockImplementation((p) => String(p).endsWith('/auth/.desktop_secret'))
    vi.mocked(readFileSync).mockReturnValue(SECRET)
    stubFetch([
      {
        match: (url) => url.endsWith('/api/auth/desktop-login'),
        respond: () => jsonResponse(200, { access_token: 'owner-token' })
      },
      {
        match: (url) => url.endsWith('/api/auth/api-keys'),
        respond: () => jsonResponse(200, { api_key: { id: 1 } })
      }
    ])

    const result = await connectUnslothStudio({})

    expect(result).toEqual(expect.objectContaining({ ok: false, code: 'key_create_failed' }))
  })

  it('still succeeds with an empty model list when /v1/models fails', async () => {
    vi.mocked(existsSync).mockImplementation((p) => String(p).endsWith('/auth/.desktop_secret'))
    vi.mocked(readFileSync).mockReturnValue(SECRET)
    stubFetch([
      {
        match: (url) => url.endsWith('/api/auth/desktop-login'),
        respond: () => jsonResponse(200, { access_token: 'owner-token' })
      },
      {
        match: (url) => url.endsWith('/api/auth/api-keys'),
        respond: () => jsonResponse(200, { key: API_KEY })
      },
      { match: (url) => url.endsWith('/v1/models'), respond: () => jsonResponse(500, {}) }
    ])

    const result = await connectUnslothStudio({})

    expect(result).toEqual({
      ok: true,
      apiKey: API_KEY,
      baseUrl: 'http://127.0.0.1:8888/v1',
      models: []
    })
  })
})
