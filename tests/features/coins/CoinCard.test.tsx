import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

describe('CoinCard', () => {
  it('renders denomination and year', () => {
    render(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )

    expect(screen.getByText('1 рубль')).toBeDefined()
    expect(screen.getByText('1999')).toBeDefined()
  })

  it('renders condition label', () => {
    render(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )

    expect(screen.getByText('Uncirculated (UNC)')).toBeDefined()
  })

  it('renders price and purchase place', () => {
    render(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )

    expect(screen.getByText('₽50.50')).toBeDefined()
    expect(screen.getByText(/eBay/)).toBeDefined()
  })

  it('renders notes', () => {
    render(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )

    expect(screen.getByText('Nice coin')).toBeDefined()
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    render(
      <CoinCard coin={mockCoin} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={onSelect} />
    )

    fireEvent.click(screen.getByText('1 рубль').closest('.cursor-pointer')!)
    expect(onSelect).toHaveBeenCalledWith(mockCoin)
  })
})
