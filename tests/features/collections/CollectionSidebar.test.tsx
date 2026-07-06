import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CollectionSidebar } from '@/features/collections/CollectionSidebar'
import type { Collection } from '@shared/types'

const mockCollections: Collection[] = [
  { id: '1', name: 'Russia', createdAt: 1000, updatedAt: 1000 },
  { id: '2', name: 'USA', createdAt: 2000, updatedAt: 2000 }
]

const mockActions = {
  collections: mockCollections,
  selectedId: '1',
  loading: false,
  error: null,
  selectCollection: vi.fn(),
  addCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  loadCollections: vi.fn()
}

vi.mock('@/features/collections/useCollections', () => ({
  useCollectionManager: () => mockActions
}))

vi.mock('@/features/collections/CollectionList', () => ({
  CollectionList: vi.fn(({ onEdit, onDelete }) => (
    <div data-testid="collection-list">
      <button data-testid="edit-btn" onClick={() => onEdit(mockCollections[0])}>edit</button>
      <button data-testid="delete-btn" onClick={() => onDelete(mockCollections[0])}>delete</button>
    </div>
  ))
}))

describe('CollectionSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderSidebar(): ReturnType<typeof render> {
    return render(
      <MemoryRouter>
        <CollectionSidebar />
      </MemoryRouter>
    )
  }

  // --- Happy path: initial render ---

  it('renders the header and add button', () => {
    renderSidebar()

    expect(screen.getByText('Collections')).toBeInTheDocument()
    expect(screen.getByText('Add Collection')).toBeInTheDocument()
    expect(screen.getByTestId('collection-list')).toBeInTheDocument()
  })

  // --- Happy path: show add form ---

  it('shows add form when "Add Collection" button is clicked', () => {
    renderSidebar()

    fireEvent.click(screen.getByText('Add Collection'))

    expect(screen.getByPlaceholderText('Collection name...')).toBeInTheDocument()
    expect(screen.getByText('Add')).toBeInTheDocument()
  })

  // --- Happy path: add collection submits with name ---

  it('calls addCollection with trimmed name when Add is clicked', () => {
    renderSidebar()

    fireEvent.click(screen.getByText('Add Collection'))

    const input = screen.getByPlaceholderText('Collection name...') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  New Collection   ' } })
    fireEvent.click(screen.getByText('Add'))

    expect(mockActions.addCollection).toHaveBeenCalledWith('New Collection')
  })

  // --- Edge case: empty name does not call addCollection ---

  it('does not call addCollection when name is empty or whitespace', () => {
    renderSidebar()

    fireEvent.click(screen.getByText('Add Collection'))

    const input = screen.getByPlaceholderText('Collection name...') as HTMLInputElement
    fireEvent.change(input, { target: { value: '   ' } })

    // Add button is disabled
    const addBtn = screen.getByText('Add').closest('button')
    expect(addBtn).toBeDisabled()

    // Even if we try to add by keyboard, handleAdd checks trim()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockActions.addCollection).not.toHaveBeenCalled()
  })

  // --- Edge case: delete confirmation modal ---

  it('shows delete modal and calls deleteCollection on confirm', () => {
    renderSidebar()

    // Trigger delete from the mocked CollectionList
    fireEvent.click(screen.getByTestId('delete-btn'))

    // Modal should appear
    expect(screen.getByText('Delete Collection')).toBeInTheDocument()
    expect(screen.getByText(/Are you sure/i)).toBeInTheDocument()

    // Confirm deletion
    fireEvent.click(screen.getByText('Delete'))

    expect(mockActions.deleteCollection).toHaveBeenCalledWith('1')
  })

  // --- Edge case: cancel delete ---

  it('closes delete modal without calling deleteCollection', () => {
    renderSidebar()

    fireEvent.click(screen.getByTestId('delete-btn'))
    expect(screen.getByText('Delete Collection')).toBeInTheDocument()

    // Click Cancel in the modal
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    const modalTitle = screen.queryByText('Delete Collection')
    expect(modalTitle).not.toBeInTheDocument()
    expect(mockActions.deleteCollection).not.toHaveBeenCalled()
  })

  // --- Edge case: edit panel opens ---

  it('opens edit panel when edit button is clicked', () => {
    renderSidebar()

    fireEvent.click(screen.getByTestId('edit-btn'))

    expect(screen.getByDisplayValue('Russia')).toBeInTheDocument()
    expect(screen.getByText('Rename')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  // --- Edge case: Escape key closes add form ---

  it('closes add form on Escape key', () => {
    renderSidebar()

    fireEvent.click(screen.getByText('Add Collection'))
    expect(screen.getByPlaceholderText('Collection name...')).toBeInTheDocument()

    const input = screen.getByPlaceholderText('Collection name...')
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByPlaceholderText('Collection name...')).not.toBeInTheDocument()
  })
})
