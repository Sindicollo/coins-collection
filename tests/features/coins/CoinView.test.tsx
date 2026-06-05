import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CoinView } from '@/features/coins/CoinView'
import { useCoinStore } from '@/features/coins/useCoins'
import type { Coin } from '@shared/types'

// Mock child components to isolate CoinView logic
vi.mock('@/features/coins/CoinList', () => ({
  CoinList: vi.fn(({ onEdit, onDelete }) => (
    <div data-testid="coin-list">
      <button data-testid="mock-edit" onClick={() => onEdit(mockCoin)}>edit</button>
      <button data-testid="mock-delete" onClick={() => onDelete(mockCoin)}>delete</button>
    </div>
  ))
}))

vi.mock('@/features/coins/CoinForm', () => ({
  CoinForm: vi.fn(({ open, onSave, onClose, coin }) => (
    <div data-testid="coin-form" data-open={open} data-coin-id={coin?.id ?? ''}>
      <button data-testid="mock-save" onClick={() => onSave({
        collectionId: 'col1',
        denomination: 'test',
        country: null,
        year: null,
        condition: null,
        purchaseDate: null,
        purchasePlace: null,
        price: null,
        shippingCost: null,
        currency: null,
        notes: null,
        sold: false
      })}>save</button>
      <button data-testid="mock-save-different" onClick={() => onSave({
        collectionId: 'col2',
        denomination: 'test',
        country: null,
        year: null,
        condition: null,
        purchaseDate: null,
        purchasePlace: null,
        price: null,
        shippingCost: null,
        currency: null,
        notes: null,
        sold: false
      })}>save to different</button>
      <button data-testid="mock-close" onClick={onClose}>close</button>
    </div>
  ))
}))

vi.mock('@/features/coins/LlmPrices', () => ({
  LlmPrices: vi.fn(({ onImported }) => {
    // Store callback for test access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__llmOnImported = onImported
    return <div data-testid="llm-prices" />
  })
}))

vi.mock('@/features/coins/useScrollRestoration', () => ({
  useScrollRestoration: vi.fn()
}))

vi.mock('@/components/ui/Modal', () => ({
  Modal: vi.fn(({ open, title, children }) =>
    open ? <div data-testid="modal"><h3>{title}</h3>{children}</div> : null
  )
}))

const mockCoin: Coin = {
  id: 'c1',
  collectionId: 'col1',
  denomination: '1 рубль',
  year: 1999,
  condition: 'UNC',
  purchaseDate: null,
  purchasePlace: 'eBay',
  price: 50,
  shippingCost: 5,
  currency: 'RUB',
  country: 'Russia',
  notes: '',
  extraData: null,
  sold: false,
  createdAt: 1000,
  updatedAt: 1000
}

const defaultCollections = [
  { id: 'col1', name: 'Russia' },
  { id: 'col2', name: 'USA' }
]

