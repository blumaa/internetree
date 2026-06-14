import type { Mood, TreeState } from '../engine/types'
import { moodFor, stageIndexFor } from '../engine/tree'
import { HEALTH_MAX } from '../engine/config'

/** Pure description of how the tree should look — no DOM, no GSAP. Fully testable. */
export interface TreeVisual {
  stageIndex: number
  /** Overall size multiplier (> 0), monotonic in growth. */
  scale: number
  /** Canopy radial-gradient: deep centre. */
  canopyCore: string
  /** Canopy radial-gradient: bright sunlit rim. */
  canopyRim: string
  /** Bark linear-gradient: lit side. */
  trunkLight: string
  /** Bark linear-gradient: shadowed side. */
  trunkDark: string
  /** Posture droop in degrees: 0 upright, larger = more slumped. */
  lean: number
  /** Canopy fullness, 0 (bare) .. 1 (lush). */
  leafiness: number
  /** Warm backlight glow intensity, 0 (none) .. 1 (golden). */
  glow: number
  /** Only true in the dying (critical) state. */
  tremble: boolean
  mode: 'living' | 'critical' | 'mourning'
}

// Colour comes from the mood band (the 1s GSAP tween smooths each change).
interface MoodColor {
  core: string
  rim: string
  trunkLight: string
  trunkDark: string
}

const MOOD_COLOR: Record<Mood, MoodColor> = {
  thriving: { core: '#2b9348', rim: '#80ed99', trunkLight: '#a9743f', trunkDark: '#6b4423' },
  content: { core: '#40916c', rim: '#95d5b2', trunkLight: '#a9743f', trunkDark: '#6b4423' },
  wilting: { core: '#9c7a3c', rim: '#d4b85a', trunkLight: '#8c6a3c', trunkDark: '#5a3e26' },
  critical: { core: '#6b6b5b', rim: '#9a9a86', trunkLight: '#5c554a', trunkDark: '#403c34' },
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

// Posture, fullness and glow are CONTINUOUS in health — no banded steps, so nothing
// jumps when the mood/status changes. Crucially, health affects fullness (opacity +
// leaf-drop), never the tree's SIZE; size is driven only by growth.
function leanFor(health: number): number {
  return 18 * Math.pow(1 - clamp01(health / HEALTH_MAX), 1.3)
}
function leafinessFor(health: number): number {
  return 0.12 + 0.88 * Math.pow(clamp01(health / HEALTH_MAX), 0.8)
}
function glowFor(health: number): number {
  // dark below 20% health, full golden from 100%
  return clamp01((health - 0.2 * HEALTH_MAX) / (0.8 * HEALTH_MAX))
}

// Per-stage SIZE differentiation lives in the blueprint geometry (a shoot is tiny
// near the soil, an ancient fills the frame). Scale only adds a gentle, continuous
// "still growing" breath within a stage — kept near 1 so the canopy never clips.
const STAGE_BASE_SCALE = 0.95

function scaleFor(growth: number): number {
  return STAGE_BASE_SCALE + Math.log1p(growth) * 0.008
}

export function visualFor(tree: TreeState): TreeVisual {
  const color = MOOD_COLOR[moodFor(tree.health)]
  const mode =
    tree.status === 'dead' ? 'mourning' : tree.status === 'critical' ? 'critical' : 'living'

  return {
    stageIndex: stageIndexFor(tree.growth),
    scale: scaleFor(tree.growth),
    canopyCore: color.core,
    canopyRim: color.rim,
    trunkLight: color.trunkLight,
    trunkDark: color.trunkDark,
    lean: leanFor(tree.health),
    leafiness: leafinessFor(tree.health),
    glow: glowFor(tree.health),
    tremble: tree.status === 'critical',
    mode,
  }
}
