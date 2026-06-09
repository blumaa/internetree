import { useEffect, useState } from 'react'

/**
 * Tracks the OS "reduce motion" setting. The canopy runs many infinite GSAP loops
 * (sway, motes, tremble, falling leaves) — those must not run for users who asked
 * for reduced motion (WCAG 2.3.3 / vestibular safety).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return reduced
}
