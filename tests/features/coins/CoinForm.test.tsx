import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CoinForm } from '@/features/coins/CoinForm'
import type { Coin } from '@shared/types'

const mockCollections = [
  { id: 'c1', name: 'Russia' },
  { id: 'c2', name: 'USA' }
]

const mockCoin: Coin = {
  id: 'coin-1',
  collectionId: 'c1',
  denomination: '10 рублей',
  country: 'Russia',
  year: 1990,
  condition: 'UNC',
  composition: 'copper',
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
  updatedAt: 2000
}

describe('CoinForm', () => {
  const defaultProps = {
    open: true,
    defaultCurrency: 'RUB',
    collections: mockCollections,
    countrySuggestions: ['Russia', 'USA', 'UK'],
    onSave: vi.fn(),
    onClose: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty form in create mode', () => {
    render(<CoinForm {...defaultProps} />)

    expect(screen.getByText('New Coin')).toBeInTheDocument()
    const denomInput = screen.getByPlaceholderText('e.g. 1 рубль, 50 cents') as HTMLInputElement
    expect(denomInput.value).toBe('')
    const yearInput = screen.getByPlaceholderText('e.g. 1990') as HTMLInputElement
    expect(yearInput.value).toBe('')
    const currencySelect = screen.getByLabelText('Currency') as HTMLSelectElement
    expect(currencySelect.value).toBe('RUB')
  })

  it('renders form pre-filled with coin data in edit mode', () => {
    render(<CoinForm {...defaultProps} coin={mockCoin} />)

    expect(screen.getByText('Edit Coin')).toBeInTheDocument()
    const denomInput = screen.getByDisplayValue('10 рублей') as HTMLInputElement
    expect(denomInput).toBeInTheDocument()
    const yearInput = screen.getByDisplayValue('1990') as HTMLInputElement
    expect(yearInput).toBeInTheDocument()
    const currencySelect = screen.getByLabelText('Currency') as HTMLSelectElement
    expect(currencySelect.value).toBe('RUB')
  })

  it('submits form with correctly transformed data', () => {
    const onSave = vi.fn()
    render(<CoinForm {...defaultProps} onSave={onSave} />)

    const collectionSelect = screen.getByLabelText('Collections') as HTMLSelectElement
    fireEvent.change(collectionSelect, { target: { value: 'c1' } })

    const denomInput = screen.getByPlaceholderText('e.g. 1 рубль, 50 cents') as HTMLInputElement
    fireEvent.change(denomInput, { target: { value: '10 рублей' } })

    const countryInput = screen.getByPlaceholderText('e.g. UK, Russia, USA…') as HTMLInputElement
    fireEvent.change(countryInput, { target: { value: 'Russia' } })

    const yearInput = screen.getByPlaceholderText('e.g. 1990') as HTMLInputElement
    fireEvent.change(yearInput, { target: { value: '1990' } })

    const priceInput = screen.getAllByPlaceholderText('0.00')[0] as HTMLInputElement
    fireEvent.change(priceInput, { target: { value: '500' } })

    fireEvent.click(screen.getByText('Save'))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({
      collectionId: 'c1',
      denomination: '10 рублей',
      country: 'Russia',
      year: 1990,
      condition: null,
      composition: null,
      purchaseDate: null,
      purchasePlace: null,
      price: 500,
      shippingCost: null,
      currency: 'RUB',
      sold: false,
      onAuction: false,
      auctionPrice: null,
      salePrice: null
    })
  })

  it('shows error and does not call onSave when denomination is empty', () => {
    const onSave = vi.fn()
    render(<CoinForm {...defaultProps} onSave={onSave} />)

    const collectionSelect = screen.getByLabelText('Collections') as HTMLSelectElement
    fireEvent.change(collectionSelect, { target: { value: 'c1' } })

    fireEvent.click(screen.getByText('Save'))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Denomination is required')).toBeInTheDocument()
  })

  it('submits with null for empty optional fields', () => {
    const onSave = vi.fn()
    render(<CoinForm {...defaultProps} onSave={onSave} />)

    const collectionSelect = screen.getByLabelText('Collections') as HTMLSelectElement
    fireEvent.change(collectionSelect, { target: { value: 'c1' } })

    const denomInput = screen.getByPlaceholderText('e.g. 1 рубль, 50 cents') as HTMLInputElement
    fireEvent.change(denomInput, { target: { value: '5 копеек' } })

    fireEvent.click(screen.getByText('Save'))

    expect(onSave).toHaveBeenCalledWith({
      collectionId: 'c1',
      denomination: '5 копеек',
      country: null,
      year: null,
      condition: null,
      composition: null,
      purchaseDate: null,
      purchasePlace: null,
      price: null,
      shippingCost: null,
      currency: 'RUB',
      sold: false,
      onAuction: false,
      auctionPrice: null,
      salePrice: null
    })
  })

  it('shows auction and sale price fields only when their checkboxes are checked', () => {
    render(<CoinForm {...defaultProps} />)

    // Auction price and Sale price labels are hidden when unchecked
    expect(screen.queryByText('Auction price')).not.toBeInTheDocument()
    expect(screen.queryByText('Sale price')).not.toBeInTheDocument()

    const auctionCheckbox = screen.getByLabelText('On auction') as HTMLInputElement
    fireEvent.click(auctionCheckbox)

    expect(screen.getByText('Auction price')).toBeInTheDocument()
    expect(screen.queryByText('Sale price')).not.toBeInTheDocument()

    const soldCheckbox = screen.getByLabelText('Sold') as HTMLInputElement
    fireEvent.click(soldCheckbox)

    expect(screen.getByText('Auction price')).toBeInTheDocument()
    expect(screen.getByText('Sale price')).toBeInTheDocument()
  })

  it('shows error when collection is not selected', () => {
    const onSave = vi.fn()
    render(<CoinForm {...defaultProps} onSave={onSave} />)

    const denomInput = screen.getByPlaceholderText('e.g. 1 рубль, 50 cents') as HTMLInputElement
    fireEvent.change(denomInput, { target: { value: '10 рублей' } })

    fireEvent.click(screen.getByText('Save'))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Select a collection first')).toBeInTheDocument()
  })

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn()
    render(<CoinForm {...defaultProps} onClose={onClose} />)

    fireEvent.click(screen.getByText('Cancel'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('parses year string to number on submit', () => {
    const onSave = vi.fn()
    render(<CoinForm {...defaultProps} onSave={onSave} />)

    const collectionSelect = screen.getByLabelText('Collections') as HTMLSelectElement
    fireEvent.change(collectionSelect, { target: { value: 'c1' } })

    const denomInput = screen.getByPlaceholderText('e.g. 1 рубль, 50 cents') as HTMLInputElement
    fireEvent.change(denomInput, { target: { value: 'test' } })

    const yearInput = screen.getByPlaceholderText('e.g. 1990') as HTMLInputElement
    fireEvent.change(yearInput, { target: { value: '1990' } })

    fireEvent.click(screen.getByText('Save'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ year: 1990 }))
  })

  it('does not render content when open is false', () => {
    render(<CoinForm {...defaultProps} open={false} />)

    expect(screen.queryByPlaceholderText('e.g. 1 рубль, 50 cents')).not.toBeInTheDocument()
    expect(screen.queryByText('New Coin')).not.toBeInTheDocument()
  })
})
