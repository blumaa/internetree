import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createLocalBackend } from '../backend/localBackend'
import { createRemoteBackend } from '../backend/remoteBackend'
import { getDeviceId } from '../backend/deviceId'
import type { LoadResult, RemoteTree, TendResult, TreeBackend } from '../backend/types'
import type { TreeState } from '../engine/types'
import { createTree, moodFor, stageIndexFor } from '../engine/tree'
import { TEND_BUCKET_CAP } from '../engine/config'

// What changed since you last looked — shown as the "while you were away" catch-up.
export interface Delta {
  tended: number
  grew: boolean
  newGeneration: boolean
  healthDelta: number
  /** The tree was critical last look and strangers pulled it back. */
  rescued: boolean
}

// The visitor's own last act of care — drives the "+care" confirmation.
export interface LastTend {
  /** Fresh per tend so the confirmation re-animates on every tap. */
  id: number
  accepted: boolean
  /** The tree was wilting or critical when this tend landed — earns a thank-you. */
  wasStruggling: boolean
}

export interface Internetree {
  tree: TreeState
  history: TreeState[]
  keepers: number
  recentTends: number[]
  syncing: boolean
  /** non-null when the last load/tend failed (offline, timeout, server error). */
  error: string | null
  sync: () => void
  tend: () => void
  tokens: number
  maxTokens: number
  canTend: boolean
  /** When the next watering-can drop lands (0 = not refilling). */
  nextTokenAt: number
  lastDelta: Delta | null
  dismissDelta: () => void
  lastTend: LastTend | null
  dev: { advance: (ms: number) => void; simulateStrangers: (n: number) => void }
}

function diff(prev: TreeState, next: TreeState): Delta {
  const newGeneration = next.generation !== prev.generation
  return {
    tended: newGeneration ? next.tendCount : Math.max(0, next.tendCount - prev.tendCount),
    grew: stageIndexFor(next.growth) > stageIndexFor(prev.growth),
    newGeneration,
    healthDelta: Math.round(next.health - prev.health),
    rescued: !newGeneration && prev.status === 'critical' && next.status === 'alive',
  }
}

// Remote (shared) backend when configured; the local single-browser sim otherwise
// (so dev works with no backend). One shared instance.
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const defaultBackend: TreeBackend =
  SUPA_URL && SUPA_KEY ? createRemoteBackend(SUPA_URL, SUPA_KEY) : createLocalBackend()

export function useInternetree(backend: TreeBackend = defaultBackend): Internetree {
  const [remote, setRemote] = useState<RemoteTree>(() => ({
    tree: createTree(0),
    history: [],
    keepers: 0,
    recentTends: [],
  }))
  // true from the start: the mount effect always begins with a load.
  const [syncing, setSyncing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tokens, setTokens] = useState(TEND_BUCKET_CAP)
  const [nextTokenAt, setNextTokenAt] = useState(0)
  const [lastDelta, setLastDelta] = useState<Delta | null>(null)
  const [lastTend, setLastTend] = useState<LastTend | null>(null)
  const tendIdRef = useRef(0)

  const deviceIdRef = useRef('')
  const offsetRef = useRef(0)
  const prevTreeRef = useRef<TreeState | null>(null)
  // Only LOAD responses race each other; a tend is a write whose response is canonical
  // and must always apply, so it gets no version guard.
  const loadReqRef = useRef(0)

  // Stable: reads the dev time-offset ref, so effects can depend on it safely.
  const now = useCallback(() => Date.now() + offsetRef.current, [])

  const apply = useCallback((res: LoadResult | TendResult, computeDelta: boolean) => {
    const prev = prevTreeRef.current
    if (computeDelta && prev) setLastDelta(diff(prev, res.remote.tree))
    prevTreeRef.current = res.remote.tree
    setRemote(res.remote)
    setTokens(res.device.tokens)
    setNextTokenAt(res.device.nextTokenAt)
    setError(null)
  }, [])

  // One load path for mount + manual sync — only the delta flag differs (the very
  // first look shows no "while you were away" catch-up). Callers flip `syncing` on
  // (it starts true, and effects must not set state synchronously); this turns it off.
  const runLoad = useCallback(
    (computeDelta: boolean) => {
      const req = ++loadReqRef.current
      backend
        .load(deviceIdRef.current, now())
        .then((res) => {
          if (req === loadReqRef.current) apply(res, computeDelta)
        })
        .catch(() => {
          if (req === loadReqRef.current) setError('could not reach the tree')
        })
        .finally(() => {
          if (req === loadReqRef.current) setSyncing(false)
        })
    },
    [backend, apply, now],
  )

  const sync = useCallback(() => {
    setSyncing(true)
    runLoad(true)
  }, [runLoad])

  const tend = useCallback(() => {
    // A tend supersedes any in-flight load: bump the version so a stale load response
    // can't clobber the canonical tend response (or its "while you were away" baseline).
    const req = ++loadReqRef.current
    setSyncing(true)
    // Judge "was it struggling" against the state the visitor saw when they tapped.
    const before = prevTreeRef.current
    const wasStruggling = before !== null && ['wilting', 'critical'].includes(moodFor(before.health))
    backend
      .tend(deviceIdRef.current, now())
      .then((res) => {
        apply(res, false) // a write's response is canonical — always apply
        setLastTend({ id: ++tendIdRef.current, accepted: res.accepted, wasStruggling })
      })
      .catch(() => setError('your tend didn’t reach the tree'))
      .finally(() => {
        if (req === loadReqRef.current) setSyncing(false)
      })
  }, [backend, apply, now])

  const dismissDelta = useCallback(() => setLastDelta(null), [])

  const dev = useMemo(() => {
    // Production: no-op + dead real branch → tree-shaken out of the prod bundle entirely,
    // so the time-skip / fake-stranger functions can't reach the live shared tree.
    if (!import.meta.env.DEV) return { advance: () => {}, simulateStrangers: () => {} }
    return {
      advance: (ms: number) => {
        offsetRef.current += ms
        sync()
      },
      simulateStrangers: async (n: number) => {
        for (let i = 0; i < n; i++) await backend.tend(crypto.randomUUID(), now())
        sync()
      },
    }
  }, [backend, sync, now])

  // Mount: identify device, then auto-sync (first load shows no catch-up).
  useEffect(() => {
    deviceIdRef.current = getDeviceId()
    runLoad(false)
  }, [runLoad])

  // When the watering can is refilling, re-sync as the next drop lands so it visibly
  // fills. `nextTokenAt` is SERVER time — a client clock running ahead would compute a
  // zero delay forever (each sync returns another past timestamp) and hammer the
  // backend every 200ms, so the retry is floored to a calm worst case.
  useEffect(() => {
    if (nextTokenAt <= 0 || tokens >= TEND_BUCKET_CAP) return
    const delay = Math.max(0, nextTokenAt - now())
    const id = setTimeout(sync, Math.max(delay + 200, 5_000))
    return () => clearTimeout(id)
  }, [nextTokenAt, tokens, sync, now])

  return {
    tree: remote.tree,
    history: remote.history,
    keepers: remote.keepers,
    recentTends: remote.recentTends,
    syncing,
    error,
    sync,
    tend,
    tokens,
    maxTokens: TEND_BUCKET_CAP,
    canTend: tokens >= 1,
    nextTokenAt,
    lastDelta,
    dismissDelta,
    lastTend,
    dev,
  }
}
