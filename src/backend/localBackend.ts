import { catchUp, createTree, tend as tendTree } from '../engine/tree'
import {
  TEND_BUCKET_CAP,
  TEND_REFILL_MS,
  KEEPER_WINDOW_MS,
  TEND_LOG_CAP,
  HISTORY_CAP,
} from '../engine/config'
import { refillBucket, bucketView, type Bucket } from '../engine/bucket'
import { crowdStats, type TendRecord } from '../engine/crowd'
import type { TreeState } from '../engine/types'
import type { DeviceState, TreeBackend } from './types'

// A tiny string store so the backend logic is pure + testable (inject in-memory in
// tests, localStorage in the browser). Stage 1.5 simulates the shared server locally.
export interface KVStore {
  read(): string | null
  write(value: string): void
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

// Drop tends older than the keeper window and cap the log length.
function pruneTends(tends: TendRecord[], now: number): TendRecord[] {
  const cutoff = now - KEEPER_WINDOW_MS
  const kept = tends.filter((t) => t.at >= cutoff)
  return kept.length > TEND_LOG_CAP ? kept.slice(kept.length - TEND_LOG_CAP) : kept
}

// Lazily advance the stored tree to `now`, archiving any generations that perished.
// History keeps only the most recent HISTORY_CAP generations (bounded storage).
function advance(stored: Stored, now: number): Stored {
  const { tree, perished } = catchUp(stored.tree, now)
  if (perished.length === 0 && tree === stored.tree) return stored
  return { ...stored, tree, history: [...stored.history, ...perished].slice(-HISTORY_CAP) }
}

// A bucket past a full refill is identical to no bucket — drop it from storage.
function pruneBuckets(buckets: Record<string, Bucket>, now: number): Record<string, Bucket> {
  const staleBefore = now - TEND_BUCKET_CAP * TEND_REFILL_MS
  const live = Object.entries(buckets).filter(([, b]) => b.at >= staleBefore)
  return live.length === Object.keys(buckets).length ? buckets : Object.fromEntries(live)
}

// The shared bucket primitive, bound to the watering-can size (SSOT with the server).
const refill = (bucket: Bucket | undefined, now: number): Bucket =>
  refillBucket(bucket, now, TEND_BUCKET_CAP, TEND_REFILL_MS)

const deviceState = (bucket: Bucket): DeviceState =>
  bucketView(bucket, TEND_BUCKET_CAP, TEND_REFILL_MS)

export function createLocalBackend(
  store: KVStore = browserStore('internetree:state'),
): TreeBackend {
  const persist = (s: Stored) => store.write(JSON.stringify(s))

  return {
    async load(deviceId, now) {
      const advanced = advance(readStored(store, now), now)
      const s: Stored = {
        ...advanced,
        tends: pruneTends(advanced.tends, now),
        buckets: pruneBuckets(advanced.buckets, now),
      }
      persist(s)
      const bucket = refill(s.buckets[deviceId], now)
      return {
        remote: { tree: s.tree, history: s.history, ...crowdStats(s.tends, now) },
        device: deviceState(bucket),
      }
    },

    async tend(deviceId, now) {
      const advanced = advance(readStored(store, now), now)
      const s: Stored = {
        ...advanced,
        tends: pruneTends(advanced.tends, now),
        buckets: pruneBuckets(advanced.buckets, now),
      }
      const bucket = refill(s.buckets[deviceId], now)

      if (bucket.tokens < 1) {
        persist({ ...s, buckets: { ...s.buckets, [deviceId]: bucket } })
        return {
          remote: { tree: s.tree, history: s.history, ...crowdStats(s.tends, now) },
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
        remote: { tree: next.tree, history: next.history, ...crowdStats(next.tends, now) },
        accepted: true,
        device: deviceState(spent),
      }
    },
  }
}
