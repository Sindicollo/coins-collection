/**
 * Tests for src/renderer/hooks/useScrollRestoration.ts and the ordering
 * contract of src/renderer/lib/scrollContainer.ts.
 *
 * The hook must never depend on WHEN the scroll container gets registered:
 * `AppLayout` registers `<main>` from a React ref, and React attaches a
 * parent's ref after its children's layout effects. That ordering is why scroll
 * restoration used to work in dev (StrictMode re-runs effects) but not in
 * packaged builds — these tests pin the behavior down for both orderings.
 */

import React from 'react'
import { render } from '@testing-library/react'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import {
  getScrollContainer,
  getScrollPosition,
  registerScrollContainer,
  saveScrollPosition,
  subscribeScrollContainer,
  whenScrollContainer,
  clearScrollPositions
} from '@/lib/scrollContainer'
import { AppLayout } from '@/components/layout/AppLayout'

vi.mock('@/components/layout/Header', () => ({
  Header: () => <header>Mocked Header</header>
}))

/** Minimal component that uses the scroll restoration hook. */
function ScrollRestorationTester(props: {
  storageKey: string
  ready: boolean
  recording?: boolean
  contentVersion?: number
  onLoadMore?: () => void
}): React.ReactElement {
  useScrollRestoration(props)
  return <div data-testid="tester" />
}

/**
 * A scroll container that clamps `scrollTop` like a browser. jsdom has no
 * layout, so without this a too-short page would pretend the restore worked.
 */
function createScroller(options: { viewport?: number; content?: number } = {}): {
  el: HTMLElement
  setContentHeight: (height: number) => void
} {
  const viewport = options.viewport ?? 400
  let content = options.content ?? 2000
  let top = 0

  const el = document.createElement('main')
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => content })
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, Math.min(value, Math.max(0, content - viewport)))
    }
  })

  document.body.appendChild(el)
  registerScrollContainer(el)

  return {
    el,
    setContentHeight: (height: number) => {
      content = height
    }
  }
}

