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

/** Called by `AppLayout` (via `ref`) to (un)register the scrollable `<main>`. */
export function registerScrollContainer(el: HTMLElement | null): void {
  container = el
}

/** The element that actually scrolls page content, or `null` if unmounted. */
export function getScrollContainer(): HTMLElement | null {
  return container
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
