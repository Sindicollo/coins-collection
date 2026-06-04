import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePhotoStore } from '@/features/photos/usePhotos'
import type { Photo } from '@shared/types'

const mockPhoto: Photo = {
  id: 'p1',
  coinId: 'c1',
  filename: 'abc123.jpg',
  originalName: 'photo.jpg',
  position: 0,
  createdAt: 1000
}

const mockPhoto2: Photo = {
  id: 'p2',
  coinId: 'c1',
  filename: 'def456.jpg',
  originalName: 'photo2.jpg',
  position: 1,
  createdAt: 2000
}

describe('usePhotos store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store before each test
    usePhotoStore.setState({
      photos: [],
      loading: false,
      error: null
    })
  })

  it('starts with empty state', () => {
    const state = usePhotoStore.getState()
    expect(state.photos).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('loadPhotos fetches and sets photos', async () => {
    window.api.photos.list = vi.fn().mockResolvedValue([mockPhoto, mockPhoto2])

    await usePhotoStore.getState().loadPhotos('c1')

    const state = usePhotoStore.getState()
    expect(state.photos).toEqual([mockPhoto, mockPhoto2])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(window.api.photos.list).toHaveBeenCalledWith('c1')
  })

  it('loadPhotos sets error on failure', async () => {
    window.api.photos.list = vi.fn().mockRejectedValue(new Error('Test error'))

    await usePhotoStore.getState().loadPhotos('c1')

    const state = usePhotoStore.getState()
    expect(state.photos).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBe('Error: Test error')
  })

  it('loadPhotos sets loading to true while fetching', async () => {
    window.api.photos.list = vi.fn().mockResolvedValue([])
    const promise = usePhotoStore.getState().loadPhotos('c1')
    expect(usePhotoStore.getState().loading).toBe(true)
    await promise
    expect(usePhotoStore.getState().loading).toBe(false)
  })

  it('uploadPhoto adds photo on success', async () => {
    vi.mocked(window.api.photos.create).mockResolvedValue([mockPhoto])
    // Start with existing photo
    usePhotoStore.setState({ photos: [] })

    await usePhotoStore.getState().uploadPhoto('c1')

    const state = usePhotoStore.getState()
    expect(state.photos).toEqual([mockPhoto])
    expect(state.error).toBeNull()
    expect(window.api.photos.create).toHaveBeenCalledWith('c1')
  })

  it('uploadPhoto does nothing when cancelled', async () => {
    vi.mocked(window.api.photos.create).mockResolvedValue([])

    await usePhotoStore.getState().uploadPhoto('c1')

    expect(usePhotoStore.getState().photos).toEqual([])
  })

  it('uploadPhoto sets error on failure', async () => {
    vi.mocked(window.api.photos.create).mockRejectedValue(new Error('Upload error'))

    await usePhotoStore.getState().uploadPhoto('c1')

    expect(usePhotoStore.getState().error).toBe('Error: Upload error')
  })

  it('uploadPhoto adds multiple photos', async () => {
    vi.mocked(window.api.photos.create).mockResolvedValue([mockPhoto, mockPhoto2])
    usePhotoStore.setState({ photos: [] })

    await usePhotoStore.getState().uploadPhoto('c1')

    const state = usePhotoStore.getState()
    expect(state.photos).toEqual([mockPhoto, mockPhoto2])
  })

  it('deletePhoto removes photo from state', async () => {
    window.api.photos.delete = vi.fn().mockResolvedValue(true)
    usePhotoStore.setState({ photos: [mockPhoto, mockPhoto2] })

    await usePhotoStore.getState().deletePhoto('p1')

    const state = usePhotoStore.getState()
    expect(state.photos).toEqual([mockPhoto2])
    expect(state.error).toBeNull()
    expect(window.api.photos.delete).toHaveBeenCalledWith('p1')
  })

  it('reset clears state', () => {
    usePhotoStore.setState({
      photos: [mockPhoto],
      loading: true,
      error: 'err'
    })

    usePhotoStore.getState().reset()

    const state = usePhotoStore.getState()
    expect(state.photos).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })
})
