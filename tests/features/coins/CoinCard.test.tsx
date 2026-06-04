import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CoinCard } from '@/features/coins/CoinCard'
import type { Coin } from '@shared/types'

const mockCoin: Coin = {
  id: 'c1',
  collectionId: 'ru',
  denomination: '1 рубль',
  year: 1999,
  condition: 'UNC',
  purchaseDate: null,
  purchasePlace: 'eBay',
  price: 50.5,
  shippingCost: 5,
  currency: 'RUB',
  country: 'Russia',
  notes: 'Nice coin',
  extraData: null,
  createdAt: 1000,
  updatedAt: 1000
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('CoinCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api.photos.list = vi.fn().mockResolvedValue([])
    window.api.photos.getPhotoData = vi.fn().mockResolvedValue(null)
  })

  it('renders denomination and year', async () => {
    renderWithRouter(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )

    expect(screen.getByText('1 рубль')).toBeDefined()
    expect(screen.getByText('1999')).toBeDefined()
  })

  it('renders condition label', async () => {
    renderWithRouter(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )

    expect(screen.getByText('Uncirculated (UNC)')).toBeDefined()
  })

  it('renders price in top row', async () => {
    renderWithRouter(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )

    expect(screen.getByText('₽50.50')).toBeDefined()
  })

  it('renders placeholder coin icon when no photos', async () => {
    window.api.photos.list = vi.fn().mockResolvedValue([])

    renderWithRouter(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )

    await waitFor(() => {
      // Placeholder with generic coin icon should be rendered
      const placeholders = document.querySelectorAll('.h-16.w-14')
      expect(placeholders.length).toBeGreaterThan(0)
    })
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    renderWithRouter(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={onSelect} />
    )

    fireEvent.click(screen.getByText('1 рубль').closest('.cursor-pointer')!)
    expect(onSelect).toHaveBeenCalledWith(mockCoin)
  })

  it('calls photos.list with coin id', async () => {
    const listSpy = vi.fn().mockResolvedValue([])
    window.api.photos.list = listSpy

    renderWithRouter(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith('c1')
    })
  })
})
