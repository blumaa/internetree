// Provisional, tunable values. Numeric balance is a playtest concern (PLAN.md "Open").
// The engine reads ONLY from here — never inline magic numbers in tree.ts.

import type { Stage } from './types'

export const HEALTH_MAX = 100

/** Health restored by a single tend. */
export const TEND_BUMP = 8

/** Growth points gained per tend — but only while healthy (see gate). */
export const GROWTH_PER_TEND = 1

/** A tend only grows the tree if current health is at least this. ("grows only while healthy") */
export const GROWTH_HEALTH_GATE = 50

// Cold-start protection / "slow & ambient" tempo: even a brand-new untended sprout
// survives ~a day, so a quiet stretch can't trivially kill it and death stays RARE
// (which is what makes permadeath land). Coupling means a grown tree lasts weeks+.
/** Time for a growth-0 sprout to fall from full health to 0 with zero tending. */
export const BASE_DROUGHT_MS = 24 * 60 * 60 * 1000 // 24 hours

/** Each growth point lengthens the drought (slower decay). Coupled resilience. */
export const RESILIENCE_PER_GROWTH = 0.05

/** Grace window in the critical (dying) state before true death, for a growth-0 sprout. */
export const BASE_GRACE_MS = 6 * 60 * 60 * 1000 // 6 hours

/** Below this health the tree sheds leaves + drops its acorn (the dying beat). */
export const SHED_HEALTH = 38

/** Each growth point lengthens the death-grace window. Coupled resilience. */
export const GRACE_PER_GROWTH_MS = 60 * 1000 // +1 min per growth point

/** Memorial / mourning duration after death before the next generation auto-plants. */
export const MOURNING_MS = 60 * 60 * 1000 // 1 hour

// "Watering can" rate limit: a device holds up to CAP drops, refilling one every
// REFILL. Lets you tend a satisfying few times per visit, but still bounded so no
// single person can keep the tree alive alone — it takes a crowd.
export const TEND_BUCKET_CAP = 5
export const TEND_REFILL_MS = 3 * 60 * 1000 // one drop every 3 minutes

// Reconstructing "the crowd" from recent tends (no realtime needed):
/** Distinct people who tended within this window = "kept alive by N people". */
export const KEEPER_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours
/** Tends within this window surface as ambient motes of light around the tree. */
export const MOTE_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
/** Cap the stored tend log so it can't grow unbounded. */
export const TEND_LOG_CAP = 1000

/** Stage names in order, smallest to largest. */
export const STAGES: readonly Stage[] = ['sprout', 'sapling', 'young', 'mature', 'ancient']

/** Minimum growth to be AT each stage (parallel to STAGES). */
export const STAGE_THRESHOLDS: readonly number[] = [0, 15, 50, 120, 300]

/** Health at/above each value maps to the mood; checked high → low. */
export const MOOD_THRESHOLDS = {
  thriving: 75,
  content: 40,
  wilting: 1, // 1..39
  // health === 0 → 'critical'
} as const
