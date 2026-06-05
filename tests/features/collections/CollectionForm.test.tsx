import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollectionForm } from '@/features/collections/CollectionForm'

describe('CollectionForm', () => {
  it('should render with empty input initially', () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()

    render(<CollectionForm onSubmit={onSubmit} onCancel={onCancel} />)

    const input = screen.getByLabelText('Collection name') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('should render with initial name', () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()

    render(<CollectionForm initialName="Russia" onSubmit={onSubmit} onCancel={onCancel} />)

    const input = screen.getByLabelText('Collection name') as HTMLInputElement
    expect(input.value).toBe('Russia')
  })

  it('should call onSubmit with trimmed value', () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()

    render(<CollectionForm onSubmit={onSubmit} onCancel={onCancel} />)

    const input = screen.getByLabelText('Collection name')
    fireEvent.change(input, { target: { value: '  France  ' } })
    fireEvent.click(screen.getByText('Create'))

    expect(onSubmit).toHaveBeenCalledWith('France')
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('should show error for empty name', () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()

    render(<CollectionForm onSubmit={onSubmit} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Create'))

    expect(screen.getByText('Collection name is required')).toBeDefined()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('should show error for too short name', () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()

    render(<CollectionForm onSubmit={onSubmit} onCancel={onCancel} />)

    const input = screen.getByLabelText('Collection name')
    fireEvent.change(input, { target: { value: 'A' } })
    fireEvent.click(screen.getByText('Create'))

    expect(screen.getByText('Collection name must be at least 2 characters')).toBeDefined()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('should call onCancel when cancel is clicked', () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()

    render(<CollectionForm onSubmit={onSubmit} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('should clear error when user types', () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()

    render(<CollectionForm onSubmit={onSubmit} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Create'))
    expect(screen.getByText('Collection name is required')).toBeDefined()

    const input = screen.getByLabelText('Collection name')
    fireEvent.change(input, { target: { value: 'Russia' } })

    expect(screen.queryByText('Collection name is required')).toBeNull()
  })

  it('should show custom submit label', () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()

    render(<CollectionForm onSubmit={onSubmit} onCancel={onCancel} submitLabel="Save" />)

    expect(screen.getByText('Save')).toBeDefined()
  })
})
