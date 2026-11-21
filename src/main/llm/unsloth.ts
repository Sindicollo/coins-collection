/**
 * Unsloth Studio integration.
 *
 * Unsloth Studio runs a local, OpenAI-compatible server
 * (`unsloth studio --api-only`, default http://127.0.0.1:8888/v1) that only
 * answers requests carrying an API key. Keys are normally minted in the Studio
 * UI (Settings → API keys); this module mints one for the user by exchanging
 * the desktop credential Studio writes for its own shell
 * (`<studio>/auth/.desktop_secret`) for a short-lived owner token.
 *
 * Everything here is best-effort and defensive: a missing/rotated credential or
 * a changed Studio layout must degrade into a readable error, never a crash.
 */

import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { DEFAULT_UNSLOTH_BASE_URL } from '@shared/types'
import type { UnslothConnectResult, UnslothModel } from '@shared/types'

/** Default Studio API root (OpenAI-compatible `/v1` lives under it). */
const DEFAULT_STUDIO_ROOT = DEFAULT_UNSLOTH_BASE_URL.replace(/\/v1$/, '')

/** Label of the API key created in Unsloth Studio. */
const API_KEY_NAME = 'Coin Collection'

/** Studio's local endpoints answer instantly; anything slower is a hung server. */
const REQUEST_TIMEOUT_MS = 8000

// ── Local install discovery ──────────────────────────────────────

/** Candidate Studio roots — env override first (matches the CLI's own override). */
function studioRoots(): string[] {
  const roots: string[] = []
  const fromEnv = process.env.UNSLOTH_STUDIO_HOME?.trim()
  if (fromEnv) roots.push(fromEnv)
  roots.push(join(homedir(), '.unsloth', 'studio'))
  return roots
}

/**
 * Read the local desktop credential.
 *
 * Studio stores it as `desktop-<token_urlsafe(48)>` next to `auth.db`. The file
 * is re-read on every call so a rotated credential is picked up immediately.
 */
export function readDesktopSecret(): string | null {
  for (const root of studioRoots()) {
    const candidates = [join(root, 'auth', '.desktop_secret'), join(root, '.desktop_secret')]
    for (const candidate of candidates) {
      try {
        const secret = readFileSync(candidate, 'utf-8').trim()
        if (/^desktop-[A-Za-z0-9_-]{10,}$/.test(secret)) return secret
      } catch {
        // Missing (ENOENT) or unreadable (permissions) — try the next candidate.
      }
    }
  }
  return null
}

/**
 * Port Studio actually listens on, as recorded by the desktop shell.
 *
 * The shell picks a free port when 8888 is busy, and the CLI accepts `-p`, so
 * the compile-time default is only a fallback.
 */
function studioPortFromRunFile(): number | null {
  for (const root of studioRoots()) {
    try {
      const raw = readFileSync(join(root, 'run', 'desktop_backend.json'), 'utf-8')
      const { port } = JSON.parse(raw) as { port?: unknown }
      if (typeof port === 'number' && Number.isInteger(port) && port > 0 && port < 65536) {
        return port
      }
    } catch {
      // No desktop run state (CLI-only install) or unreadable — keep the default.
    }
  }
  return null
}

/** Base URL used when the user has not overridden it in settings. */
function defaultBaseUrl(): string {
  const port = studioPortFromRunFile()
  return port ? `http://127.0.0.1:${port}/v1` : DEFAULT_UNSLOTH_BASE_URL
}

// ── HTTP helpers ─────────────────────────────────────────────────

type JsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; status?: number; detail: string; unreachable: boolean }

function describeFetchError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause
    if (cause instanceof Error && cause.message) return `${err.message} (${cause.message})`
    return err.message
  }
  return String(err)
}

async function requestJson<T>(
  url: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; apiKey?: string } = {}
): Promise<JsonResult<T>> {
  const { method = 'GET', body, apiKey } = init

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (err) {
    // ECONNREFUSED / ENOTFOUND / timeout — the server simply isn't there.
    return { ok: false, detail: describeFetchError(err), unreachable: true }
  }

  const raw = await response.text().catch(() => '')
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      detail: raw.slice(0, 300) || `HTTP ${response.status}`,
      unreachable: false
    }
  }

  try {
    return { ok: true, data: (raw ? JSON.parse(raw) : {}) as T }
  } catch {
    return { ok: false, status: response.status, detail: 'Invalid JSON response', unreachable: false }
  }
}

/** `http://host:port/v1` → `http://host:port` so the `/api/*` routes can be reached. */
export function studioRootFromBaseUrl(baseUrl?: string): string {
  const raw = (baseUrl || DEFAULT_UNSLOTH_BASE_URL).trim()
  const withoutV1 = raw.replace(/\/+$/, '').replace(/\/v1$/, '')
  return withoutV1 || DEFAULT_STUDIO_ROOT
}

/** `http://host:port` → `http://host:port/v1` (the OpenAI-compatible prefix). */
function normalizeBaseUrl(baseUrl?: string): string {
  return `${studioRootFromBaseUrl(baseUrl)}/v1`
}

