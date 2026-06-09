import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import type { TreeState } from '../engine/types'
import { visualFor } from './visual'
import { varyOak, type OakStage } from './oakSkeleton'
import { OakShapes } from './OakShapes'
import { useReducedMotion } from './useReducedMotion'
import { SHED_HEALTH } from '../engine/config'

/**
 * The oak IS the interface — tap it to tend. Built from an anatomical skeleton
 * (tapered trunk, branch orders, tip-clustered crown, surface roots), painted
 * soft-storybook, with GSAP for idle sway, growth, the health mood-layer and tend feedback.
 */
export function OakTree({
  tree,
  canTend,
  onTend,
}: {
  tree: TreeState
  canTend: boolean
  onTend: () => void
}) {
  const visual = useMemo(() => visualFor(tree), [tree])
  // Unique per generation (seeded), stable across renders/syncs/clients.
  const oak = useMemo(
    () => varyOak(tree.generation, visual.stageIndex),
    [tree.generation, visual.stageIndex],
  )
  const reduced = useReducedMotion()
  const wantsCare = visual.glow < 0.5 && tree.status !== 'dead'
  // Sheds leaves + drops its acorn through the whole dying decline, not just the
  // brief critical instant — so the death beat is actually visible.
  const dying = tree.status === 'critical' || tree.health < SHED_HEALTH
  const { cx, cy } = oak.crownCenter

  // Crossfade between growth stages: when the stage changes, the previous skeleton
  // is kept as a fading "ghost" so the size/shape change dissolves instead of popping.
  const [outgoing, setOutgoing] = useState<OakStage | null>(null)
  const prevStageRef = useRef(visual.stageIndex)

  const shadowRx = useMemo(
    () => Math.max(...oak.crown.map((c) => Math.abs(c.cx - 130) + c.r)) * 0.8,
    [oak],
  )

  const rootRef = useRef<SVGSVGElement>(null)
  const fallingRef = useRef<SVGGElement>(null)
  const ghostRef = useRef<SVGGElement>(null)
  const groundRef = useRef<SVGEllipseElement>(null)
  const bodyRef = useRef<SVGGElement>(null)
  const crownRef = useRef<SVGGElement>(null)
  const glowRef = useRef<SVGCircleElement>(null)
  const auraRef = useRef<SVGCircleElement>(null)
  const rippleRef = useRef<SVGCircleElement>(null)
  const ambientLeafRef = useRef<SVGEllipseElement>(null)
  const coreStopRef = useRef<SVGStopElement>(null)
  const rimStopRef = useRef<SVGStopElement>(null)
  const barkLightRef = useRef<SVGStopElement>(null)
  const barkDarkRef = useRef<SVGStopElement>(null)

  // Growth: the whole tree scales up from the trunk base (stays rooted), with a gentle
  // bloom on promotion. NO rotation here — the trunk + roots must never tilt off the ground.
  useEffect(() => {
    gsap.to(bodyRef.current, {
      scale: visual.scale,
      svgOrigin: '130 244', // pivot at the trunk base
      duration: 1.1,
      ease: 'elastic.out(0.5, 0.7)',
    })
  }, [visual.scale])

  // Wilt = a DISTRIBUTED droop, not a rigid block moving. As health falls, each leaf mass
  // loses turgor and hangs down — outer/upper masses sag more than the inner core — so the
  // canopy slumps organically while the trunk + roots stay planted. (Health, not age:
  // a thriving ancient oak has lean=0 and stands tall.)
  useEffect(() => {
    const crown = crownRef.current
    if (!crown) return
    const masses = gsap.utils.toArray<SVGElement>(crown.querySelectorAll('.leaf-mass'))
    masses.forEach((m, i) => {
      const c = oak.crown[i]
      if (!c) return
      const height = gsap.utils.clamp(0, 1, (202 - c.cy) / 130) // 0 low → 1 top of crown
      gsap.to(m, { y: visual.lean * (0.3 + 0.5 * height), duration: 1, ease: 'power2.out' })
    })
  }, [visual.lean, oak])

  // Health mood-layer: recolour gradients, thin the crown.
  useEffect(() => {
    gsap.to(coreStopRef.current, { attr: { 'stop-color': visual.canopyCore }, duration: 1 })
    gsap.to(rimStopRef.current, { attr: { 'stop-color': visual.canopyRim }, duration: 1 })
    gsap.to(barkLightRef.current, { attr: { 'stop-color': visual.trunkLight }, duration: 1 })
    gsap.to(barkDarkRef.current, { attr: { 'stop-color': visual.trunkDark }, duration: 1 })
    // Health changes FULLNESS (opacity), never SIZE — so nothing jumps on a mood change.
    gsap.to(crownRef.current, {
      opacity: 0.35 + 0.65 * visual.leafiness,
      duration: 1,
      ease: 'power2.out',
    })
    gsap.to(glowRef.current, { opacity: visual.glow, duration: 1 })
  }, [
    visual.canopyCore,
    visual.canopyRim,
    visual.trunkLight,
    visual.trunkDark,
    visual.leafiness,
    visual.glow,
  ])

  useEffect(() => {
    gsap.to(groundRef.current, { attr: { rx: shadowRx, ry: shadowRx * 0.16 }, duration: 1 })
  }, [shadowRx])

  // Always-alive idle motion — each leaf mass sways on its own phase + speed, so the
  // canopy shimmers like real foliage instead of rotating as one rigid clump. Each
  // blob rotates about its own centre (GSAP's default SVG origin = its bounding box).
  useEffect(() => {
    const crown = crownRef.current
    if (!crown || reduced) return
    const masses = gsap.utils.toArray<SVGElement>(crown.querySelectorAll('.leaf-mass'))
    // repeatRefresh re-rolls the random() values every cycle → no two sways alike.
    // Rotation only — the per-leaf `y` axis is reserved for the wilt droop below.
    const tweens = masses.map((m) =>
      gsap.to(m, {
        rotation: 'random(-3, 3)',
        duration: 'random(2.4, 5)',
        repeat: -1,
        yoyo: true,
        repeatRefresh: true,
        ease: 'sine.inOut',
        delay: gsap.utils.random(0, 2.5),
      }),
    )
    return () => tweens.forEach((t) => t.kill())
  }, [oak, reduced])

  // Wind — irregular gusts that ripple across the canopy. Each gust re-randomizes its
  // interval, strength, and direction, so it never feels like a metronome. Layered on the
  // x axis so it composes with the idle sway (rotation+y) instead of fighting it.
  useEffect(() => {
    const crown = crownRef.current
    if (!crown || reduced) return
    const masses = gsap.utils.toArray<SVGElement>(crown.querySelectorAll('.leaf-mass'))
    if (!masses.length) return
    const indices = masses.map((_, i) => i)
    let stopped = false
    let pending: gsap.core.Tween | null = null
    let live: gsap.core.Tween[] = []

    const gust = () => {
      if (stopped) return
      live.forEach((t) => t.kill())
      const dir = Math.random() < 0.5 ? 1 : -1 // breeze sweeps left→right or right→left
      const strength = gsap.utils.random(3, 9)
      const order = [...indices].sort((a, b) => (oak.crown[a].cx - oak.crown[b].cx) * dir)
      live = order.map((idx, rank) =>
        gsap.to(masses[idx], {
          x: dir * strength * gsap.utils.random(0.7, 1.2),
          duration: gsap.utils.random(0.45, 0.85),
          delay: rank * gsap.utils.random(0.05, 0.1),
          yoyo: true,
          repeat: 1,
          ease: 'sine.inOut',
        }),
      )
      pending = gsap.delayedCall(gsap.utils.random(3.5, 11), gust)
    }
    pending = gsap.delayedCall(gsap.utils.random(1.5, 5), gust)

    return () => {
      stopped = true
      pending?.kill()
      live.forEach((t) => t.kill())
      gsap.set(masses, { x: 0 })
    }
  }, [oak, reduced])

  // Breathing light — the warm glow slowly swells, like dappled sun shifting.
  useEffect(() => {
    if (reduced) return
    const el = glowRef.current
    const tween = gsap.to(el, {
      scale: 1.12,
      svgOrigin: `${cx} ${cy}`,
      duration: 4.5,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    })
    return () => {
      tween.kill()
      gsap.set(el, { scale: 1 })
    }
  }, [cx, cy, reduced])

  // Ambient life — on a healthy tree a leaf occasionally drifts down. Each drift starts
  // from a random spot in the crown and takes a random path/duration after a random pause,
  // so it's never the same arc twice.
  useEffect(() => {
    if (reduced || dying || visual.glow <= 0.5) return
    const el = ambientLeafRef.current
    if (!el) return
    let stopped = false
    let pending: gsap.core.Tween | null = null
    let active: gsap.core.Tween | null = null

    const drift = () => {
      if (stopped) return
      const c = oak.crown[Math.floor(Math.random() * oak.crown.length)]
      gsap.set(el, { attr: { cx: c.cx, cy: c.cy } })
      active = gsap.fromTo(
        el,
        { x: 0, y: 0, rotation: 0, opacity: 0.85 },
        {
          x: gsap.utils.random(-26, 36),
          y: gsap.utils.random(150, 200),
          rotation: gsap.utils.random(120, 340),
          opacity: 0,
          duration: gsap.utils.random(5, 8),
          ease: 'sine.in',
          onComplete: () => {
            pending = gsap.delayedCall(gsap.utils.random(6, 16), drift)
          },
        },
      )
    }
    pending = gsap.delayedCall(gsap.utils.random(2, 8), drift)

    return () => {
      stopped = true
      pending?.kill()
      active?.kill()
      gsap.set(el, { opacity: 0 })
    }
  }, [oak, dying, visual.glow, reduced])

  // The dying tremble.
  useEffect(() => {
    if (!visual.tremble || reduced) return
    const el = bodyRef.current
    const tween = gsap.to(el, { x: 1.5, duration: 0.07, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    return () => {
      tween.kill()
      gsap.set(el, { x: 0 })
    }
  }, [visual.tremble, reduced])

  // Mount fade-in — so swapping in/out of a gravestone dissolves instead of popping.
  // fromTo with an explicit target (not gsap.from) is StrictMode-safe: a double-invoked
  // effect would otherwise read the just-set opacity:0 as the target and stay invisible.
  useEffect(() => {
    gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power1.out' })
  }, [])

  // On a stage promotion, snapshot the previous skeleton as the outgoing ghost.
  useEffect(() => {
    const prev = prevStageRef.current
    if (visual.stageIndex !== prev) {
      setOutgoing(varyOak(tree.generation, prev))
      prevStageRef.current = visual.stageIndex
    }
  }, [visual.stageIndex, tree.generation])

  // Fade the ghost out, then drop it. (fromTo → StrictMode-safe.)
  useEffect(() => {
    if (!outgoing) return
    const tween = gsap.fromTo(
      ghostRef.current,
      { opacity: 1 },
      { opacity: 0, duration: 0.7, ease: 'power2.inOut', onComplete: () => setOutgoing(null) },
    )
    return () => {
      tween.kill()
    }
  }, [outgoing])

  // Dying: leaves drift down and an acorn drops (the seed of the next generation).
  useEffect(() => {
    if (!dying || reduced) return
    const leaves = gsap.utils.toArray<SVGElement>(
      fallingRef.current?.querySelectorAll('.fall-leaf') ?? null,
    )
    const tweens = leaves.map((leaf) =>
      gsap.fromTo(
        leaf,
        { y: 0, x: 0, rotation: 0, opacity: 0.9 },
        {
          y: 'random(140, 178)',
          x: 'random(-32, 32)',
          rotation: 'random(120, 280)',
          opacity: 0,
          duration: 'random(2, 3.3)',
          ease: 'sine.in',
          repeat: -1,
          repeatRefresh: true,
          delay: gsap.utils.random(0, 2.5),
        },
      ),
    )
    const acorn = fallingRef.current?.querySelector('.fall-acorn') ?? null
    const acornTween = gsap.fromTo(
      acorn,
      { y: 0, opacity: 1 },
      { y: 150, duration: 1.2, ease: 'bounce.out', repeat: -1, repeatDelay: 1.6 },
    )
    return () => {
      tweens.forEach((t) => t.kill())
      acornTween.kill()
    }
  }, [dying, reduced])

  // "Touch me" invitation when the tree needs care.
  useEffect(() => {
    if (!wantsCare || reduced) return
    const el = auraRef.current
    const tween = gsap.fromTo(
      el,
      { scale: 0.6, opacity: 0.45, svgOrigin: `${cx} ${cy}` },
      { scale: 1.5, opacity: 0, duration: 1.8, repeat: -1, ease: 'sine.out' },
    )
    return () => {
      tween.kill()
      gsap.set(el, { opacity: 0 })
    }
  }, [wantsCare, cx, cy, reduced])

  const handleTend = () => {
    if (!canTend) {
      // empty watering can — a small "nothing left" wobble instead of a false success
      gsap.fromTo(bodyRef.current, { x: -2 }, { x: 0, duration: 0.4, ease: 'elastic.out(1.5, 0.3)' })
      return
    }
    onTend()
    if (!reduced) {
      gsap.fromTo(
        rippleRef.current,
        { scale: 0.3, opacity: 0.7, svgOrigin: `${cx} ${cy}` },
        { scale: 3, opacity: 0, duration: 0.7, ease: 'power2.out' },
      )
      // leaves perk up — a scale pop on the masses (doesn't touch the crown's wilt y/scaleY)
      const masses = crownRef.current?.querySelectorAll('.leaf-mass')
      if (masses?.length) {
        gsap.fromTo(
          masses,
          { scale: 1.08 },
          { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)', stagger: 0.02 },
        )
      }
    }
  }

  return (
    <svg
      ref={rootRef}
      className="tree"
      viewBox="0 0 260 260"
      role="button"
      aria-label={canTend ? 'tend the tree' : 'tend the tree — your watering can is empty'}
      tabIndex={0}
      onPointerDown={handleTend}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleTend()
      }}
    >
      <defs>
        <radialGradient id="oakCanopy" cx="38%" cy="30%" r="80%">
          <stop ref={rimStopRef} offset="0%" stopColor={visual.canopyRim} />
          <stop ref={coreStopRef} offset="100%" stopColor={visual.canopyCore} />
        </radialGradient>
        <linearGradient id="oakBark" x1="0" y1="0" x2="1" y2="0">
          <stop ref={barkLightRef} offset="0%" stopColor={visual.trunkLight} />
          <stop ref={barkDarkRef} offset="100%" stopColor={visual.trunkDark} />
        </linearGradient>
        <radialGradient id="oakGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff3c4" stopOpacity="0.8" />
          <stop offset="70%" stopColor="#ffe9a8" stopOpacity="0" />
        </radialGradient>
        <filter id="oakShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#1f4a2c" floodOpacity="0.2" />
        </filter>
      </defs>

      <ellipse ref={groundRef} className="ground" cx="130" cy="244" rx={shadowRx} ry={shadowRx * 0.16} />

      <g ref={bodyRef}>
        {/* live tree */}
        <OakShapes oak={oak} visual={visual} crownRef={crownRef} glowRef={glowRef} />

        {/* outgoing stage, crossfading out on a promotion so size doesn't pop */}
        {outgoing && (
          <g ref={ghostRef}>
            <OakShapes oak={outgoing} visual={visual} />
          </g>
        )}

        <circle
          ref={auraRef}
          cx={cx}
          cy={cy}
          r="50"
          fill="none"
          stroke={visual.canopyRim}
          strokeWidth="2"
          opacity="0"
        />
        <circle
          ref={rippleRef}
          cx={cx}
          cy={cy}
          r="20"
          fill="none"
          stroke={visual.canopyRim}
          strokeWidth="2.5"
          opacity="0"
        />
      </g>

      {/* dying: shed leaves + a dropping acorn (the seed of the next generation) */}
      {dying && (
        <g ref={fallingRef}>
          {oak.crown.slice(0, 7).map((c, i) => (
            <ellipse
              key={`fl${i}`}
              className="fall-leaf"
              cx={c.cx}
              cy={c.cy}
              rx="5"
              ry="3"
              fill={visual.canopyCore}
              opacity="0.9"
            />
          ))}
          <g className="fall-acorn">
            <ellipse cx={cx} cy={cy + 24} rx="3" ry="4" fill="#a9743f" />
            <path
              d={`M${cx - 3.4} ${cy + 21} Q${cx} ${cy + 18.6} ${cx + 3.4} ${cy + 21} Q${cx} ${cy + 23} ${cx - 3.4} ${cy + 21} Z`}
              fill="#6b4423"
            />
          </g>
        </g>
      )}

      {/* a single leaf that drifts down now and then on a healthy tree (ambient life) */}
      <ellipse
        ref={ambientLeafRef}
        cx={cx + 20}
        cy={cy}
        rx="5"
        ry="3"
        fill={visual.canopyCore}
        opacity="0"
      />
    </svg>
  )
}
