import React from 'react'
import { getScrollContainer, saveScrollPosition, getScrollPosition } from '@/lib/scrollContainer'

interface UseScrollRestorationOptions {
  /** Unique key for this page's saved position (e.g. `collection:<id>`, `ai:<id>`). */
  storageKey: string
  /** True once the page content is loaded and tall enough to restore against. */
  ready: boolean
  /** When false, scroll events are ignored (e.g. while the list is reloading). */
  recording?: boolean
  /** Called when the saved position exceeds the current scrollable height. */
  onLoadMore?: () => void
}

/**
 * Persist and restore the scroll position of the app's scroll container
 * (see `@/lib/scrollContainer`) across page unmounts — e.g. navigating to the
 * photo gallery and back.
 */
export function useScrollRestoration(options: UseScrollRestorationOptions): void {
  const { storageKey, ready, recording = true, onLoadMore } = options

  // Keep the latest options in refs so the scroll listener (attached once)
  // always reads current values without re-subscribing on every change.
  const recordingRef = React.useRef(recording)
  recordingRef.current = recording
  const storageKeyRef = React.useRef(storageKey)
  storageKeyRef.current = storageKey
  const onLoadMoreRef = React.useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore
  // Restore only once per storageKey — not on every re-render (the storageKey
  // is the only thing that makes re-restoring meaningful).
  const restoredKeyRef = React.useRef<string | null>(null)

  // Record the position on every scroll.
  React.useEffect(() => {
    const el = getScrollContainer()
    if (!el) return

    const onScroll = (): void => {
      if (recordingRef.current) {
        saveScrollPosition(storageKeyRef.current, el.scrollTop)
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Restore the position once the content is ready.
  // Note: intentionally nothing is saved in a cleanup — under React StrictMode
  // the double-invoked cleanup would record scrollTop=0 and overwrite the real
  // position.
  React.useLayoutEffect(() => {
    if (!ready || restoredKeyRef.current === storageKey) return
    const el = getScrollContainer()
    const saved = getScrollPosition(storageKey)
    if (!el || !saved || saved <= 0) return

    restoredKeyRef.current = storageKey
    el.scrollTop = saved
    // Content too short for the saved position — load more (defer to avoid a
    // state update during the layout-effect commit phase).
    if (el.scrollTop < saved && onLoadMoreRef.current) {
      queueMicrotask(onLoadMoreRef.current)
    }
  }, [storageKey, ready])
}
