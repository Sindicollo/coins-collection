import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AiCoinCard } from '@/features/ai/AiCoinCard'
import type { Coin, LlmErrorInfo } from '@shared/types'

const coin: Coin = {
  id: 'coin-1',
  collectionId: 'col-1',
  denomination: '1 рубль',
  year: 1999,
  condition: 'UNC',
  purchaseDate: null,
  purchasePlace: null,
  price: null,
  shippingCost: null,
  currency: null,
  country: 'Russia',
  composition: null,
  extraData: null,
  sold: false,
  onAuction: false,
  auctionPrice: null,
  salePrice: null,
  createdAt: 1,
  updatedAt: 1
}

function renderCard(props: Partial<Parameters<typeof AiCoinCard>[0]> = {}) {
  return render(
    <MemoryRouter>
      <AiCoinCard
        coin={coin}
        aiResult={undefined}
        loading={false}
        perCoinLoading={false}
        onQuerySingle={vi.fn()}
        onAppendToNotes={vi.fn()}
        onClearResult={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('AiCoinCard error display', () => {
  it('shows a friendly localized message for a per-coin error', () => {
    const err: LlmErrorInfo = {
      code: 'connection_refused',
      provider: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      model: 'qwen'
    }
    renderCard({ coinError: err })

    expect(screen.getByText(/Cannot connect to LM Studio/)).toBeDefined()
  })

  it('does not render an error block when there is no error', () => {
    renderCard()
    expect(screen.queryByText(/Cannot connect to LM Studio/)).toBeNull()
  })

  it('hides the error while the coin is loading', () => {
    const err: LlmErrorInfo = {
      code: 'connection_refused',
      provider: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      model: 'qwen'
    }
    renderCard({ coinError: err, perCoinLoading: true })

    expect(screen.queryByText(/Cannot connect to LM Studio/)).toBeNull()
    expect(screen.getByText('Querying...')).toBeDefined()
  })
})
