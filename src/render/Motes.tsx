import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useReducedMotion } from './useReducedMotion'

// Fixed scatter points over the canopy region; we light up the first `count` of them.
// Each mote = one recent stranger's care, rebuilt from the tend log (no realtime).
const SLOTS = [
  { x: 30, y: 18 },
  { x: 50, y: 12 },
  { x: 68, y: 20 },
  { x: 22, y: 32 },
  { x: 78, y: 34 },
  { x: 40, y: 26 },
  { x: 60, y: 30 },
  { x: 34, y: 44 },
  { x: 66, y: 46 },
  { x: 50, y: 38 },
  { x: 18, y: 48 },
  { x: 82, y: 50 },
  { x: 46, y: 52 },
  { x: 58, y: 16 },
]

export function Motes({ count }: { count: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const n = Math.min(Math.max(0, count), SLOTS.length)

  // Each mote drifts + pulses on its own phase, so the crowd shimmers like fireflies.
  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    const dots = gsap.utils.toArray<HTMLElement>(el.querySelectorAll('.mote'))
    // repeatRefresh re-rolls each mote's drift every cycle → flickering fireflies, not a loop.
    const tweens = dots.map((d) =>
      gsap.to(d, {
        y: 'random(-9, 9)',
        x: 'random(-6, 6)',
        opacity: 'random(0.2, 0.5)',
        duration: 'random(2.5, 5)',
        repeat: -1,
        yoyo: true,
        repeatRefresh: true,
        ease: 'sine.inOut',
        delay: gsap.utils.random(0, 3),
      }),
    )
    return () => tweens.forEach((t) => t.kill())
  }, [n, reduced])

  return (
    <div ref={ref} className="motes" aria-hidden="true">
      {SLOTS.slice(0, n).map((s, i) => (
        <span key={i} className="mote" style={{ left: `${s.x}%`, top: `${s.y}%` }} />
      ))}
    </div>
  )
}
