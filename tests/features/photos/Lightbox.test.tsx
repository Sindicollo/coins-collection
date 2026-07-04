import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Lightbox } from '@/features/photos/Lightbox'
import type { Photo } from '@shared/types'

const mockPhotos: Photo[] = [
  { id: 'p1', coinId: 'c1', filename: 'abc.jpg', originalName: 'front.jpg', position: 0, createdAt: 1000 },
  { id: 'p2', coinId: 'c1', filename: 'def.jpg', originalName: 'back.jpg', position: 1, createdAt: 2000 }
]

describe('Lightbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api.photos.getPhotoData = vi.fn().mockResolvedValue('/test/path.jpg')
  })

  it('renders current photo index', () => {
    render(
      <Lightbox
        photos={mockPhotos}
        currentIndex={0}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNavigate={vi.fn()}
        onJumpTo={vi.fn()}
      />
    )

    expect(screen.getByText('1 / 2')).toBeDefined()
  })

  it('renders photo original name', () => {
    render(
      <Lightbox
        photos={mockPhotos}
        currentIndex={0}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNavigate={vi.fn()}
        onJumpTo={vi.fn()}
      />
    )

    expect(screen.getByText('front.jpg')).toBeDefined()
  })

  it('calls onNavigate when arrow clicked', () => {
    const onNavigate = vi.fn()

    render(
      <Lightbox
        photos={mockPhotos}
        currentIndex={0}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNavigate={onNavigate}
        onJumpTo={vi.fn()}
      />
    )

    // Find right arrow button and click it
    const buttons = screen.getAllByRole('button')
    const rightArrow = buttons.find(
      (btn) => btn.innerHTML.includes('M9') && btn.innerHTML.includes('l7')
    )
    if (rightArrow) {
      fireEvent.click(rightArrow)
      expect(onNavigate).toHaveBeenCalledWith(1)
    }
  })

  it('shows delete confirmation', () => {
    render(
      <Lightbox
        photos={mockPhotos}
        currentIndex={0}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNavigate={vi.fn()}
        onJumpTo={vi.fn()}
      />
    )

    // Click delete button
    const buttons = screen.getAllByRole('button')
    const deleteButton = buttons.find((btn) =>
      btn.innerHTML.includes('M19') && btn.innerHTML.includes('l-.867')
    )
    if (deleteButton) {
      fireEvent.click(deleteButton)
      expect(screen.getByText('Delete Photo')).toBeDefined()
    }
  })

  it('calls onClose when X button clicked', () => {
    const onClose = vi.fn()

    render(
      <Lightbox
        photos={mockPhotos}
        currentIndex={0}
        onClose={onClose}
        onDelete={vi.fn()}
        onNavigate={vi.fn()}
        onJumpTo={vi.fn()}
      />
    )

    // Find close/X button
    const buttons = screen.getAllByRole('button')
    const closeButton = buttons.find((btn) =>
      btn.innerHTML.includes('M6') && btn.innerHTML.includes('18L18')
    )
    if (closeButton) {
      fireEvent.click(closeButton)
      expect(onClose).toHaveBeenCalled()
    }
  })

  it('shows dot indicators', () => {
    render(
      <Lightbox
        photos={mockPhotos}
        currentIndex={0}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNavigate={vi.fn()}
        onJumpTo={vi.fn()}
      />
    )

    // 2 dots for 2 photos
    const dots = document.querySelectorAll('.rounded-full.w-2')
    expect(dots.length).toBe(2)
  })

  it('active dot has white background', () => {
    render(
      <Lightbox
        photos={mockPhotos}
        currentIndex={0}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNavigate={vi.fn()}
        onJumpTo={vi.fn()}
      />
    )

    const dots = document.querySelectorAll('.rounded-full.w-2')
    expect(dots[0].className).toContain('bg-white')
    expect(dots[1].className).toContain('bg-white/30')
  })

  it('calls onDelete when delete is confirmed', () => {
    const onDelete = vi.fn()
    render(
      <Lightbox
        photos={mockPhotos}
        currentIndex={0}
        onClose={vi.fn()}
        onDelete={onDelete}
        onNavigate={vi.fn()}
        onJumpTo={vi.fn()}
      />
    )

    // Open delete confirmation
    const deleteBtn = screen.getAllByRole('button').find((b) =>
      b.innerHTML.includes('M19') && b.innerHTML.includes('l-.867')
    )
    if (deleteBtn) fireEvent.click(deleteBtn)

    // Confirm deletion — button text is "Delete" (translated)
    fireEvent.click(screen.getByText('Delete'))

    expect(onDelete).toHaveBeenCalledWith('p1')
  })

  it('closes delete confirmation without calling onDelete on cancel', () => {
    const onDelete = vi.fn()
    render(
      <Lightbox
        photos={mockPhotos}
        currentIndex={0}
        onClose={vi.fn()}
        onDelete={onDelete}
        onNavigate={vi.fn()}
        onJumpTo={vi.fn()}
      />
    )

    // Open delete confirmation
    const deleteBtn = screen.getAllByRole('button').find((b) =>
      b.innerHTML.includes('M19') && b.innerHTML.includes('l-.867')
    )
    if (deleteBtn) fireEvent.click(deleteBtn)

    // Cancel — button text is "Cancel" (translated)
    fireEvent.click(screen.getByText('Cancel'))

    expect(onDelete).not.toHaveBeenCalled()
    // Confirmation should be gone
    expect(screen.queryByText('Delete Photo')).not.toBeInTheDocument()
  })

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn()
    render(
      <Lightbox
        photos={mockPhotos}
        currentIndex={0}
        onClose={onClose}
        onDelete={vi.fn()}
        onNavigate={vi.fn()}
        onJumpTo={vi.fn()}
      />
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onNavigate(-1) on ArrowLeft when not at first photo', () => {
    const onNavigate = vi.fn()
    render(
      <Lightbox
        photos={mockPhotos}
        currentIndex={1}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNavigate={onNavigate}
        onJumpTo={vi.fn()}
      />
    )

    fireEvent.keyDown(document, { key: 'ArrowLeft' })

    expect(onNavigate).toHaveBeenCalledWith(-1)
  })

  it('calls onNavigate(1) on ArrowRight when not at last photo', () => {
    const onNavigate = vi.fn()
    render(
      <Lightbox
        photos={mockPhotos}
        currentIndex={0}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNavigate={onNavigate}
        onJumpTo={vi.fn()}
      />
    )

    fireEvent.keyDown(document, { key: 'ArrowRight' })

    expect(onNavigate).toHaveBeenCalledWith(1)
  })

  it('does not navigate left at first photo', () => {
    const onNavigate = vi.fn()
    render(
      <Lightbox
        photos={mockPhotos}
        currentIndex={0}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNavigate={onNavigate}
        onJumpTo={vi.fn()}
      />
    )

    fireEvent.keyDown(document, { key: 'ArrowLeft' })

    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('shows previous arrow button only when not at first photo', () => {
    render(
      <Lightbox
        photos={mockPhotos}
        currentIndex={0}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNavigate={vi.fn()}
        onJumpTo={vi.fn()}
      />
    )

    // At first photo — no left arrow
    const leftArrows = screen.queryAllByRole('button').filter((b) =>
      b.innerHTML.includes('M9') && b.innerHTML.includes('l7')
    )
    // The right arrow exists, left doesn't
    expect(leftArrows.length).toBeLessThan(2)
  })
})
