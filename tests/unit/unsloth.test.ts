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

import { readFileSync } from 'fs'
import { DEFAULT_UNSLOTH_BASE_URL } from '@shared/types'
import {
  connectUnslothStudio,
  isLoopbackBaseUrl,
  readDesktopSecret,
  studioRootFromBaseUrl
} from '../../src/main/llm/unsloth'

const SECRET = 'desktop-2rHrmUgEa2L1w0ExDB7Yx2D57bYOt0YraKPu0kWyaAiwtSLL4NrU9Jd_OXntopGm'
const SECRET_FILE = '/auth/.desktop_secret'
const RUN_STATE_FILE = '/run/desktop_backend.json'
const API_KEY = 'sk-unsloth-test-key'

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload)
  } as unknown as Response
}

/** Serve Studio files by path suffix; anything else behaves like ENOENT. */
function mockStudioFiles(files: Record<string, string>): void {
  vi.mocked(readFileSync).mockImplementation(((filePath: Parameters<typeof readFileSync>[0]) => {
    const target = String(filePath)
    const suffix = Object.keys(files).find((key) => target.endsWith(key))
    if (suffix === undefined) {
      const err = new Error(`ENOENT: no such file or directory, open '${target}'`)
      ;(err as NodeJS.ErrnoException).code = 'ENOENT'
      throw err
    }
    return files[suffix]
  }) as typeof readFileSync)
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
  mockStudioFiles({})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('readDesktopSecret', () => {
  it('returns the trimmed desktop credential', () => {
    mockStudioFiles({ [SECRET_FILE]: `${SECRET}\n` })

    expect(readDesktopSecret()).toBe(SECRET)
  })

  it('ignores files that do not look like a desktop credential', () => {
    mockStudioFiles({ [SECRET_FILE]: 'not-a-secret' })

    expect(readDesktopSecret()).toBeNull()
  })

  it('returns null when the install is absent or unreadable', () => {
    mockStudioFiles({})
    expect(readDesktopSecret()).toBeNull()

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

describe('isLoopbackBaseUrl', () => {
  it('accepts the default and every loopback spelling', () => {
    expect(isLoopbackBaseUrl(undefined)).toBe(true)
    expect(isLoopbackBaseUrl(DEFAULT_UNSLOTH_BASE_URL)).toBe(true)
    expect(isLoopbackBaseUrl('http://localhost:8888/v1')).toBe(true)
    expect(isLoopbackBaseUrl('http://127.0.0.1:9000')).toBe(true)
    expect(isLoopbackBaseUrl('http://[::1]:8888/v1')).toBe(true)
  })

  it('rejects LAN, public, non-http and malformed URLs', () => {
    expect(isLoopbackBaseUrl('http://192.168.1.5:8888/v1')).toBe(false)
    expect(isLoopbackBaseUrl('https://studio.example.com')).toBe(false)
    expect(isLoopbackBaseUrl('file:///etc/passwd')).toBe(false)
    expect(isLoopbackBaseUrl('not a url')).toBe(false)
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
    mockStudioFiles({ [SECRET_FILE]: SECRET })

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

  it('refuses to send the desktop credential to a non-loopback host', async () => {
    mockStudioFiles({ [SECRET_FILE]: SECRET })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await connectUnslothStudio({ baseUrl: 'http://192.168.1.5:8888/v1' })

    expect(result).toEqual({ ok: false, code: 'invalid_base_url' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never probes a stored key against a foreign host', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await connectUnslothStudio({
      baseUrl: 'https://studio.example.com/v1',
      existingApiKey: API_KEY
    })

    expect(result).toEqual({ ok: false, code: 'invalid_base_url' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports not_installed when no desktop credential exists', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await connectUnslothStudio({})

    expect(result).toEqual({ ok: false, code: 'not_installed' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports not_running when nothing answers on the base URL', async () => {
    mockStudioFiles({ [SECRET_FILE]: SECRET })
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
    mockStudioFiles({ [SECRET_FILE]: SECRET })
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
    mockStudioFiles({ [SECRET_FILE]: SECRET })
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
    mockStudioFiles({ [SECRET_FILE]: SECRET })
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

describe('connectUnslothStudio (port discovery)', () => {
  beforeEach(() => {
    mockStudioFiles({ [SECRET_FILE]: SECRET })
  })

  it('uses the port recorded by the desktop run state when no URL is given', async () => {
    mockStudioFiles({
      [SECRET_FILE]: SECRET,
      [RUN_STATE_FILE]: JSON.stringify({ port: 9123 })
    })
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url)
      if (target === 'http://127.0.0.1:9123/api/auth/desktop-login') {
        return jsonResponse(200, { access_token: 'owner-token' })
      }
      if (target === 'http://127.0.0.1:9123/api/auth/api-keys') {
        return jsonResponse(200, { key: API_KEY })
      }
      if (target === 'http://127.0.0.1:9123/v1/models') {
        return jsonResponse(200, modelsPayload)
      }
      throw new Error(`Unexpected fetch: ${target}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await connectUnslothStudio({})

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.baseUrl).toBe('http://127.0.0.1:9123/v1')
  })

  it('ignores an unusable recorded port and falls back to the default', async () => {
    mockStudioFiles({
      [SECRET_FILE]: SECRET,
      [RUN_STATE_FILE]: JSON.stringify({ port: 'not-a-port' })
    })
    const fetchMock = vi.fn(async () => jsonResponse(200, { access_token: 'owner-token' }))
    vi.stubGlobal('fetch', fetchMock)

    await connectUnslothStudio({})

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://127.0.0.1:8888/api/auth/desktop-login'
    )
  })

  it('prefers an explicit base URL over the recorded port', async () => {
    mockStudioFiles({
      [SECRET_FILE]: SECRET,
      [RUN_STATE_FILE]: JSON.stringify({ port: 9123 })
    })
    const fetchMock = vi.fn(async () => jsonResponse(200, { access_token: 'owner-token' }))
    vi.stubGlobal('fetch', fetchMock)

    await connectUnslothStudio({ baseUrl: 'http://127.0.0.1:7000/v1' })

    expect(String(fetchMock.mock.calls[0][0])).toBe('http://127.0.0.1:7000/api/auth/desktop-login')
  })
})

describe('connectUnslothStudio (multi-account & concurrency)', () => {
  function deferred(): { promise: Promise<void>; resolve: () => void } {
    let resolve!: () => void
    const promise = new Promise<void>((r) => {
      resolve = r
    })
    return { promise, resolve }
  }

  beforeEach(() => {
    mockStudioFiles({ [SECRET_FILE]: SECRET })
  })

  it('reports multi_account when Studio refuses to pick an account by secret', async () => {
    stubFetch([
      {
        match: (url) => url.endsWith('/api/auth/desktop-login'),
        respond: () => jsonResponse(200, { login_required: true, login_mode: 'multi' })
      }
    ])

    const result = await connectUnslothStudio({})

    expect(result).toEqual({ ok: false, code: 'multi_account' })
  })

  it('shares one request when Connect is pressed concurrently', async () => {
    const loginGate = deferred()
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url)
      if (target.endsWith('/api/auth/desktop-login')) {
        await loginGate.promise
        return jsonResponse(200, { access_token: 'owner-token' })
      }
      if (target.endsWith('/api/auth/api-keys')) return jsonResponse(200, { key: API_KEY })
      if (target.endsWith('/v1/models')) return jsonResponse(200, modelsPayload)
      throw new Error(`Unexpected fetch: ${target}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = connectUnslothStudio({})
    const second = connectUnslothStudio({})
    loginGate.resolve()
    const [a, b] = await Promise.all([first, second])

    expect(a).toEqual(b)
    expect(fetchMock).toHaveBeenCalledTimes(3) // login + key + models, once each
  })
})
