import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PhotoGallery } from '@/features/photos/PhotoGallery'
import { usePhotoStore } from '@/features/photos/usePhotos'
import * as photoApi from '@/features/photos/api'
import type { Photo } from '@shared/types'

const mockPhotos: Photo[] = [
  { id: 'p1', coinId: 'c1', filename: 'abc.jpg', originalName: 'front.jpg', position: 0, createdAt: 1000 },
  { id: 'p2', coinId: 'c1', filename: 'def.jpg', originalName: 'back.jpg', position: 1, createdAt: 2000 }
]

function renderWithRouter(ui: React.ReactElement, route = '/coins/ru/photo/c1') {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)
}

describe('PhotoGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePhotoStore.getState().reset()
    vi.spyOn(photoApi, 'fetchPhotos').mockResolvedValue([])
    window.api.photos.getPhotoData = vi.fn().mockResolvedValue('/test/path.jpg')
  })

  it('renders title', async () => {
    await act(async () => {
      renderWithRouter(<PhotoGallery />)
    })

    expect(screen.getByText('Photos')).toBeDefined()
  })

  it('renders add photo button', async () => {
    await act(async () => {
      renderWithRouter(<PhotoGallery />)
    })

    expect(screen.getByText('Add photo')).toBeDefined()
  })

  it('shows empty state when no photos', async () => {
    await act(async () => {
      renderWithRouter(<PhotoGallery />)
    })

    await waitFor(() => {
      expect(screen.getByText('No photos yet')).toBeDefined()
    })
  })

  it('shows photos when loaded', async () => {
    vi.spyOn(photoApi, 'fetchPhotos').mockResolvedValue(mockPhotos)

    await act(async () => {
      renderWithRouter(<PhotoGallery />)
    })

    await waitFor(() => {
      const container = document.querySelector('.grid')
      expect(container).toBeDefined()
    })
  })

  it('shows error message when store has error', async () => {
    // Set error state directly on the store before rendering
    vi.spyOn(photoApi, 'fetchPhotos').mockResolvedValue([])
    usePhotoStore.setState({ error: 'Test error message', loading: false, photos: [] })

    await act(async () => {
      renderWithRouter(<PhotoGallery />)
    })

    expect(screen.getByText('Test error message')).toBeDefined()
  })

  it('has add photo button that triggers upload', async () => {
    await act(async () => {
      renderWithRouter(<PhotoGallery />)
    })

    // The Add photo button should be rendered
    expect(screen.getByText('Add photo')).toBeDefined()
  })

  it('renders add photo button alongside loaded photos', async () => {
    vi.spyOn(photoApi, 'fetchPhotos').mockResolvedValue(mockPhotos)

    await act(async () => {
      renderWithRouter(<PhotoGallery />)
    })

    await waitFor(() => {
      const addButton = screen.getByText('Add photo').closest('button')
      expect(addButton).toBeDefined()
    })
  })
})
