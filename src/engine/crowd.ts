// "The crowd", reconstructed from the recent tend log (no realtime needed) — THE
// keeper/mote rule, shared by the local backend and the `tree` Edge Function (SSOT:
// if the definition of a keeper changes, both backends move together).

import { KEEPER_WINDOW_MS, MOTE_WINDOW_MS } from './config.ts'

export interface TendRecord {
  device: string
  at: number
}

/** keepers = distinct devices in the keeper window; recentTends = mote-window timestamps. */
export function crowdStats(
  tends: TendRecord[],
  now: number,
): { keepers: number; recentTends: number[] } {
  const recent = tends.filter((t) => t.at >= now - KEEPER_WINDOW_MS)
  const keepers = new Set(recent.map((t) => t.device)).size
  const moteCutoff = now - MOTE_WINDOW_MS
  const recentTends = recent.filter((t) => t.at >= moteCutoff).map((t) => t.at)
  return { keepers, recentTends }
}
