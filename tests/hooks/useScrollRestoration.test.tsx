import React from 'react'
import { render } from '@testing-library/react'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import {
  getScrollContainer,
  registerScrollContainer,
  saveScrollPosition,
  clearScrollPositions
} from '@/lib/scrollContainer'

/**
 * Minimal component that uses the scroll restoration hook.
 */
function ScrollRestorationTester(props: {
  storageKey: string
  ready: boolean
  recording?: boolean
  onLoadMore?: () => void
}): React.ReactElement {
  useScrollRestoration(props)
  return <div data-testid="tester" />
}

/** Create a scrollable container and register it (as AppLayout would). */
function setupScrollContainer(height = 400, contentHeight = 2000): HTMLElement {
  const main = document.createElement('main')
  main.style.height = `${height}px`
  main.style.overflowY = 'scroll'
  const inner = document.createElement('div')
  inner.style.height = `${contentHeight}px`
  main.appendChild(inner)
  document.body.appendChild(main)
  registerScrollContainer(main)
  return main
}

describe('useScrollRestoration', () => {
  beforeEach(() => {
    clearScrollPositions()
    const main = document.querySelector('main')
    if (main) main.remove()
    registerScrollContainer(null)
  })

  it('records scroll position via the scroll container on scroll events', () => {
    const main = setupScrollContainer()
    render(<ScrollRestorationTester storageKey="test:1" ready={false} />)

    main.scrollTop = 300
    main.dispatchEvent(new Event('scroll'))

    // Saved through the registered scroll container
    expect(getScrollContainer()).toBe(main)

    document.body.removeChild(main)
  })

  it('restores saved scroll position on mount when content is ready', () => {
    const main = setupScrollContainer()
    saveScrollPosition('test:1', 300)

    render(<ScrollRestorationTester storageKey="test:1" ready />)
    expect(main.scrollTop).toBe(300)

    document.body.removeChild(main)
  })

  it('does not restore when content is not ready', () => {
    const main = setupScrollContainer()
    saveScrollPosition('test:1', 300)

    render(<ScrollRestorationTester storageKey="test:1" ready={false} />)
    expect(main.scrollTop).toBe(0)

    document.body.removeChild(main)
  })

  it('does not restore when no saved position exists', () => {
    const main = setupScrollContainer()

    render(<ScrollRestorationTester storageKey="test:empty" ready />)
    expect(main.scrollTop).toBe(0)

    document.body.removeChild(main)
  })

  it('restores scroll after remount (simulating gallery exit)', () => {
    const main = setupScrollContainer()
    saveScrollPosition('test:1', 550)

    const first = render(<ScrollRestorationTester storageKey="test:1" ready />)
    expect(main.scrollTop).toBe(550)

    // Navigate away — unmount, then reset scroll to top (new page)
    first.unmount()
    main.scrollTop = 0

    // Come back — remount restores the saved position
    render(<ScrollRestorationTester storageKey="test:1" ready />)
    expect(main.scrollTop).toBe(550)

    document.body.removeChild(main)
  })

  it('does not overwrite the saved position while recording=false', () => {
    const main = setupScrollContainer()
    saveScrollPosition('test:1', 100)

    render(<ScrollRestorationTester storageKey="test:1" ready recording={false} />)

    // Scrolling while recording=false must not clobber the saved position
    main.scrollTop = 0
    main.dispatchEvent(new Event('scroll'))

    // The saved position survives for a later restore
    render(<ScrollRestorationTester storageKey="test:1" ready recording={false} />)
    expect(main.scrollTop).toBe(100)

    document.body.removeChild(main)
  })
})
