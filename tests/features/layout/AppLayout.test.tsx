/**
 * Unit tests for src/renderer/components/layout/AppLayout.tsx — the `<main>`
 * element must (un)register itself as THE app scroll container via the
 * `registerScrollContainer` ref, so `useScrollRestoration` reads from the
 * right element.
 *
 * Happy path: mount registers the main element.
 * Edge cases: unmount deregisters; the sidebar is NOT the scroll container.
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { AppLayout } from '@/components/layout/AppLayout'
import { getScrollContainer } from '@/lib/scrollContainer'

// Header pulls in ActionsDropdown etc. — not the subject of this test
vi.mock('@/components/layout/Header', () => ({
  Header: () => <header>Mocked Header</header>
}))

function renderLayout(): { unmount: () => void; main: HTMLElement } {
  const view = render(
    <AppLayout sidebar={<aside>Sidebar</aside>} onOpenSettings={vi.fn()}>
      <h1>Content</h1>
    </AppLayout>
  )
  const main = view.container.querySelector('main')
  if (!main) throw new Error('Expected <main> to be rendered')
  return { unmount: () => view.unmount(), main }
}

describe('AppLayout scroll container registration', () => {
  it('registers the <main> element as the scroll container on mount', () => {
    const { main } = renderLayout()

    expect(getScrollContainer()).toBe(main)

    // The sidebar must never be treated as the scroll container
    const sidebar = main.parentElement?.querySelector('aside')
    expect(getScrollContainer()).not.toBe(sidebar)
  })

  it('deregisters the scroll container on unmount', () => {
    const { unmount } = renderLayout()
    expect(getScrollContainer()).not.toBeNull()

    unmount()
    expect(getScrollContainer()).toBeNull()
  })

  it('re-registers a fresh main on remount', () => {
    const first = renderLayout()
    first.unmount()
    expect(getScrollContainer()).toBeNull()

    const second = renderLayout()
    expect(getScrollContainer()).toBe(second.main)

    second.unmount()
  })
})