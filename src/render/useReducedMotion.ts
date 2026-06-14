import { useEffect, useState } from 'react'

/**
 * Tracks the OS "reduce motion" setting. The canopy runs many infinite GSAP loops
 * (sway, motes, tremble, falling leaves) — those must not run for users who asked
 * for reduced motion (WCAG 2.3.3 / vestibular safety).
 */
const QUERY = '(prefers-reduced-motion: reduce)'

export function useReducedMotion(): boolean {
  // Read synchronously on the FIRST render — deferring to an effect would start the
  // infinite loops for a frame before the preference is honoured.
  const [reduced, setReduced] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return reduced
}
