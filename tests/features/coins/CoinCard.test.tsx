import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CoinCard } from '@/features/coins/CoinCard'
import type { Coin } from '@shared/types'

const mockCoin: Coin = {
  id: 'c1',
  countryId: 'ru',
  denomination: '1 рубль',
  year: 1999,
  condition: 'UNC',
  purchaseDate: null,
  purchasePlace: 'eBay',
  price: 50.5,
  shippingCost: 5,
  currency: 'RUB',
  notes: 'Nice coin',
  extraData: null,
  createdAt: 1000,
  updatedAt: 1000
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('CoinCard', () => {
  it('renders denomination and year', () => {
    renderWithRouter(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )

    expect(screen.getByText('1 рубль')).toBeDefined()
    expect(screen.getByText('1999')).toBeDefined()
  })

  it('renders condition label', () => {
    renderWithRouter(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )

    expect(screen.getByText('Uncirculated (UNC)')).toBeDefined()
  })

  it('renders price and purchase place', () => {
    renderWithRouter(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )

    expect(screen.getByText('₽50.50')).toBeDefined()
    expect(screen.getByText(/eBay/)).toBeDefined()
  })

  it('renders notes', () => {
    renderWithRouter(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )

    expect(screen.getByText('Nice coin')).toBeDefined()
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    renderWithRouter(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={onSelect} />
    )

    fireEvent.click(screen.getByText('1 рубль').closest('.cursor-pointer')!)
    expect(onSelect).toHaveBeenCalledWith(mockCoin)
  })
})
