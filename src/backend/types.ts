import type { TreeState } from '../engine/types'

/** The shared, server-authoritative state: the living tree + the graveyard of past generations. */
export interface RemoteTree {
  tree: TreeState
  history: TreeState[]
  /** distinct people who tended within the recent window — "kept alive by N people". */
  keepers: number
  /** timestamps of very recent tends, reconstructed into ambient motes of light. */
  recentTends: number[]
}

/** This device's "watering can" — how many tends it has left and when the next drop refills. */
export interface DeviceState {
  tokens: number
  /** ms epoch when the next drop refills (0 if the can is full). */
  nextTokenAt: number
}

export interface LoadResult {
  remote: RemoteTree
  device: DeviceState
}

export interface TendResult {
  remote: RemoteTree
  /** false when the watering can is empty (→ show the soft "invite a friend" nudge). */
  accepted: boolean
  device: DeviceState
}

/**
 * Pull-based backend: `load` fetches current state + this device's can, `tend` spends
 * one drop (rate-limited by a refilling token bucket). No realtime — a sync is a load.
 * Implemented locally for now; a Supabase/HTTP adapter slots in with the same interface.
 *
 * ⚠️ REMOTE ADAPTER SECURITY: `now` is passed in only because the engine is pure +
 * time-injected (so it's testable and the local dev clock can fast-forward). A real
 * server MUST stamp its OWN time and IGNORE any client-supplied `now` — otherwise a
 * client could send a far-future `now` to instantly mature/kill the tree, or a past
 * `now` to dodge the cooldown. Drop `now` from the wire; the server supplies it.
 */
export interface TreeBackend {
  load(deviceId: string, now: number): Promise<LoadResult>
  tend(deviceId: string, now: number): Promise<TendResult>
}
