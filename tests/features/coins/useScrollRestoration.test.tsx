import React from 'react'
import { render } from '@testing-library/react'
import { useScrollRestoration } from '@/features/coins/useScrollRestoration'
import { useCoinStore } from '@/features/coins/useCoins'

/**
 * Minimal component that uses the scroll restoration hook.
 * Renders inside an existing <main> element.
 */
function ScrollRestorationTester({ collectionId }: { collectionId: string }): React.ReactElement {
  useScrollRestoration(collectionId)
  return <div data-testid="tester" />
}

describe('useScrollRestoration', () => {
  beforeEach(() => {
    // Reset the store between tests
    useCoinStore.setState({
      coins: [],
      cursors: [],
      hasMore: false,
      loading: false,
      loadingMore: false,
      error: null,
      loadedCollectionId: null,
      scrollPositions: {}
    })
    // Clean up any leftover <main>
    const main = document.querySelector('main')
    if (main) main.remove()
  })

  it('restores saved scroll position on mount when data is already loaded', () => {
    const collectionId = 'ru'

    // Create a tall <main> so it's scrollable, with content taller than viewport
    const main = document.createElement('main')
    main.style.height = '400px'
    main.style.overflowY = 'scroll'
    const inner = document.createElement('div')
    inner.style.height = '2000px'
    main.appendChild(inner)
    document.body.appendChild(main)

    // Pre-populate the store: coins already loaded, scroll position saved
    useCoinStore.setState({
      coins: [{ id: 'c1' } as never],
      loading: false,
      loadedCollectionId: collectionId,
      scrollPositions: { [collectionId]: 300 }
    })

    render(<ScrollRestorationTester collectionId={collectionId} />)

    // useLayoutEffect runs synchronously in tests — scroll should be restored
    expect(main.scrollTop).toBe(300)

    document.body.removeChild(main)
  })

  it('does not restore scroll when loading is still in progress', () => {
    const collectionId = 'ru'

    const main = document.createElement('main')
    main.style.height = '400px'
    main.style.overflowY = 'scroll'
    const inner = document.createElement('div')
    inner.style.height = '2000px'
    main.appendChild(inner)
    document.body.appendChild(main)

    useCoinStore.setState({
      coins: [],
      loading: true,
      loadedCollectionId: null,
      scrollPositions: { [collectionId]: 300 }
    })

    render(<ScrollRestorationTester collectionId={collectionId} />)

    // Should NOT restore while loading
    expect(main.scrollTop).toBe(0)

    document.body.removeChild(main)
  })

  it('does not restore scroll when no saved position exists for the collection', () => {
    const collectionId = 'ru'

    const main = document.createElement('main')
    main.style.height = '400px'
    main.style.overflowY = 'scroll'
    const inner = document.createElement('div')
    inner.style.height = '2000px'
    main.appendChild(inner)
    document.body.appendChild(main)

    useCoinStore.setState({
      coins: [{ id: 'c1' } as never],
      loading: false,
      loadedCollectionId: collectionId,
      scrollPositions: {} // no saved position
    })

    render(<ScrollRestorationTester collectionId={collectionId} />)

    expect(main.scrollTop).toBe(0)

    document.body.removeChild(main)
  })

  it('restores scroll after component remount (simulating gallery exit)', () => {
    const collectionId = 'ru'

    const main = document.createElement('main')
    main.style.height = '400px'
    main.style.overflowY = 'scroll'
    const inner = document.createElement('div')
    inner.style.height = '2000px'
    main.appendChild(inner)
    document.body.appendChild(main)

    // Simulate: data is loaded, scroll position was saved before navigating to gallery
    useCoinStore.setState({
      coins: [{ id: 'c1' }, { id: 'c2' }] as never[],
      loading: false,
      loadedCollectionId: collectionId,
      scrollPositions: { [collectionId]: 550 }
    })

    // First mount — should restore
    const { unmount } = render(<ScrollRestorationTester collectionId={collectionId} />)
    expect(main.scrollTop).toBe(550)

    // Navigate to gallery — component unmounts
    unmount()
    // Reset scroll to top (simulating new page)
    main.scrollTop = 0

    // Come back from gallery — component remounts
    render(<ScrollRestorationTester collectionId={collectionId} />)
    // useLayoutEffect should fire on remount too and restore the saved position
    expect(main.scrollTop).toBe(550)

    document.body.removeChild(main)
  })
})
