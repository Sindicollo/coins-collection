import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoinList } from '@/features/coins/CoinList'
import type { Coin } from '@shared/types'

// Mock intersection observer — returns a no-op ref callback
vi.mock('@/hooks/useIntersectionObserver', () => ({
  useIntersectionObserver: vi.fn(() => vi.fn())
}))

// Mock CoinCard to avoid Router dependency (CoinCard uses useNavigate)
vi.mock('@/features/coins/CoinCard', () => ({
  CoinCard: vi.fn(({ coin }) => <div data-testid="coin-card">{coin.denomination}</div>)
}))

const mockCoin: Coin = {
  id: 'c1',
  collectionId: 'col-1',
  denomination: '10 рублей',
  country: 'Russia',
  year: 1990,
  condition: 'UNC',
  composition: 'silver',
  purchaseDate: 1672531200000,
  purchasePlace: 'eBay',
  price: 500,
  shippingCost: 50,
  currency: 'RUB',
  notes: 'Nice coin',
  sold: false,
  onAuction: false,
  auctionPrice: null,
  salePrice: null,
  createdAt: 1000,
  updatedAt: 2000,
  extraData: null
}

const mockCoin2: Coin = {
  ...mockCoin,
  id: 'c2',
  denomination: '5 рублей',
  year: 1989
}

describe('CoinList', () => {
  const baseProps = {
    coins: [],
    loading: false,
    loadingMore: false,
    hasMore: false,
    error: null,
    onLoadMore: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onSelect: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- Happy path: loading state ---

  it('renders 5 skeletons when loading', () => {
    const { container } = render(<CoinList {...baseProps} loading={true} />)

    // The loading state renders 5 Skeleton divs (animate-pulse bg-gray-200 rounded)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons).toHaveLength(5)
    // Empty / error / list states should not appear
    expect(screen.queryByText('No coins in this collection yet.')).not.toBeInTheDocument()
  })

  // --- Happy path: empty state ---

  it('renders empty state when coins array is empty', () => {
    render(<CoinList {...baseProps} coins={[]} />)

    expect(screen.getByText('No coins in this collection yet.')).toBeInTheDocument()
    expect(screen.getByText('Click "Add Coin" to start your collection.')).toBeInTheDocument()
  })

  // --- Happy path: renders coin cards ---

  it('renders a CoinCard for each coin', () => {
    render(<CoinList {...baseProps} coins={[mockCoin, mockCoin2]} />)

    expect(screen.getByText('10 рублей')).toBeInTheDocument()
    expect(screen.getByText('5 рублей')).toBeInTheDocument()
  })

  // --- Edge case: error state ---

  it('renders error message when error is set', () => {
    render(<CoinList {...baseProps} error="coins.errors.loadFailed" />)

    // t('coins.errors.loadFailed') → 'Failed to load coins' (from setup)
    expect(screen.getByText('Failed to load coins')).toBeInTheDocument()
  })

  // --- Edge case: loading more skeletons ---

  it('renders 2 additional skeletons when loadingMore is true', () => {
    const { container } = render(
      <CoinList {...baseProps} coins={[mockCoin]} loadingMore={true} hasMore={true} />
    )

    // 0 from normal list (CoinCard doesn't use animate-pulse) + 2 loading skeletons
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons).toHaveLength(2)
  })

  // --- Edge case: sentinel div for intersection observer ---

  it('renders sentinel div when hasMore is true', () => {
    const { container } = render(
      <CoinList {...baseProps} coins={[mockCoin]} hasMore={true} />
    )

    // The sentinel div has className "h-1" (no other elements use this)
    const sentinel = container.querySelector('.h-1')
    expect(sentinel).toBeInTheDocument()
  })

  // --- Edge case: end-of-list counter ---

  it('shows coin count when hasMore is false and coins exist', () => {
    render(
      <CoinList {...baseProps} coins={[mockCoin, mockCoin2]} hasMore={false} />
    )

    expect(screen.getByText(/2 coins?/i)).toBeInTheDocument()
  })

  // --- Edge case: does not show end-of-list counter when hasMore is true ---

  it('does not show coin count when hasMore is true', () => {
    render(
      <CoinList {...baseProps} coins={[mockCoin]} hasMore={true} />
    )

    expect(screen.queryByText(/1 coins?/i)).not.toBeInTheDocument()
  })
})
