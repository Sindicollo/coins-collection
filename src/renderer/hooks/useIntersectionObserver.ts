import { useEffect, useRef } from 'react'

export function useIntersectionObserver(
  callback: () => void,
  enabled: boolean,
  rootMargin = '200px'
): React.RefCallback<HTMLDivElement> {
  const callbackRef = useRef(callback)
  callbackRef.current = callback
  const observerRef = useRef<IntersectionObserver | null>(null)

  const refCallback: React.RefCallback<HTMLDivElement> = (node) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }

    if (node && enabled) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            callbackRef.current()
          }
        },
        { rootMargin }
      )
      observer.observe(node)
      observerRef.current = observer
    }
  }

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  return refCallback
}
