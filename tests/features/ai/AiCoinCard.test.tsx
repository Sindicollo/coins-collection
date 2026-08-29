import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AiCoinCard } from '@/features/ai/AiCoinCard'
import { clearPhotoDataCache } from '@/features/photos/photoDataCache'
import type { Coin, LlmErrorInfo, Photo } from '@shared/types'

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

describe('AiCoinCard photo thumbnails', () => {
  function makePhoto(id: string, position: number): Photo {
    return { id, coinId: 'coin-1', filename: `${id}.jpg`, originalName: null, position, createdAt: 1 }
  }

  it('renders image thumbnails from the photo cache', async () => {
    // Unique coin id so the module-level cache is empty for this test
    const coinWithPhotos = { ...coin, id: 'photo-coin-1' }
    vi.mocked(window.api.photos.list).mockResolvedValue([
      makePhoto('p1', 0),
      makePhoto('p2', 1)
    ])
    vi.mocked(window.api.photos.getPhotoData).mockResolvedValue('data:image/jpeg;base64,AAAA')

    render(
      <MemoryRouter>
        <AiCoinCard
          coin={coinWithPhotos}
          aiResult={undefined}
          loading={false}
          perCoinLoading={false}
          onQuerySingle={vi.fn()}
          onAppendToNotes={vi.fn()}
          onClearResult={vi.fn()}
        />
      </MemoryRouter>
    )

    await waitFor(() => {
      const imgs = document.querySelectorAll('img')
      expect(imgs.length).toBe(2)
    })
    const imgs = Array.from(document.querySelectorAll('img'))
    expect(imgs.every((img) => img.src.startsWith('data:image/'))).toBe(true)

    clearPhotoDataCache()
  })

  it('shows a placeholder (no crash) when the coin has no photos', async () => {
    const noPhotoCoin = { ...coin, id: 'empty-photo-coin' }
    vi.mocked(window.api.photos.list).mockResolvedValue([])

    render(
      <MemoryRouter>
        <AiCoinCard
          coin={noPhotoCoin}
          aiResult={undefined}
          loading={false}
          perCoinLoading={false}
          onQuerySingle={vi.fn()}
          onAppendToNotes={vi.fn()}
          onClearResult={vi.fn()}
        />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(document.querySelectorAll('img').length).toBe(0)
    })
    // Skeleton turns into the empty-state box once loading finishes
    expect(document.querySelector('.animate-pulse')).toBeNull()

    clearPhotoDataCache()
  })

  it('falls back to the placeholder when the photo list fails to load', async () => {
    const failCoin = { ...coin, id: 'fail-photo-coin' }
    vi.mocked(window.api.photos.list).mockRejectedValue(new Error('IPC failed'))

    render(
      <MemoryRouter>
        <AiCoinCard
          coin={failCoin}
          aiResult={undefined}
          loading={false}
          perCoinLoading={false}
          onQuerySingle={vi.fn()}
          onAppendToNotes={vi.fn()}
          onClearResult={vi.fn()}
        />
      </MemoryRouter>
    )

    await waitFor(() => {
      // The catch sets photosLoaded without throwing up to the tree
      expect(document.querySelectorAll('img').length).toBe(0)
    })

    clearPhotoDataCache()
  })
})
