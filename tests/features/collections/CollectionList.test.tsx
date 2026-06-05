import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollectionList } from '@/features/collections/CollectionList'
import type { Collection } from '@shared/types'

const mockCollections: Collection[] = [
  { id: '1', name: 'Russia', createdAt: 1000, updatedAt: 1000 },
  { id: '2', name: 'USA', createdAt: 2000, updatedAt: 2000 },
  { id: '3', name: 'Germany', createdAt: 3000, updatedAt: 3000 }
]

describe('CollectionList', () => {
  it('should render all collections', () => {
    render(
      <CollectionList
        collections={mockCollections}
        selectedId={null}
        loading={false}
        error={null}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText('Russia')).toBeDefined()
    expect(screen.getByText('USA')).toBeDefined()
    expect(screen.getByText('Germany')).toBeDefined()
  })

  it('should show loading skeletons', () => {
    render(
      <CollectionList
        collections={[]}
        selectedId={null}
        loading={true}
        error={null}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('should show error message', () => {
    render(
      <CollectionList
        collections={[]}
        selectedId={null}
        loading={false}
        error="collections.errors.loadFailed"
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText('Failed to load collections')).toBeDefined()
  })

  it('should show empty state when no collections', () => {
    render(
      <CollectionList
        collections={[]}
        selectedId={null}
        loading={false}
        error={null}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText('No collections yet.')).toBeDefined()
  })

  it('should highlight selected collection', () => {
    render(
      <CollectionList
        collections={mockCollections}
        selectedId="2"
        loading={false}
        error={null}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const usaItem = screen.getByText('USA').closest('div')
    expect(usaItem?.className).toContain('bg-primary-100')
  })

  it('should call onSelect when clicking a collection', () => {
    const onSelect = vi.fn()

    render(
      <CollectionList
        collections={mockCollections}
        selectedId={null}
        loading={false}
        error={null}
        onSelect={onSelect}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Russia'))
    expect(onSelect).toHaveBeenCalledWith('1')
  })
})
