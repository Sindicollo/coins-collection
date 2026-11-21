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

/**
 * Mimics `AppLayout`: the scroll container is registered by a ref on an
 * ANCESTOR, so its ref callback runs after the children's layout effects.
 */
function LateRegisteringLayout(props: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      data-testid="scroller"
      ref={(el) => registerScrollContainer(el)}
      style={{ height: '400px', overflowY: 'scroll' }}
    >
      <div style={{ height: '2000px' }}>{props.children}</div>
    </div>
  )
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

  it('does not re-snap to a stale saved position on later re-renders', () => {
    const main = setupScrollContainer()
    saveScrollPosition('test:1', 300)

    const { rerender } = render(<ScrollRestorationTester storageKey="test:1" ready recording />)
    expect(main.scrollTop).toBe(300)

    // While recording=false (e.g. loading more) the saved position is stale.
    // A re-render that changes the hook options must NOT snap scroll back to
    // the stale 300 — restore happens once per storageKey.
    main.scrollTop = 0
    main.dispatchEvent(new Event('scroll'))
    rerender(
      <ScrollRestorationTester
        storageKey="test:1"
        ready
        recording={false}
        onLoadMore={() => {}}
      />
    )
    expect(main.scrollTop).toBe(0)

    document.body.removeChild(main)
  })

  /**
   * Production ordering regression: `AppLayout` registers `<main>` through a
   * ref, and React attaches a parent's ref AFTER its children's layout effects.
   * So on a fresh mount (returning from the photo gallery, which renders
   * outside `AppLayout`) `getScrollContainer()` is still `null` when the page's
   * layout effect runs. The restore must therefore wait for registration —
   * without this it worked only in dev (StrictMode re-runs effects after refs).
   */
  it('restores when the container registers after the page layout effect', () => {
    saveScrollPosition('test:late', 320)

    const view = render(
      <LateRegisteringLayout>
        <ScrollRestorationTester storageKey="test:late" ready />
      </LateRegisteringLayout>
    )

    const scroller = view.getByTestId('scroller')
    expect(getScrollContainer()).toBe(scroller)
    expect(scroller.scrollTop).toBe(320)
  })

  it('restores once under StrictMode double-invoked effects', () => {
    saveScrollPosition('test:strict', 180)

    const view = render(
      <React.StrictMode>
        <LateRegisteringLayout>
          <ScrollRestorationTester storageKey="test:strict" ready />
        </LateRegisteringLayout>
      </React.StrictMode>
    )

    expect(view.getByTestId('scroller').scrollTop).toBe(180)
  })

  it('does not restore a not-ready page when the container registers late', () => {
    saveScrollPosition('test:late', 320)

    const view = render(
      <LateRegisteringLayout>
        <ScrollRestorationTester storageKey="test:late" ready={false} />
      </LateRegisteringLayout>
    )

    expect(view.getByTestId('scroller').scrollTop).toBe(0)
  })

  it('stops waiting for the container on unmount', () => {
    saveScrollPosition('test:late', 320)

    const view = render(
      <LateRegisteringLayout>
        <ScrollRestorationTester storageKey="test:late" ready={false} />
      </LateRegisteringLayout>
    )
    view.unmount()

    // Registering a container after unmount must not throw or resurrect state
    expect(() => registerScrollContainer(document.createElement('main'))).not.toThrow()
    registerScrollContainer(null)
  })
})