/** Registers the scroll container from an ANCESTOR ref — the AppLayout ordering. */
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
    registerScrollContainer(null)
    document.body.innerHTML = ''
  })

  it('records scroll position via the scroll container on scroll events', () => {
    const scroller = createScroller()
    render(<ScrollRestorationTester storageKey="test:1" ready={false} />)

    scroller.el.scrollTop = 300
    scroller.el.dispatchEvent(new Event('scroll'))

    expect(getScrollContainer()).toBe(scroller.el)
    expect(getScrollPosition('test:1')).toBe(300)
  })

  it('records the current key after the storageKey changes', () => {
    const scroller = createScroller()
    const { rerender } = render(<ScrollRestorationTester storageKey="test:a" ready />)

    scroller.el.scrollTop = 120
    scroller.el.dispatchEvent(new Event('scroll'))
    expect(getScrollPosition('test:a')).toBe(120)

    rerender(<ScrollRestorationTester storageKey="test:b" ready />)
    scroller.el.scrollTop = 240
    scroller.el.dispatchEvent(new Event('scroll'))

    expect(getScrollPosition('test:b')).toBe(240)
    expect(getScrollPosition('test:a')).toBe(120)
  })

  it('starts recording when the container registers after mount', () => {
    render(<ScrollRestorationTester storageKey="test:1" ready={false} />)

    const scroller = createScroller()
    scroller.el.scrollTop = 90
    scroller.el.dispatchEvent(new Event('scroll'))

    expect(getScrollPosition('test:1')).toBe(90)
  })

  it('restores saved scroll position on mount when content is ready', () => {
    const scroller = createScroller()
    saveScrollPosition('test:1', 300)

    render(<ScrollRestorationTester storageKey="test:1" ready />)
    expect(scroller.el.scrollTop).toBe(300)
  })

  it('does not restore when content is not ready', () => {
    const scroller = createScroller()
    saveScrollPosition('test:1', 300)

    render(<ScrollRestorationTester storageKey="test:1" ready={false} />)
    expect(scroller.el.scrollTop).toBe(0)
  })

  it('does not restore when no saved position exists', () => {
    const scroller = createScroller()

    render(<ScrollRestorationTester storageKey="test:empty" ready />)
    expect(scroller.el.scrollTop).toBe(0)
  })

  it('restores scroll after remount (simulating gallery exit)', () => {
    const scroller = createScroller()
    saveScrollPosition('test:1', 550)

    const first = render(<ScrollRestorationTester storageKey="test:1" ready />)
    expect(scroller.el.scrollTop).toBe(550)

    // Navigate away — unmount, then reset scroll to top (new page)
    first.unmount()
    scroller.el.scrollTop = 0

    // Come back — remount restores the saved position
    render(<ScrollRestorationTester storageKey="test:1" ready />)
    expect(scroller.el.scrollTop).toBe(550)
  })

  it('does not overwrite the saved position while recording=false', () => {
    const scroller = createScroller()
    saveScrollPosition('test:1', 100)

    const first = render(<ScrollRestorationTester storageKey="test:1" ready recording={false} />)

    // Scrolling while recording=false must not clobber the saved position
    scroller.el.scrollTop = 0
    scroller.el.dispatchEvent(new Event('scroll'))
    expect(getScrollPosition('test:1')).toBe(100)

    first.unmount()
    render(<ScrollRestorationTester storageKey="test:1" ready />)
    expect(scroller.el.scrollTop).toBe(100)
  })

  it('does not re-snap to a stale saved position on later re-renders', () => {
    const scroller = createScroller()
    saveScrollPosition('test:1', 300)

    const { rerender } = render(<ScrollRestorationTester storageKey="test:1" ready recording />)
    expect(scroller.el.scrollTop).toBe(300)

    // While recording=false (e.g. loading more) the saved position is stale.
    // A re-render that changes the hook options must NOT snap scroll back to
    // the stale 300 — restore happens once per storageKey.
    scroller.el.scrollTop = 0
    scroller.el.dispatchEvent(new Event('scroll'))
    rerender(
      <ScrollRestorationTester
        storageKey="test:1"
        ready
        recording={false}
        contentVersion={1}
        onLoadMore={() => {}}
      />
    )
    expect(scroller.el.scrollTop).toBe(0)
  })

  /**
   * Production ordering: `AppLayout` registers `<main>` through a ref, and React
   * attaches a parent's ref AFTER its children's layout effects. On a fresh
   * mount the page's layout effect therefore runs with no container registered.
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

  it('restores inside the real AppLayout (integration)', () => {
    saveScrollPosition('collection:c1', 240)

    const view = render(
      <AppLayout sidebar={<aside>Sidebar</aside>} onOpenSettings={vi.fn()}>
        <ScrollRestorationTester storageKey="collection:c1" ready />
      </AppLayout>
    )

    const main = view.container.querySelector('main')
    expect(getScrollContainer()).toBe(main)
    expect(main?.scrollTop).toBe(240)
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

  it('loads more content when the saved position is beyond the rendered list', async () => {
    const scroller = createScroller({ content: 700 }) // max scrollTop = 300
    saveScrollPosition('test:deep', 500)
    const onLoadMore = vi.fn()

    const { rerender } = render(
      <ScrollRestorationTester
        storageKey="test:deep"
        ready
        contentVersion={30}
        onLoadMore={onLoadMore}
      />
    )

    // Clamped to the current content and asked for another page
    expect(scroller.el.scrollTop).toBe(300)
    await vi.waitFor(() => expect(onLoadMore).toHaveBeenCalledTimes(1))

    // A page arrives — the restore retries and reaches the saved position
    scroller.setContentHeight(2000)
    rerender(
      <ScrollRestorationTester
        storageKey="test:deep"
        ready
        contentVersion={60}
        onLoadMore={onLoadMore}
      />
    )

    expect(scroller.el.scrollTop).toBe(500)
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('settles instead of snapping when the position can never be reached', () => {
    const scroller = createScroller({ content: 700 }) // max scrollTop = 300
    saveScrollPosition('test:deep', 500)

    // No `onLoadMore`: nothing more can be rendered
    const { rerender } = render(<ScrollRestorationTester storageKey="test:deep" ready />)
    expect(scroller.el.scrollTop).toBe(300)

    // Content grows later (e.g. photos load) — must NOT jump to 500
    scroller.setContentHeight(2000)
    rerender(<ScrollRestorationTester storageKey="test:deep" ready contentVersion={1} />)

    expect(scroller.el.scrollTop).toBe(300)
  })

  it('stops restoring once the user scrolls away', async () => {
    const scroller = createScroller({ content: 700 }) // max scrollTop = 300
    saveScrollPosition('test:deep', 500)
    const onLoadMore = vi.fn()

    const { rerender } = render(
      <ScrollRestorationTester
        storageKey="test:deep"
        ready
        contentVersion={30}
        onLoadMore={onLoadMore}
      />
    )
    expect(scroller.el.scrollTop).toBe(300)
    await vi.waitFor(() => expect(onLoadMore).toHaveBeenCalledTimes(1))

    // The user takes over
    scroller.el.scrollTop = 60
    scroller.setContentHeight(2000)

    rerender(
      <ScrollRestorationTester
        storageKey="test:deep"
        ready
        contentVersion={60}
        onLoadMore={onLoadMore}
      />
    )

    expect(scroller.el.scrollTop).toBe(60)
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('restores the position of each key when the storageKey changes back and forth', () => {
    const scroller = createScroller()
    saveScrollPosition('test:a', 200)
    saveScrollPosition('test:b', 550)

    const { rerender } = render(<ScrollRestorationTester storageKey="test:a" ready />)
    expect(scroller.el.scrollTop).toBe(200)

    rerender(<ScrollRestorationTester storageKey="test:b" ready />)
    expect(scroller.el.scrollTop).toBe(550)

    rerender(<ScrollRestorationTester storageKey="test:a" ready />)
    expect(scroller.el.scrollTop).toBe(200)
  })

  it('stops listening to scroll events on unmount', () => {
    const scroller = createScroller()
    const removeSpy = vi.spyOn(scroller.el, 'removeEventListener')

    const { unmount } = render(<ScrollRestorationTester storageKey="test:1" ready />)
    unmount()

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
  })

  it('stops waiting for a container that never appears', () => {
    const listenerSpy = vi.fn()
    const unsubscribe = subscribeScrollContainer(listenerSpy)

    const { unmount } = render(<ScrollRestorationTester storageKey="test:1" ready={false} />)
    unmount()
    unsubscribe()

    // Registering afterwards must not throw or reach the unmounted page
    expect(() => registerScrollContainer(document.createElement('main'))).not.toThrow()
    registerScrollContainer(null)
  })
})

describe('whenScrollContainer', () => {
  beforeEach(() => {
    registerScrollContainer(null)
  })

  it('calls back immediately when a container is registered', () => {
    const scroller = createScroller()
    const callback = vi.fn()

    whenScrollContainer(callback)

    expect(callback).toHaveBeenCalledWith(scroller.el)
  })

  it('calls back when the container appears later', () => {
    const callback = vi.fn()
    whenScrollContainer(callback)
    expect(callback).not.toHaveBeenCalled()

    const scroller = createScroller()

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(scroller.el)
  })

  it('can be cancelled while waiting', () => {
    const callback = vi.fn()
    const cancel = whenScrollContainer(callback)
    cancel()

    createScroller()

    expect(callback).not.toHaveBeenCalled()
  })

  it('ignores unregistration', () => {
    const callback = vi.fn()
    whenScrollContainer(callback)

    registerScrollContainer(null)

    expect(callback).not.toHaveBeenCalled()
  })
})
