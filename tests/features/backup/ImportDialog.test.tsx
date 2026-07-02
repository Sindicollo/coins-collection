import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImportDialog } from '@/features/backup/ImportDialog'
import type { BackupPreview } from '@shared/types'

const mockPreview: BackupPreview = {
  manifest: {
    version: 1,
    appVersion: '1.4.0',
    exportedAt: 1719878400000,
    stats: { collections: 3, coins: 45, photos: 12 }
  },
  isNewerThanLocal: false,
  localStats: { collections: 2, coins: 30, photos: 8 }
}

describe('ImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state when preview is null', () => {
    render(
      <ImportDialog
        open={true}
        preview={null}
        onImport={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Loading preview…')).toBeDefined()
  })

  it('shows backup metadata when preview is provided', () => {
    render(
      <ImportDialog
        open={true}
        preview={mockPreview}
        onImport={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Date:')).toBeDefined()
    expect(screen.getByText('1.4.0')).toBeDefined()
  })

  it('renders stats comparison columns', () => {
    render(
      <ImportDialog
        open={true}
        preview={mockPreview}
        onImport={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Collections')).toBeDefined()
    expect(screen.getByText('Coins')).toBeDefined()
    expect(screen.getByText('Photos')).toBeDefined()

    // Backup stats
    const backupCells = screen.getAllByText('45')
    expect(backupCells.length).toBeGreaterThanOrEqual(1)

    // Current stats
    const currentCells = screen.getAllByText('30')
    expect(currentCells.length).toBeGreaterThanOrEqual(1)
  })

  it('renders warning message', () => {
    render(
      <ImportDialog
        open={true}
        preview={mockPreview}
        onImport={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/Existing records will be updated/)).toBeDefined()
  })

  it('calls onImport when Import button is clicked', () => {
    const onImport = vi.fn()

    render(
      <ImportDialog
        open={true}
        preview={mockPreview}
        onImport={onImport}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Import'))
    expect(onImport).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn()

    render(
      <ImportDialog
        open={true}
        preview={mockPreview}
        onImport={vi.fn()}
        onCancel={onCancel}
      />
    )

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when dialog is closed', () => {
    const { container } = render(
      <ImportDialog
        open={false}
        preview={null}
        onImport={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(container.innerHTML).toBe('')
  })

  it('handles missing localStats gracefully', () => {
    const previewWithoutLocal: BackupPreview = {
      ...mockPreview,
      localStats: null
    }

    render(
      <ImportDialog
        open={true}
        preview={previewWithoutLocal}
        onImport={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    // Should still render backup stats
    expect(screen.getByText('45')).toBeDefined()
    // Should not show "Current" column header
    expect(screen.queryByText('Current')).toBeNull()
  })
})
