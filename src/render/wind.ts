// The wind model — pure math, no DOM, no GSAP. One global wind signal that every
// part of the tree (trunk, limbs, leaf masses, edge leaves) follows through its own
// exposure and lag, so the whole oak moves coherently instead of as independent
// wobbling parts.

import { crownHeightWeight, TRUNK_X } from './oakSkeleton'

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/**
 * The breeze field at time `tSec` (seconds) and spatial `phase`: three incommensurate
 * sine layers, so the signal undulates forever without a visible repeat or metronome
 * beat. Roughly within [-1, 1]. Tie `phase` to an element's x position and the slow
 * layers travel across the canopy as waves.
 */
export function breeze(tSec: number, phase: number): number {
  return (
    0.55 * Math.sin(0.7 * tSec + phase) +
    0.3 * Math.sin(1.9 * tSec + 1.3 + phase * 1.7) +
    0.15 * Math.sin(4.7 * tSec + 4.1 + phase * 2.3)
  )
}

/**
 * How much wind a point on the tree feels, 0..~1.2: the high outer canopy whips,
 * the sheltered core near the trunk barely stirs. This vertical/lateral gradient is
 * what makes the motion read as one tree in wind instead of uniform jiggle.
 */
export function exposureAt(cx: number, cy: number): number {
  const height = clamp01(crownHeightWeight(cy))
  const edge = clamp01(Math.abs(cx - TRUNK_X) / 60)
  return 0.25 + 0.7 * height + 0.25 * edge
}

/**
 * Frame-rate-independent exponential approach: `current` moves toward `target` with
 * time-constant `tauSec`. Each part of the tree filters the same wind through its own
 * tau — stiff limbs lag, light leaves snap — which is where the natural feel comes from.
 */
export function approach(current: number, target: number, tauSec: number, dtSec: number): number {
  if (tauSec <= 0) return target
  return current + (target - current) * (1 - Math.exp(-dtSec / tauSec))
}

/**
 * Response lag (seconds) for a part with swing amplitude `amp`: big-swinging leafy
 * parts snap to the wind almost immediately, stiff low-amplitude wood follows late —
 * the lag differential is what makes a gust ripple through the tree.
 */
export function tauFor(amp: number): number {
  return Math.min(0.5, Math.max(0.12, 0.5 - amp * 0.07))
}
