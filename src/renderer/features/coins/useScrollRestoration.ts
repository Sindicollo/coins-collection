import React from 'react'
import { useCoinStore } from './useCoins'

export function useScrollRestoration(collectionId: string): void {
  const mainRef = React.useRef<HTMLElement | null>(null)
  const collectionIdRef = React.useRef(collectionId)
  collectionIdRef.current = collectionId

  // Attach stable scroll listener — once per mount
  React.useEffect(() => {
    const main = document.querySelector<HTMLElement>('main')
    mainRef.current = main
    if (!main) return

    const onScroll = (): void => {
      const st = useCoinStore.getState()
      if (!st.loading && !st.loadingMore) {
        st.saveScrollPosition(collectionIdRef.current, main.scrollTop)
      }
    }
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [])

  // Restore scroll position + auto-load pages if needed
  const { loading, coins, hasMore } = useCoinStore()
  React.useLayoutEffect(() => {
    const main = mainRef.current
    if (!main || loading || coins.length === 0) return

    const saved = useCoinStore.getState().scrollPositions[collectionId]
    if (!saved) return

    main.scrollTop = saved
    // Content too short for the saved position — load more pages
    if (main.scrollTop < saved && hasMore) {
      useCoinStore.getState().loadMore(collectionId)
    }
  }, [loading, coins.length, collectionId, hasMore])
}
