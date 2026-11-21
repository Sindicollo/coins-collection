import React from 'react'
import { saveScrollPosition, getScrollPosition, whenScrollContainer } from '@/lib/scrollContainer'

interface UseScrollRestorationOptions {
  /** Unique key for this page's saved position (e.g. `collection:<id>`, `ai:<id>`). */
  storageKey: string
  /** True once the page content is loaded and tall enough to restore against. */
  ready: boolean
  /** When false, scroll events are ignored (e.g. while the list is reloading). Default: true. */
  recording?: boolean
  /**
   * Changes whenever more content is rendered — pass the number of loaded items.
   * A restore that could not reach its saved position (the page was shorter)
   * retries every time this changes.
   */
  contentVersion?: number
  /** Requests one more page of content for a restore that needs more height. */
  onLoadMore?: () => void
}

/** How far the page may drift from our last assignment before we let the user take over. */
const USER_SCROLL_TOLERANCE_PX = 2

/** Safety net against a content source that keeps growing without reaching the target. */
const MAX_LOAD_MORE_ATTEMPTS = 20

interface RestoreState {
  key: string
  /** Position still to reach; `null` once the restore is finished or impossible. */
  target: number | null
  /** The scrollTop we assigned last — used to detect a manual scroll. */
  assigned: number | null
  attempts: number
}

/**
 * Persist and restore the scroll position of the app's scroll container
 * (see `@/lib/scrollContainer`) across page unmounts — e.g. navigating to the
 * photo gallery and back.
 *
 * Behavior:
 * - the position is recorded on every scroll while `recording` is true;
 * - it is restored once per `storageKey`, as soon as `ready` and a scroll
 *   container are available (in whichever order that happens);
 * - if the saved position lies beyond the rendered content, `onLoadMore` is
 *   called and the restore retries when `contentVersion` changes;
 * - once the user scrolls, the restore stops instead of fighting them.
 *
 * Nothing is saved in a cleanup: under React StrictMode the double-invoked
 * cleanup would record `scrollTop = 0` and overwrite the real position.
 */
export function useScrollRestoration(options: UseScrollRestorationOptions): void {
  const { storageKey, ready, recording = true, contentVersion = 0, onLoadMore } = options

  // Latest values for callbacks that must not re-subscribe on every change.
  const latestRef = React.useRef({ recording, onLoadMore })
  latestRef.current = { recording, onLoadMore }
  const storageKeyRef = React.useRef(storageKey)
  storageKeyRef.current = storageKey

  // Restore bookkeeping of the CURRENT key (reset when the key changes).
  const restoreRef = React.useRef<RestoreState | null>(null)

  // Record the position on every scroll.
  React.useEffect(() => {
    let detach: (() => void) | null = null

    // The container is registered above this page in the tree, so it may not
    // exist yet on mount — wait for it instead of silently recording nothing.
    const stopWaiting = whenScrollContainer((el) => {
      const onScroll = (): void => {
        if (latestRef.current.recording) saveScrollPosition(storageKeyRef.current, el.scrollTop)
      }
      el.addEventListener('scroll', onScroll, { passive: true })
      detach = () => el.removeEventListener('scroll', onScroll)
    })

    return () => {
      stopWaiting()
      detach?.()
    }
  }, [])

  // Restore the saved position once the page is ready.
  React.useLayoutEffect(() => {
    // A new key means a new page (or a collection switch): start over.
    if (restoreRef.current?.key !== storageKey) {
      const saved = getScrollPosition(storageKey)
      restoreRef.current = {
        key: storageKey,
        target: saved !== undefined && saved > 0 ? saved : null,
        assigned: null,
        attempts: 0
      }
    }

    const state = restoreRef.current
    if (!state || !ready || state.target === null) return

    return whenScrollContainer((el) => {
      const target = state.target
      if (target === null) return

      // The user already scrolled away from where we put them — back off.
      if (
        state.assigned !== null &&
        Math.abs(el.scrollTop - state.assigned) > USER_SCROLL_TOLERANCE_PX
      ) {
        state.target = null
        return
      }

      el.scrollTop = target
      state.assigned = el.scrollTop

      if (el.scrollTop >= target - 1) {
        state.target = null // reached
        return
      }

      // The page is shorter than the saved position — typically a paginated
      // list that only holds its first page after a remount. Ask for more
      // content; `contentVersion` changes when it arrives and we retry.
      const loadMore = latestRef.current.onLoadMore
      if (!loadMore || state.attempts >= MAX_LOAD_MORE_ATTEMPTS) {
        state.target = null // unreachable — settle instead of snapping later
        return
      }

      state.attempts += 1
      // Deferred: `onLoadMore` updates another component's state.
      queueMicrotask(loadMore)
    })
  }, [storageKey, ready, contentVersion])
}
