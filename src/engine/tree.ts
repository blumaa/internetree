import type { Mood, Stage, TreeState } from './types.ts'
import {
  HEALTH_MAX,
  TEND_BUMP,
  GROWTH_PER_TEND,
  GROWTH_HEALTH_GATE,
  BASE_DROUGHT_MS,
  RESILIENCE_PER_GROWTH,
  BASE_GRACE_MS,
  GRACE_PER_GROWTH_MS,
  MOURNING_MS,
  STAGES,
  STAGE_THRESHOLDS,
  MOOD_THRESHOLDS,
} from './config.ts'

/** Create a fresh, healthy sprout for the given generation. */
export function createTree(now: number, generation = 1): TreeState {
  return {
    generation,
    health: HEALTH_MAX,
    growth: 0,
    status: 'alive',
    updatedAt: now,
    bornAt: now,
    criticalSince: null,
    diedAt: null,
    tendCount: 0,
  }
}

/** Time for a tree of this growth to fall from full health to 0. Coupled resilience. */
function droughtMs(growth: number): number {
  return BASE_DROUGHT_MS * (1 + growth * RESILIENCE_PER_GROWTH)
}

/** Health lost per millisecond at the given growth (coupled resilience). */
export function decayRatePerMs(growth: number): number {
  return HEALTH_MAX / droughtMs(growth)
}

/** Length of the death-grace (critical) window at the given growth. */
export function graceMs(growth: number): number {
  return BASE_GRACE_MS + growth * GRACE_PER_GROWTH_MS
}

/**
 * Advance the tree to `now`: apply health decay, enter critical / die past grace,
 * and auto-replant the next generation once mourning has elapsed. Pure + idempotent.
 */
export function project(state: TreeState, now: number): TreeState {
  if (now <= state.updatedAt) return state

  if (state.status === 'dead') {
    // In memorial until mourning elapses, then the lineage continues.
    if (state.diedAt !== null && now - state.diedAt >= MOURNING_MS) {
      return createTree(state.diedAt + MOURNING_MS, state.generation + 1)
    }
    return state
  }

  const elapsed = now - state.updatedAt
  const decayed = state.health - decayRatePerMs(state.growth) * elapsed

  if (decayed > 0) {
    return { ...state, health: decayed, status: 'alive', criticalSince: null, updatedAt: now }
  }

  // Health has bottomed out. Pin the exact instant it hit 0 (preserved across writes).
  const criticalSince =
    state.criticalSince ?? state.updatedAt + state.health / decayRatePerMs(state.growth)
  const deathAt = criticalSince + graceMs(state.growth)

  if (now >= deathAt) {
    // Stamp updatedAt with the death time (not `now`) so a later catch-up isn't
    // blocked by the `now <= updatedAt` guard and can advance to mourning → rebirth.
    return { ...state, health: 0, status: 'dead', criticalSince, diedAt: deathAt, updatedAt: deathAt }
  }

  return { ...state, health: 0, status: 'critical', criticalSince, diedAt: null, updatedAt: now }
}

/** Apply one act of care at `now` (projects first). Caller owns rate-limiting. */
export function tend(state: TreeState, now: number): TreeState {
  const current = project(state, now)
  if (current.status === 'dead') return current

  // Growth accrues only while the tree is currently healthy ("grows only while healthy").
  const grows = current.health >= GROWTH_HEALTH_GATE
  return {
    ...current,
    health: Math.min(HEALTH_MAX, current.health + TEND_BUMP),
    status: 'alive',
    criticalSince: null,
    growth: current.growth + (grows ? GROWTH_PER_TEND : 0),
    tendCount: current.tendCount + 1,
    updatedAt: now,
  }
}

/**
 * Fully advance a stored state to `now` across any gap — `project` only takes one
 * lifecycle step, so a long absence (die → mourn → rebirth → maybe die again) needs
 * iterating to a fixpoint. Returns the current tree plus every generation that
 * perished along the way (for the graveyard).
 */
export function catchUp(state: TreeState, now: number): { tree: TreeState; perished: TreeState[] } {
  let cur = state
  const perished: TreeState[] = []
  // bounded loop; each iteration either advances time or is the stable fixpoint
  for (let i = 0; i < 1000; i++) {
    const next = project(cur, now)
    if (cur.status === 'dead' && next.generation > cur.generation) perished.push(cur)
    const stable =
      next.generation === cur.generation &&
      next.updatedAt === cur.updatedAt &&
      next.status === cur.status
    cur = next
    if (stable) break
  }
  return { tree: cur, perished }
}

export function stageIndexFor(growth: number): number {
  let index = 0
  for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
    if (growth >= STAGE_THRESHOLDS[i]) index = i
  }
  return index
}

export function stageFor(growth: number): Stage {
  return STAGES[stageIndexFor(growth)]
}

export function moodFor(health: number): Mood {
  if (health >= MOOD_THRESHOLDS.thriving) return 'thriving'
  if (health >= MOOD_THRESHOLDS.content) return 'content'
  if (health >= MOOD_THRESHOLDS.wilting) return 'wilting'
  return 'critical'
}
