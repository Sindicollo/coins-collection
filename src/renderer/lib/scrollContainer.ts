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
 */

let container: HTMLElement | null = null

type ScrollContainerListener = (el: HTMLElement) => void

const listeners = new Set<ScrollContainerListener>()

/** Called by `AppLayout` (via `ref`) to (un)register the scrollable `<main>`. */
export function registerScrollContainer(el: HTMLElement | null): void {
  container = el
  if (!el) return

  // Notify late subscribers. React attaches a parent's ref AFTER the layout
  // effects of its children, so a page's layout effect can run before `<main>`
  // exists in this module (see `subscribeScrollContainer`).
  for (const listener of Array.from(listeners)) listener(el)
}

/** The element that actually scrolls page content, or `null` if unmounted. */
export function getScrollContainer(): HTMLElement | null {
  return container
}

/**
 * Run `listener` when a scroll container gets registered.
 *
 * Needed because of commit ordering: when the whole layout mounts, the page's
 * `useLayoutEffect` runs BEFORE `AppLayout`'s `<main>` ref attaches, so
 * `getScrollContainer()` is still `null` at that point. Subscribing lets a page
 * restore its scroll position in the same commit instead of never.
 *
 * Returns an unsubscribe function.
 */
export function subscribeScrollContainer(listener: ScrollContainerListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
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
