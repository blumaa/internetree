import { catchUp, createTree, tend as tendTree } from '../engine/tree'
import {
  TEND_BUCKET_CAP,
  TEND_REFILL_MS,
  KEEPER_WINDOW_MS,
  MOTE_WINDOW_MS,
  TEND_LOG_CAP,
} from '../engine/config'
import type { TreeState } from '../engine/types'
import type { DeviceState, RemoteTree, TreeBackend } from './types'

// A tiny string store so the backend logic is pure + testable (inject in-memory in
// tests, localStorage in the browser). Stage 1.5 simulates the shared server locally.
export interface KVStore {
  read(): string | null
  write(value: string): void
}

interface Bucket {
  tokens: number
  /** ms epoch the tokens were last computed at. */
  at: number
}

interface TendRecord {
  at: number
  device: string
}

interface Stored {
  tree: TreeState
  history: TreeState[]
  /** deviceId → watering-can bucket. */
  buckets: Record<string, Bucket>
  /** rolling log of recent tends, for the keeper count + ambient motes. */
  tends: TendRecord[]
}

export function memoryStore(): KVStore {
  let value: string | null = null
  return {
    read: () => value,
    write: (v) => {
      value = v
    },
  }
}

function browserStore(key: string): KVStore {
  // Guard storage: Safari private mode / disabled storage throws — degrade to ephemeral
  // rather than crashing the app on load.
  return {
    read: () => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    write: (v) => {
      try {
        localStorage.setItem(key, v)
      } catch {
        /* storage unavailable → this session is ephemeral */
      }
    },
  }
}

function readStored(store: KVStore, now: number): Stored {
  const raw = store.read()
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Stored>
      return {
        tree: parsed.tree ?? createTree(now),
        history: parsed.history ?? [],
        buckets: parsed.buckets ?? {},
        tends: parsed.tends ?? [],
      }
    } catch {
      // corrupt → start fresh
    }
  }
  return { tree: createTree(now), history: [], buckets: {}, tends: [] }
}

// "The crowd", reconstructed from the recent tend log — no realtime needed.
function statsFrom(tends: TendRecord[], now: number): Pick<RemoteTree, 'keepers' | 'recentTends'> {
  const keeperCutoff = now - KEEPER_WINDOW_MS
  const recent = tends.filter((t) => t.at >= keeperCutoff)
  const keepers = new Set(recent.map((t) => t.device)).size
  const moteCutoff = now - MOTE_WINDOW_MS
  const recentTends = tends.filter((t) => t.at >= moteCutoff).map((t) => t.at)
  return { keepers, recentTends }
}

// Drop tends older than the keeper window and cap the log length.
function pruneTends(tends: TendRecord[], now: number): TendRecord[] {
  const cutoff = now - KEEPER_WINDOW_MS
  const kept = tends.filter((t) => t.at >= cutoff)
  return kept.length > TEND_LOG_CAP ? kept.slice(kept.length - TEND_LOG_CAP) : kept
}

// Lazily advance the stored tree to `now`, archiving any generations that perished.
function advance(stored: Stored, now: number): Stored {
  const { tree, perished } = catchUp(stored.tree, now)
  if (perished.length === 0 && tree === stored.tree) return stored
  return { ...stored, tree, history: [...stored.history, ...perished] }
}

// Refill a device's watering can based on elapsed time (capped at full).
function refill(bucket: Bucket | undefined, now: number): Bucket {
  if (!bucket) return { tokens: TEND_BUCKET_CAP, at: now }
  const elapsed = Math.max(0, now - bucket.at)
  return { tokens: Math.min(TEND_BUCKET_CAP, bucket.tokens + elapsed / TEND_REFILL_MS), at: now }
}

function deviceState(bucket: Bucket): DeviceState {
  const tokens = Math.floor(bucket.tokens)
  if (tokens >= TEND_BUCKET_CAP) return { tokens: TEND_BUCKET_CAP, nextTokenAt: 0 }
  const frac = bucket.tokens - Math.floor(bucket.tokens)
  return { tokens, nextTokenAt: bucket.at + (1 - frac) * TEND_REFILL_MS }
}

export function createLocalBackend(
  store: KVStore = browserStore('internetree:state'),
): TreeBackend {
  const persist = (s: Stored) => store.write(JSON.stringify(s))

  return {
    async load(deviceId, now) {
      const advanced = advance(readStored(store, now), now)
      const s: Stored = { ...advanced, tends: pruneTends(advanced.tends, now) }
      persist(s)
      const bucket = refill(s.buckets[deviceId], now)
      return {
        remote: { tree: s.tree, history: s.history, ...statsFrom(s.tends, now) },
        device: deviceState(bucket),
      }
    },

    async tend(deviceId, now) {
      const advanced = advance(readStored(store, now), now)
      const s: Stored = { ...advanced, tends: pruneTends(advanced.tends, now) }
      const bucket = refill(s.buckets[deviceId], now)

      if (bucket.tokens < 1) {
        persist({ ...s, buckets: { ...s.buckets, [deviceId]: bucket } })
        return {
          remote: { tree: s.tree, history: s.history, ...statsFrom(s.tends, now) },
          accepted: false,
          device: deviceState(bucket),
        }
      }

      const spent: Bucket = { tokens: bucket.tokens - 1, at: now }
      const next: Stored = {
        ...s,
        tree: tendTree(s.tree, now),
        buckets: { ...s.buckets, [deviceId]: spent },
        tends: [...s.tends, { at: now, device: deviceId }],
      }
      persist(next)
      return {
        remote: { tree: next.tree, history: next.history, ...statsFrom(next.tends, now) },
        accepted: true,
        device: deviceState(spent),
      }
    },
  }
}
