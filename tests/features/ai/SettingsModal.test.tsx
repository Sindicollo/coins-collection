/**
 * Tests for SettingsModal AI settings persistence.
 *
 * Regression coverage:
 * - the Save button must persist AI config (it used to save only the currency)
 * - per-provider search keys stay separate when switching providers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsModal } from '@/components/common/SettingsModal'
import type { LlmConfig } from '@shared/types'

function makeConfig(overrides: Partial<LlmConfig> = {}): LlmConfig {
  return {
    provider: 'openrouter',
    model: 'openai/gpt-4.1',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    enableWebSearch: true,
    search: { provider: 'tavily', apiKeys: {}, baseUrl: '', maxResults: 5 },
    ...overrides
  }
}

function renderModal(): void {
  render(
    <SettingsModal open currency="USD" onSaveCurrency={vi.fn()} onClose={vi.fn()} />
  )
}

describe('SettingsModal AI settings persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(window.api.llm.setConfig).mockResolvedValue()
  })

  it('persists the search API key when clicking Save', async () => {
    vi.mocked(window.api.llm.getConfig).mockResolvedValue(makeConfig())

    renderModal()
    fireEvent.click(screen.getByText('AI'))

    const keyInput = await screen.findByPlaceholderText('tvly-...')
    fireEvent.change(keyInput, { target: { value: 'tvly-secret' } })

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(window.api.llm.setConfig).toHaveBeenCalled()
    })

    expect(window.api.llm.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({
          provider: 'tavily',
          apiKeys: expect.objectContaining({ tavily: 'tvly-secret' })
        })
      })
    )
  })

  it('keeps per-provider search keys separate when switching provider', async () => {
    vi.mocked(window.api.llm.getConfig).mockResolvedValue(
      makeConfig({
        search: {
          provider: 'tavily',
          apiKeys: { tavily: 'tvly-aaa', brave: 'BSA-bbb' },
          baseUrl: '',
          maxResults: 5
        }
      })
    )

    renderModal()
    fireEvent.click(screen.getByText('AI'))

    // The active provider's key is shown
    expect(await screen.findByPlaceholderText('tvly-...')).toHaveValue('tvly-aaa')

    // The search provider select is the 2nd combobox (after the LLM provider select)
    const providerSelect = screen.getAllByRole('combobox')[1]

    // Switching to Brave shows its own key, not the Tavily one
    fireEvent.change(providerSelect, { target: { value: 'brave' } })
    expect(screen.getByPlaceholderText('BSA...')).toHaveValue('BSA-bbb')

    // Switching back preserves the Tavily key
    fireEvent.change(providerSelect, { target: { value: 'tavily' } })
    expect(screen.getByPlaceholderText('tvly-...')).toHaveValue('tvly-aaa')
  })
})
