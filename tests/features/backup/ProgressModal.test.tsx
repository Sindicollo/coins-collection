import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProgressModal, type ProgressData } from '@/features/backup/ProgressModal'

describe('ProgressModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <ProgressModal
        open={false}
        title="Export"
        progress={null}
        onCancel={vi.fn()}
      />
    )

    expect(container.innerHTML).toBe('')
  })

  it('shows title and progress message when open', () => {
    const progress: ProgressData = {
      stage: 'reading',
      current: 5,
      total: 10,
      message: 'Reading data…'
    }

    render(
      <ProgressModal
        open={true}
        title="Export Backup"
        progress={progress}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Export Backup')).toBeDefined()
    expect(screen.getByText('Reading data…')).toBeDefined()
  })

  it('renders progress bar with correct width', () => {
    const progress: ProgressData = {
      stage: 'reading',
      current: 30,
      total: 100,
      message: '30%'
    }

    render(
      <ProgressModal
        open={true}
        title="Export"
        progress={progress}
        onCancel={vi.fn()}
      />
    )

    const bar = document.querySelector('[role="progressbar"]')
    expect(bar).toBeDefined()

    const inner = bar?.querySelector('div')
    expect(inner).toBeDefined()
    expect(inner?.getAttribute('style')).toContain('30%')
  })

  it('shows percentage text', () => {
    const progress: ProgressData = {
      stage: 'reading',
      current: 7,
      total: 10,
      message: 'Processing'
    }

    render(
      <ProgressModal
        open={true}
        title="Export"
        progress={progress}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('70%')).toBeDefined()
  })

  it('shows cancel button when progress is active (not done)', () => {
    const progress: ProgressData = {
      stage: 'reading',
      current: 1,
      total: 5,
      message: 'Working…'
    }

    render(
      <ProgressModal
        open={true}
        title="Export"
        progress={progress}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Cancel')).toBeDefined()
    expect(screen.queryByText('Close')).toBeNull()
  })

  it('shows close button when progress is done', () => {
    const progress: ProgressData = {
      stage: 'done',
      current: 1,
      total: 1,
      message: 'Done!'
    }

    render(
      <ProgressModal
        open={true}
        title="Export"
        progress={progress}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Close')).toBeDefined()
    expect(screen.queryByText('Cancel')).toBeNull()
  })

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn()
    const progress: ProgressData = {
      stage: 'reading',
      current: 1,
      total: 5,
      message: 'Working…'
    }

    render(
      <ProgressModal
        open={true}
        title="Export"
        progress={progress}
        onCancel={onCancel}
      />
    )

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Close button is clicked', () => {
    const onCancel = vi.fn()
    const progress: ProgressData = {
      stage: 'done',
      current: 1,
      total: 1,
      message: 'Done!'
    }

    render(
      <ProgressModal
        open={true}
        title="Export"
        progress={progress}
        onCancel={onCancel}
      />
    )

    fireEvent.click(screen.getByText('Close'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('shows fallback label for unknown stage', () => {
    const progress: ProgressData = {
      stage: 'unknown-stage',
      current: 0,
      total: 1,
      message: ''
    }

    render(
      <ProgressModal
        open={true}
        title="Export"
        progress={progress}
        onCancel={vi.fn()}
      />
    )

    // Falls back to stage name translated (i18n key fallback)
    expect(screen.getByText('unknown-stage')).toBeDefined()
  })

  it('shows 0% when progress is null', () => {
    render(
      <ProgressModal
        open={true}
        title="Export"
        progress={null}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('0%')).toBeDefined()
  })

  it('clamps percentage to 100', () => {
    const progress: ProgressData = {
      stage: 'done',
      current: 200,
      total: 100,
      message: 'Overflow'
    }

    render(
      <ProgressModal
        open={true}
        title="Export"
        progress={progress}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('100%')).toBeDefined()
  })
})
