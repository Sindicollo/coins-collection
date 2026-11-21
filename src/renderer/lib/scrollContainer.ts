/**
 * The app's single scrollable region.
 *
 * `AppLayout` renders `<main className="flex-1 overflow-y-auto">` and registers
 * that element here via `registerScrollContainer`. ALL page scrolling happens
 * on this element — NOT on inner `overflow-y-auto` divs inside pages, because
 * those divs' height resolves to `auto` (their `h-full` parent has an auto
 * height), so they never actually overflow.
 *
 * Any code that reads or restores the page scroll position must go through
 * this module instead of `document.querySelector('main')`.
 *
 * ## Registration is NOT synchronous with page effects
 *
 * The container is registered from a React **ref** inside `AppLayout`, and
 * React attaches a parent's ref AFTER the layout effects of its children. So a
 * page's first layout effect always runs while nothing is registered yet — and
 * the same is true after a full remount (e.g. returning from the photo gallery,
 * which renders outside `AppLayout`).
 *
 * Treating `getScrollContainer() === null` as "there is no container" silently
 * drops the work: that is exactly the bug that lost scroll restoration in
 * packaged builds while StrictMode's second effect pass masked it in dev.
 * Use {@link whenScrollContainer}, which is ordering-agnostic.
 */

let container: HTMLElement | null = null

type ScrollContainerListener = () => void

const listeners = new Set<ScrollContainerListener>()

/**
 * Called by `AppLayout` (via `ref`) to (un)register the scrollable `<main>`.
 * Subscribers are notified on every change, including unregistration (`null`).
 */
export function registerScrollContainer(el: HTMLElement | null): void {
  container = el
  // Copy the set: a listener may unsubscribe itself from inside the callback.
  for (const listener of Array.from(listeners)) listener()
}

/** The element that actually scrolls page content, or `null` if none is registered. */
export function getScrollContainer(): HTMLElement | null {
  return container
}

/** Notified whenever the container is (un)registered. Returns an unsubscribe function. */
export function subscribeScrollContainer(listener: ScrollContainerListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Run `callback` with the scroll container: immediately if one is registered,
 * otherwise as soon as one appears. The callback runs at most once.
 *
 * Use this instead of `getScrollContainer()` whenever a `null` result would
 * make the caller give up — see the module docs above.
 *
 * @returns cleanup that cancels the (possibly still pending) callback
 */
export function whenScrollContainer(callback: (el: HTMLElement) => void): () => void {
  const el = getScrollContainer()
  if (el) {
    callback(el)
    return noop
  }

  let unsubscribe: (() => void) | null = subscribeScrollContainer(() => {
    const registered = getScrollContainer()
    if (!registered) return
    unsubscribe?.()
    unsubscribe = null
    callback(registered)
  })

  return () => {
    unsubscribe?.()
    unsubscribe = null
  }
}

/**
 * Saved scroll positions, keyed by page (e.g. `collection:<id>`, `ai:<id>`).
 * Lives at module scope so it survives page unmount (e.g. navigating to the
 * photo gallery and back).
 */
const savedPositions = new Map<string, number>()

export function saveScrollPosition(key: string, position: number): void {
  savedPositions.set(key, position)
}

export function getScrollPosition(key: string): number | undefined {
  return savedPositions.get(key)
}

/** Clear all saved positions (used by tests). */
export function clearScrollPositions(): void {
  savedPositions.clear()
}

function noop(): void {}