/**
 * True when the base URL points at this machine (127.0.0.1 / localhost / ::1).
 *
 * The desktop credential grants owner rights inside Studio, so it may only ever
 * be sent to a loopback server. A remote or malformed URL must fall back to a
 * manually created API key instead.
 */
export function isLoopbackBaseUrl(baseUrl?: string): boolean {
  try {
    const parsed = new URL(studioRootFromBaseUrl(baseUrl))
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    const host = parsed.hostname.replace(/^\[|\]$/g, '')
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

// ── Studio API calls ─────────────────────────────────────────────

interface StudioModelsResponse {
  data?: { id?: unknown; loaded?: unknown }[]
}

function parseModels(payload: StudioModelsResponse | undefined): UnslothModel[] {
  const rows = payload && Array.isArray(payload.data) ? payload.data : []
  const models: UnslothModel[] = []
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || row.id.length === 0) continue
    models.push({ id: row.id, loaded: row.loaded === true })
  }
  return models
}

/** List models served by Studio. Requires a valid API key. */
async function listModels(
  baseUrl: string,
  apiKey: string
): Promise<{ ok: true; models: UnslothModel[] } | { ok: false; status?: number; detail: string; unreachable: boolean }> {
  const result = await requestJson<StudioModelsResponse>(`${baseUrl}/models`, { apiKey })
  if (!result.ok) return result
  return { ok: true, models: parseModels(result.data) }
}

interface StudioTokenResponse {
  access_token?: unknown
  /** Present when the install has several accounts and the desktop secret cannot pick one. */
  login_required?: unknown
}

interface StudioCreateKeyResponse {
  key?: unknown
}

/** Single in-flight connect: two concurrent presses must not mint two keys. */
let connectInFlight: Promise<UnslothConnectResult> | null = null

/**
 * Connect to the local Unsloth Studio and return a ready-to-use inference key.
 *
 * An already stored key is validated first, so pressing "Connect" twice does not
 * litter the user's Studio key list with duplicates. Concurrent calls share the
 * same request — the target is a single local server.
 */
export function connectUnslothStudio(options: {
  baseUrl?: string
  existingApiKey?: string
} = {}): Promise<UnslothConnectResult> {
  if (!connectInFlight) {
    connectInFlight = connectUnslothOnce(options).finally(() => {
      connectInFlight = null
    })
  }
  return connectInFlight
}

async function connectUnslothOnce(options: {
  baseUrl?: string
  existingApiKey?: string
}): Promise<UnslothConnectResult> {
  const requested = options.baseUrl?.trim() || defaultBaseUrl()
  const baseUrl = normalizeBaseUrl(requested)
  const root = studioRootFromBaseUrl(requested)

  // The desktop secret is an owner credential — it must never leave the machine,
  // and the stored key must not be probed against a foreign host either.
  if (!isLoopbackBaseUrl(requested)) return { ok: false, code: 'invalid_base_url' }

  // 1. Reuse a working key (e.g. the user pressed "Connect" again to refresh models).
  const existingKey = options.existingApiKey?.trim()
  if (existingKey) {
    const probe = await listModels(baseUrl, existingKey)
    if (probe.ok) return { ok: true, apiKey: existingKey, baseUrl, models: probe.models }
    if (!probe.unreachable && probe.status !== 401 && probe.status !== 403) {
      // Studio answered but something else broke — surface it instead of silently minting a key.
      return { ok: false, code: 'unknown', detail: probe.detail }
    }
  }

  // 2. Mint a new key from the local desktop credential.
  const secret = readDesktopSecret()
  if (!secret) return { ok: false, code: 'not_installed' }

  const login = await requestJson<StudioTokenResponse>(`${root}/api/auth/desktop-login`, {
    method: 'POST',
    body: { secret }
  })
  if (!login.ok) {
    if (login.unreachable) return { ok: false, code: 'not_running', detail: login.detail }
    if (login.status === 401 || login.status === 403) {
      return { ok: false, code: 'auth_failed', detail: login.detail }
    }
    // 429 (rate limit) / multi-user installs returning login_required / 5xx.
    return { ok: false, code: 'unknown', detail: `HTTP ${login.status}: ${login.detail}` }
  }

  const accessToken = typeof login.data?.access_token === 'string' ? login.data.access_token : ''
  if (!accessToken) {
    // Multi-account installs answer 200 + { login_required: true } instead of a token.
    return login.data?.login_required
      ? { ok: false, code: 'multi_account' }
      : { ok: false, code: 'auth_failed', detail: 'Studio returned no access token' }
  }

  const created = await requestJson<StudioCreateKeyResponse>(`${root}/api/auth/api-keys`, {
    method: 'POST',
    apiKey: accessToken,
    body: { name: API_KEY_NAME, access: 'inference' }
  })
  if (!created.ok || typeof created.data?.key !== 'string' || !created.data.key) {
    return {
      ok: false,
      code: 'key_create_failed',
      detail: created.ok ? 'Studio returned no key' : created.detail
    }
  }

  const apiKey = created.data.key
  const models = await listModels(baseUrl, apiKey)

  return {
    ok: true,
    apiKey,
    baseUrl,
    models: models.ok ? models.models : []
  }
}
