import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import type { TreeState } from '../engine/types'
import { visualFor } from './visual'
import { varyOak, crownHeightWeight, TRUNK_X, type OakStage } from './oakSkeleton'
import { OakShapes } from './OakShapes'
import { useReducedMotion } from './useReducedMotion'
import { breeze, approach, tauFor } from './wind'
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
    const tween = gsap.to(bodyRef.current, {
      scale: visual.scale,
      svgOrigin: '130 244', // pivot at the trunk base
      duration: 1.1,
      ease: 'elastic.out(0.5, 0.7)',
    })
    return () => {
      tween.kill()
    }
  }, [visual.scale])

  // Wilt = a DISTRIBUTED droop, not a rigid block moving. As health falls, each leaf mass
  // loses turgor and hangs down — outer/upper masses sag more than the inner core — so the
  // canopy slumps organically while the trunk + roots stay planted. (Health, not age:
  // a thriving ancient oak has lean=0 and stands tall.)
  useEffect(() => {
    const crown = crownRef.current
    if (!crown) return
    const masses = gsap.utils.toArray<SVGElement>(crown.querySelectorAll('.leaf-mass'))
    const tweens: gsap.core.Tween[] = []
    masses.forEach((m, i) => {
      const c = oak.crown[i]
      if (!c) return
      const height = gsap.utils.clamp(0, 1, crownHeightWeight(c.cy)) // 0 low → 1 top of crown
      tweens.push(gsap.to(m, { y: visual.lean * (0.3 + 0.5 * height), duration: 1, ease: 'power2.out' }))
    })
    return () => tweens.forEach((t) => t.kill())
  }, [visual.lean, oak])

  // Health mood-layer: recolour gradients, thin the crown.
  useEffect(() => {
    const tweens = [
      gsap.to(coreStopRef.current, { attr: { 'stop-color': visual.canopyCore }, duration: 1 }),
      gsap.to(rimStopRef.current, { attr: { 'stop-color': visual.canopyRim }, duration: 1 }),
      gsap.to(barkLightRef.current, { attr: { 'stop-color': visual.trunkLight }, duration: 1 }),
      gsap.to(barkDarkRef.current, { attr: { 'stop-color': visual.trunkDark }, duration: 1 }),
      // Health changes FULLNESS (opacity), never SIZE — so nothing jumps on a mood change.
      gsap.to(crownRef.current, {
        opacity: 0.35 + 0.65 * visual.leafiness,
        duration: 1,
        ease: 'power2.out',
      }),
      gsap.to(glowRef.current, { opacity: visual.glow, duration: 1 }),
    ]
    return () => tweens.forEach((t) => t.kill())
  }, [
    visual.canopyCore,
    visual.canopyRim,
    visual.trunkLight,
    visual.trunkDark,
    visual.leafiness,
    visual.glow,
  ])

  useEffect(() => {
    const tween = gsap.to(groundRef.current, { attr: { rx: shadowRx, ry: shadowRx * 0.16 }, duration: 1 })
    return () => {
      tween.kill()
    }
  }, [shadowRx])

  // Wind — ONE shared wind signal (layered-sine breeze + scheduled irregular gusts)
  // that every `.wind-sway` part follows by rotating about its own attach point,
  // each through its own low-pass filter. Exposure (stamped by OakShapes) makes the
  // high outer canopy whip while the sheltered core barely stirs; the lag differential
  // (tauFor) makes gusts ripple through stiff wood late — so trunk, branches, boughs
  // and leaves move as one connected tree, never as independent uniform jiggle.
  useEffect(() => {
    const body = bodyRef.current
    if (!body || reduced) return
    const els = gsap.utils.toArray<SVGElement>(body.querySelectorAll('.wind-sway'))
    if (!els.length) return

    const parts = els.flatMap((el) => {
      const x = Number(el.dataset.windX)
      const y = Number(el.dataset.windY)
      const amp = Number(el.dataset.windAmp)
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(amp)) return []
      gsap.set(el, { svgOrigin: `${x} ${y}` })
      return {
        amp,
        flutterAmp: 0.55 * Number(el.dataset.windFlutter ?? 1),
        flutterFreq: gsap.utils.random(9, 16),
        flutterPhase: gsap.utils.random(0, Math.PI * 2),
        // phase tied to x → the slow breeze layers travel across the canopy as waves
        phase: x / 38,
        // ±10% jitter so cluster decorations never track their mass in robotic lockstep
        tau: tauFor(amp) * gsap.utils.random(0.9, 1.1),
        state: 0,
        setRot: gsap.quickSetter(el, 'rotation', 'deg'),
      }
    })

    // The trunk itself flexes a little at the base — the whole tree rides on it.
    gsap.set(body, { svgOrigin: `${TRUNK_X} 244` })
    const setTrunk = gsap.quickSetter(body, 'rotation', 'deg')
    let trunkState = 0

    // Gusts: an occasional surge of force in a random direction, sharp attack and a
    // long sigh of a release, then a random lull — never a metronome.
    const gust = { force: 0 }
    let pending: gsap.core.Tween | null = null
    let blow: gsap.core.Timeline | null = null
    const schedule = () => {
      pending = gsap.delayedCall(gsap.utils.random(4, 11), () => {
        const peak = (Math.random() < 0.5 ? -1 : 1) * gsap.utils.random(0.5, 1.3)
        blow = gsap
          .timeline({ onComplete: schedule })
          .to(gust, { force: peak, duration: gsap.utils.random(0.6, 1.3), ease: 'power2.in' })
          .to(gust, { force: 0, duration: gsap.utils.random(1.8, 3.4), ease: 'sine.out' })
      })
    }
    schedule()

    let last = gsap.ticker.time
    const tick = () => {
      const t = gsap.ticker.time
      const dt = Math.min(t - last, 0.1) // clamp tab-switch jumps
      last = t
      if (dt <= 0) return
      for (const p of parts) {
        const target = 0.4 * breeze(t, p.phase) + gust.force
        p.state = approach(p.state, target, p.tau, dt)
        // leaf flutter rides the swing and grows with the wind's strength
        const flutter =
          Math.sin(t * p.flutterFreq + p.flutterPhase) *
          p.flutterAmp *
          (0.3 + 0.7 * Math.min(1, Math.abs(p.state)))
        p.setRot(p.state * p.amp + flutter)
      }
      trunkState = approach(trunkState, 0.4 * breeze(t, TRUNK_X / 38) + gust.force, 0.7, dt)
      setTrunk(trunkState * 0.7)
    }
    gsap.ticker.add(tick)

    return () => {
      gsap.ticker.remove(tick)
      pending?.kill()
      blow?.kill()
      gsap.set(els, { rotation: 0 })
      gsap.set(body, { rotation: 0 })
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
    const tween = gsap.fromTo(
      rootRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.8, ease: 'power1.out' },
    )
    return () => {
      tween.kill()
    }
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
      aria-disabled={!canTend}
      tabIndex={0}
      onPointerDown={handleTend}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault() // Space must tend, not ALSO scroll the page
          handleTend()
        }
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
