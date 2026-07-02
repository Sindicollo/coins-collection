import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { BackupSection } from '@/features/backup/BackupSection'
import { useExportStore } from '@/features/export/useExport'
import { useExportPdfStore } from '@/features/export-pdf/useExportPdf'
import type { BackupPreview } from '@shared/types'

const mockPreview: BackupPreview = {
  manifest: {
    version: 1,
    appVersion: '1.4.0',
    exportedAt: 1719878400000,
    stats: { collections: 2, coins: 30, photos: 8 }
  },
  isNewerThanLocal: false,
  localStats: { collections: 2, coins: 30, photos: 8 }
}

function getExportButton(): HTMLElement {
  return screen.getByRole('button', { name: /Export Backup/ })
}

function getImportButton(): HTMLElement {
  return screen.getByRole('button', { name: /Import Backup/ })
}

describe('BackupSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset zustand stores
    useExportStore.setState({
      open: false,
      collections: [],
      selectedIds: [],
      includeSold: false,
      includeImages: true,
      progress: null,
      exporting: false,
      error: null
    })
    useExportPdfStore.setState({
      open: false,
      collections: [],
      selectedIds: [],
      includeSold: false,
      includeImages: true,
      includePurchaseInfo: false,
      progress: null,
      exporting: false,
      error: null
    })

    // Default mocks for backup API
    window.api.backup.exportExecute = vi.fn().mockResolvedValue('/tmp/backup.zip')
    window.api.backup.onExportProgress = vi.fn(() => vi.fn())
    window.api.backup.importSelect = vi.fn().mockResolvedValue('/tmp/backup.zip')
    window.api.backup.importPreview = vi.fn().mockResolvedValue(mockPreview)
    window.api.backup.importExecute = vi.fn().mockResolvedValue({
      success: true,
      imported: { collections: 2, coins: 30, photos: 8 },
      updated: { collections: 0, coins: 0, photos: 0 },
      errors: []
    })
    window.api.backup.onImportProgress = vi.fn(() => vi.fn())
  })

  // ── Rendering ──────────────────────────────────────────────

  it('renders title and section headers', () => {
    render(<BackupSection />)

    expect(screen.getByText('Actions with collections')).toBeDefined()
    expect(screen.getByText('Backup')).toBeDefined()
    expect(screen.getByText('Export Formats')).toBeDefined()
  })

  it('renders all action buttons', () => {
    render(<BackupSection />)

    expect(getExportButton()).toBeDefined()
    expect(getImportButton()).toBeDefined()
    // Buttons with emoji prepended — match by role with substring
    expect(screen.getByRole('button', { name: /Export to PDF/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /Export to Excel/ })).toBeDefined()
  })

  // ── Export flow ────────────────────────────────────────────

  it('opens progress modal when Export Backup is clicked', async () => {
    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getExportButton())
    })

    // Progress modal shows its title; Export Backup text appears on both
    // the button and the modal title
    expect(screen.getAllByText('Export Backup').length).toBeGreaterThanOrEqual(2)
  })

  it('calls backup.exportExecute when Export Backup is clicked', async () => {
    const spy = vi.mocked(window.api.backup.exportExecute)

    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getExportButton())
    })

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  it('subscribes to export progress events', async () => {
    const progressSpy = vi.mocked(window.api.backup.onExportProgress)

    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getExportButton())
    })

    expect(progressSpy).toHaveBeenCalledTimes(1)
    expect(progressSpy.mock.calls[0][0]).toBeTypeOf('function')
  })

  // ── Export error handling ──────────────────────────────────

  it('displays error when export fails', async () => {
    vi.mocked(window.api.backup.exportExecute).mockRejectedValue(
      new Error('Disk full')
    )

    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getExportButton())
    })

    await waitFor(() => {
      expect(screen.getByText('Disk full')).toBeDefined()
    })
  })

  it('displays default error fallback when export fails with empty message', async () => {
    // Reject with empty string so message becomes '' and falls back to t('backup.exportFailed')
    vi.mocked(window.api.backup.exportExecute).mockRejectedValue('')

    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getExportButton())
    })

    // Text comes from en.json (loaded via i18n.ts) — match via alert role
    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toMatch(/Failed to create backup/)
    })
  })

  it('dismisses error when close button is clicked', async () => {
    vi.mocked(window.api.backup.exportExecute).mockRejectedValue(
      new Error('Something went wrong')
    )

    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getExportButton())
    })

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeDefined()
    })

    // Click the dismiss × button (inside the error alert)
    const errorAlert = screen.getByRole('alert')
    const dismissBtn = errorAlert.querySelector('button')
    expect(dismissBtn).not.toBeNull()
    fireEvent.click(dismissBtn!)
    expect(screen.queryByText('Something went wrong')).toBeNull()
  })

  // ── Import flow ────────────────────────────────────────────

  it('opens import dialog when Import Backup is clicked', async () => {
    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getImportButton())
    })

    // After preview loads, dialog shows backup app version
    await waitFor(() => {
      expect(screen.getByText('1.4.0')).toBeDefined()
    })
  })

  it('calls backup.importPreview when a file is selected', async () => {
    const previewSpy = vi.mocked(window.api.backup.importPreview)

    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getImportButton())
    })

    await waitFor(() => {
      expect(previewSpy).toHaveBeenCalledWith('/tmp/backup.zip')
    })
  })

  it('calls backup.importExecute when import is confirmed', async () => {
    const executeSpy = vi.mocked(window.api.backup.importExecute)

    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getImportButton())
    })

    // Wait for dialog to appear with preview data
    await waitFor(() => {
      expect(screen.getByText('Import')).toBeDefined()
    })

    // Click Import in dialog
    await act(async () => {
      fireEvent.click(screen.getByText('Import'))
    })

    await waitFor(() => {
      expect(executeSpy).toHaveBeenCalledWith('/tmp/backup.zip')
    })
  })

  it('does nothing when import file selection is cancelled', async () => {
    vi.mocked(window.api.backup.importSelect).mockResolvedValue(null)

    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getImportButton())
    })

    // No dialog should appear
    expect(screen.queryByText('Import')).toBeNull()
  })

  // ── Import error handling ──────────────────────────────────

  it('displays error when import preview fails', async () => {
    vi.mocked(window.api.backup.importPreview).mockRejectedValue(
      new Error('Corrupted file')
    )

    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getImportButton())
    })

    await waitFor(() => {
      expect(screen.getByText('Corrupted file')).toBeDefined()
    })
  })

  it('displays default error fallback when import preview fails with empty message', async () => {
    vi.mocked(window.api.backup.importPreview).mockRejectedValue('')

    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getImportButton())
    })

    // Text comes from en.json — match via alert role
    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toMatch(/Failed to read backup file/)
    })
  })

  it('displays error when import execute returns errors', async () => {
    vi.mocked(window.api.backup.importExecute).mockResolvedValue({
      success: false,
      imported: { collections: 0, coins: 0, photos: 0 },
      updated: { collections: 0, coins: 0, photos: 0 },
      errors: ['Failed to import photo: abc.jpg', 'Duplicate coin skipped: 123']
    })

    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getImportButton())
    })

    await waitFor(() => {
      expect(screen.getByText('Import')).toBeDefined()
    })

    // Confirm import
    await act(async () => {
      fireEvent.click(screen.getByText('Import'))
    })

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to import photo: abc\.jpg/)
      ).toBeDefined()
    })
  })

  it('displays error when import execute rejects', async () => {
    vi.mocked(window.api.backup.importExecute).mockRejectedValue(
      new Error('Permission denied')
    )

    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getImportButton())
    })

    await waitFor(() => {
      expect(screen.getByText('Import')).toBeDefined()
    })

    // Confirm import
    await act(async () => {
      fireEvent.click(screen.getByText('Import'))
    })

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeDefined()
    })
  })

  // ── Progress modal interaction ─────────────────────────────

  it('closes progress modal when Cancel is clicked', async () => {
    // Keep export in-flight so progress stays open
    let resolveExport!: (value: unknown) => void
    vi.mocked(window.api.backup.exportExecute).mockImplementation(
      () => new Promise((r) => { resolveExport = r })
    )

    render(<BackupSection />)

    await act(async () => {
      fireEvent.click(getExportButton())
    })

    // After clicking, progress modal should be visible (shows Cancel button)
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeDefined()
    })

    // Click Cancel on the progress modal
    fireEvent.click(screen.getByText('Cancel'))

    // Modal should close (0% should be gone)
    await waitFor(() => {
      expect(screen.queryByText('0%')).toBeNull()
    })

    // Resolve so the pending export doesn't hang
    await act(async () => {
      resolveExport('/tmp/backup.zip')
    })
  })

  // ── mountedRef guard — no state updates after unmount ──────

  it('does not call setState after unmount during export (mountedRef guard)', async () => {
    // Capture the progress callback so we can fire it after unmount
    let progressCallback!: (data: { stage: string; current: number; total: number; message: string }) => void
    vi.mocked(window.api.backup.onExportProgress).mockImplementation((cb) => {
      progressCallback = cb
      return vi.fn()
    })

    // Keep the export promise unresolved
    let resolveExport!: (value: unknown) => void
    vi.mocked(window.api.backup.exportExecute).mockImplementation(
      () => new Promise((r) => { resolveExport = r })
    )

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { unmount } = render(<BackupSection />)

    // Click Export Backup
    await act(async () => {
      fireEvent.click(getExportButton())
    })

    // Unmount the component while export is in-flight
    unmount()

    // Fire progress callback after unmount — setState should be guarded by mountedRef
    await act(async () => {
      progressCallback({ stage: 'reading', current: 5, total: 10, message: 'Reading…' })
    })

    // Resolve the export promise — finally block should also check mountedRef
    await act(async () => {
      resolveExport('/tmp/backup.zip')
    })

    // Let pending timers flush (the finally block might schedule a setTimeout)
    await new Promise((r) => setTimeout(r, 100))

    // No React warnings about setState on unmounted component
    const reactWarnings = consoleErrorSpy.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.includes('setState')
    )

    expect(reactWarnings).toHaveLength(0)

    consoleErrorSpy.mockRestore()
  })

  it('does not call setState after unmount during import (mountedRef guard)', async () => {
    // Capture the progress callback
    let importProgressCallback!: (data: { stage: string; current: number; total: number; message: string }) => void
    vi.mocked(window.api.backup.onImportProgress).mockImplementation((cb) => {
      importProgressCallback = cb
      return vi.fn()
    })

    // Keep the import promise unresolved
    let resolveImport!: (value: unknown) => void
    vi.mocked(window.api.backup.importExecute).mockImplementation(
      () => new Promise((r) => { resolveImport = r })
    )

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { unmount } = render(<BackupSection />)

    // Click Import Backup → opens dialog
    await act(async () => {
      fireEvent.click(getImportButton())
    })

    await waitFor(() => {
      expect(screen.getByText('Import')).toBeDefined()
    })

    // Click Import in dialog → starts import, registers progress callback
    await act(async () => {
      fireEvent.click(screen.getByText('Import'))
    })

    // Unmount while import is in-flight
    unmount()

    // Fire progress callback after unmount — guarded by mountedRef
    await act(async () => {
      importProgressCallback({ stage: 'extracting', current: 0, total: 1, message: 'Extracting…' })
    })

    // Resolve the import
    await act(async () => {
      resolveImport({
        success: true,
        imported: { collections: 2, coins: 30, photos: 8 },
        updated: { collections: 0, coins: 0, photos: 0 },
        errors: []
      })
    })

    // Let pending timers flush
    await new Promise((r) => setTimeout(r, 100))

    // No React warnings about setState on unmounted component
    const reactWarnings = consoleErrorSpy.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.includes('setState')
    )

    expect(reactWarnings).toHaveLength(0)

    consoleErrorSpy.mockRestore()
  })

  // ── Export format buttons ──────────────────────────────────

  it('opens PDF export dialog when Export to PDF is clicked', () => {
    const spy = vi.spyOn(useExportPdfStore.getState(), 'openDialog')

    render(<BackupSection />)

    fireEvent.click(screen.getByRole('button', { name: /Export to PDF/ }))

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('opens Excel export dialog when Export to Excel is clicked', () => {
    const spy = vi.spyOn(useExportStore.getState(), 'openDialog')

    render(<BackupSection />)

    fireEvent.click(screen.getByRole('button', { name: /Export to Excel/ }))

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