function renderCoinView(props: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <CoinView
        collectionId="col1"
        collectionName="Russia"
        defaultCurrency="RUB"
        collections={defaultCollections}
        onCollectionChange={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('CoinView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api.coins.listCountries = vi.fn().mockResolvedValue([])
    // Reset the store to initial state
    useCoinStore.setState({
      coins: [],
      loading: false,
      loadingMore: false,
      hasMore: false,
      error: null,
      loadedCollectionId: null,
      cursors: [],
      scrollPositions: {}
    })
  })

  describe('rendering', () => {
    it('shows collection name and title', () => {
      renderCoinView()
      expect(screen.getByText('Russia')).toBeDefined()
      expect(screen.getByText('Coins')).toBeDefined()
    })

    it('renders CoinList with store data', async () => {
      useCoinStore.setState({
        coins: [mockCoin],
        loading: false,
        loadedCollectionId: 'col1'
      })

      renderCoinView()
      const list = screen.getByTestId('coin-list')
      expect(list).toBeDefined()
    })

    it('loads coins on mount when loadedCollectionId is null', () => {
      const loadSpy = vi.fn()
      useCoinStore.setState({ loadedCollectionId: null })
      // Patch loadCoins after state is set
      const store = useCoinStore.getState()
      vi.spyOn(store, 'loadCoins').mockImplementation(loadSpy)

      renderCoinView()
      expect(loadSpy).toHaveBeenCalledWith('col1')
    })

    it('does not reload coins when loadedCollectionId matches', () => {
      const loadSpy = vi.fn()
      useCoinStore.setState({ loadedCollectionId: 'col1', coins: [mockCoin] })
      vi.spyOn(useCoinStore.getState(), 'loadCoins').mockImplementation(loadSpy)

      renderCoinView()
      expect(loadSpy).not.toHaveBeenCalled()
    })
  })

  describe('add / edit coin form', () => {
    it('opens empty form when Add Coin button is clicked', () => {
      renderCoinView()
      fireEvent.click(screen.getByText('Add Coin'))

      const form = screen.getByTestId('coin-form')
      expect(form.getAttribute('data-open')).toBe('true')
      expect(form.getAttribute('data-coin-id')).toBe('')
    })

    it('opens edit form with coin data when coin is edited', () => {
      useCoinStore.setState({ coins: [mockCoin] })
      renderCoinView()

      fireEvent.click(screen.getByTestId('mock-edit'))
      const form = screen.getByTestId('coin-form')
      expect(form.getAttribute('data-open')).toBe('true')
      expect(form.getAttribute('data-coin-id')).toBe('c1')
    })

    it('closes form when onClose is called', () => {
      renderCoinView()

      // Open form first
      fireEvent.click(screen.getByText('Add Coin'))
      expect(screen.getByTestId('coin-form').getAttribute('data-open')).toBe('true')

      // Close it
      fireEvent.click(screen.getByTestId('mock-close'))
      expect(screen.getByTestId('coin-form').getAttribute('data-open')).toBe('false')
    })
  })

  describe('save coin', () => {
    it('calls addCoin when creating a new coin', () => {
      const addSpy = vi.fn()
      vi.spyOn(useCoinStore.getState(), 'addCoin').mockImplementation(addSpy)

      renderCoinView()

      fireEvent.click(screen.getByText('Add Coin'))
      fireEvent.click(screen.getByTestId('mock-save'))

      expect(addSpy).toHaveBeenCalled()
      // Form should close after save
      expect(screen.getByTestId('coin-form').getAttribute('data-open')).toBe('false')
    })

    it('calls updateCoin when editing an existing coin', () => {
      useCoinStore.setState({ coins: [mockCoin] })
      const updateSpy = vi.fn()
      vi.spyOn(useCoinStore.getState(), 'updateCoin').mockImplementation(updateSpy)

      renderCoinView()

      fireEvent.click(screen.getByTestId('mock-edit'))
      fireEvent.click(screen.getByTestId('mock-save'))

      expect(updateSpy).toHaveBeenCalled()
    })

    it('calls onCollectionChange when coin moves to another collection', () => {
      const onCollectionChange = vi.fn()

      useCoinStore.setState({ coins: [mockCoin] })

      renderCoinView({ onCollectionChange })

      // Open edit form
      fireEvent.click(screen.getByTestId('mock-edit'))
      // Save with different collectionId
      fireEvent.click(screen.getByTestId('mock-save-different'))

      expect(onCollectionChange).toHaveBeenCalled()
    })
  })

  describe('delete coin', () => {
    it('opens delete confirmation modal', () => {
      useCoinStore.setState({ coins: [mockCoin] })
      renderCoinView()

      fireEvent.click(screen.getByTestId('mock-delete'))

      expect(screen.getByTestId('modal')).toBeDefined()
      expect(screen.getByText('Delete Coin')).toBeDefined()
    })

    it('calls deleteCoin on confirm and closes modal', () => {
      const deleteSpy = vi.fn().mockResolvedValue(true)
      vi.spyOn(useCoinStore.getState(), 'deleteCoin').mockImplementation(deleteSpy)

      useCoinStore.setState({ coins: [mockCoin] })
      renderCoinView()

      fireEvent.click(screen.getByTestId('mock-delete'))
      fireEvent.click(screen.getByText('Delete'))

      expect(deleteSpy).toHaveBeenCalledWith('c1')
      // Modal should close (re-render with coinToDelete=null)
      expect(screen.queryByTestId('modal')).toBeNull()
    })

    it('cancels deletion when Cancel is clicked', () => {
      useCoinStore.setState({ coins: [mockCoin] })
      renderCoinView()

      fireEvent.click(screen.getByTestId('mock-delete'))
      fireEvent.click(screen.getByText('Cancel'))

      expect(screen.queryByTestId('modal')).toBeNull()
    })
  })

  describe('refresh', () => {
    it('called when LlmPrices fires onImported', () => {
      const resetSpy = vi.fn()
      const loadSpy = vi.fn()
      vi.spyOn(useCoinStore.getState(), 'reset').mockImplementation(resetSpy)
      vi.spyOn(useCoinStore.getState(), 'loadCoins').mockImplementation(loadSpy)

      renderCoinView()

      // Trigger the stored callback from LlmPrices mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__llmOnImported?.()

      expect(resetSpy).toHaveBeenCalled()
      expect(loadSpy).toHaveBeenCalledWith('col1')
    })
  })
})
