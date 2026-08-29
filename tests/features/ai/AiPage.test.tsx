/**
 * Unit tests for src/renderer/features/ai/AiPage.tsx — the fix-ui additions:
 *   - a friendly banner rendered from the store's structured `llmError`,
 *   - per-coin structured errors forwarded to AiCoinCard,
 *   - scroll restoration keyed by `ai:<collectionId>`.
 *
 * The page's own store (`useAiStore`) drives `llmError`/`coinErrors`, so the
 * real store is used and its state is mutated with `act()` (the mount effect
 * calls `clearResults()`, which wipes these fields).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AiPage } from '@/features/ai/AiPage'
import { useAiStore } from '@/features/ai/useAiStore'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import type { Coin, LlmErrorInfo } from '@shared/types'

vi.mock('@/features/ai/AiCoinCard', () => ({
  AiCoinCard: (props: { coin: Coin; coinError?: LlmErrorInfo }) => (
    <div
      data-testid={`ai-card-${props.coin.id}`}
      data-coin-error={props.coinError ? 'present' : 'none'}
    />
  )
}))

vi.mock('@/features/coins/LlmTools', () => ({
  LlmTools: () => <div data-testid="llm-tools" />
}))

vi.mock('@/hooks/useScrollRestoration', () => ({
  useScrollRestoration: vi.fn()
}))

const connectionRefused: LlmErrorInfo = {
  code: 'connection_refused',
  provider: 'lmstudio',
  baseUrl: 'http://localhost:1234/v1',
  model: 'qwen'
}

function makeCoin(id: string): Coin {
  return {
    id,
    collectionId: 'col-1',
    denomination: '1 рубль',
    year: 1999,
    condition: 'UNC',
    country: 'Russia',
    createdAt: 1,
    updatedAt: 1,
    purchaseDate: null,
    purchasePlace: null,
    price: null,
    shippingCost: null,
    currency: null,
    composition: null,
    extraData: null,
    sold: false,
    onAuction: false,
    auctionPrice: null,
    salePrice: null
  }
}

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/ai/col-1']}>
      <Routes>
        <Route path="/ai/:collectionId" element={<AiPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(window.api.coins.list).mockResolvedValue({ items: [] } as any)
  vi.mocked(window.api.collections.get).mockResolvedValue({ id: 'col-1', name: 'Russia' })
  vi.mocked(window.api.llm.getBulkSession).mockResolvedValue(null)
  useAiStore.setState({
    results: {},
    loading: false,
    error: null,
    llmError: null,
    coinErrors: {},
    bulkRunning: false,
    resumeSession: null,
    coinLoading: {}
  })
})

describe('AiPage error surfaces', () => {
  it('renders a friendly banner from the structured llmError', async () => {
    renderPage()
    // Mount effect clears results/errors — set the error after mount
    await act(async () => {
      useAiStore.setState({ llmError: connectionRefused })
    })

    expect(await screen.findByText(/Cannot connect to LM Studio/)).toBeDefined()
  })

  it('does not render an error banner when there is no llmError', async () => {
    renderPage()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(window.api.coins.list).mockResolvedValue({ items: [] } as any)

    expect(await screen.findByTestId('llm-tools')).toBeDefined()
    expect(screen.queryByText(/Cannot connect to/)).toBeNull()
  })

  it('forwards per-coin structured errors to the AiCoinCard', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(window.api.coins.list).mockResolvedValue({ items: [makeCoin('coin-1')] } as any)
    renderPage()

    await act(async () => {
      useAiStore.setState({ coinErrors: { 'coin-1': connectionRefused } })
    })

    const card = await screen.findByTestId('ai-card-coin-1')
    expect(card).toHaveAttribute('data-coin-error', 'present')
  })
})

describe('AiPage scroll restoration', () => {
  it('persists scroll position keyed by the collection', async () => {
    renderPage()

    await waitFor(() => {
      expect(useScrollRestoration).toHaveBeenCalled()
    })
    expect(useScrollRestoration).toHaveBeenCalledWith(
      expect.objectContaining({ storageKey: 'ai:col-1', ready: true })
    )
  })
})