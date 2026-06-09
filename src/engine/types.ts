// The canonical, backend-agnostic shape of the one shared tree.
// Stored verbatim by the driver (local harness in Stage 1, Supabase in Stage 2).
// `health` is the value AS OF `updatedAt`; the live value is derived by `project`.

export type TreeStatus = 'alive' | 'critical' | 'dead'

export type Stage = 'sprout' | 'sapling' | 'young' | 'mature' | 'ancient'

export type Mood = 'thriving' | 'content' | 'wilting' | 'critical'

export interface TreeState {
  /** Lineage number. Starts at 1, increments on each rebirth. */
  generation: number
  /** 0..HEALTH_MAX, the value at `updatedAt`. Recoverable mood axis. */
  health: number
  /** >= 0, monotonic. The one-way monument axis (maps to Stage). */
  growth: number
  status: TreeStatus
  /** ms epoch of the last state write. Decay is measured from here. */
  updatedAt: number
  /** ms epoch when this generation sprouted. */
  bornAt: number
  /** ms epoch when health first hit 0 (start of the death-grace window); null if not critical. */
  criticalSince: number | null
  /** ms epoch of death; null while alive/critical. Drives mourning + memorial. */
  diedAt: number | null
  /** Total tends received this generation. Memorial stat. */
  tendCount: number
}
