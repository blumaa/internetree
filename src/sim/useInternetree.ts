import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createLocalBackend } from '../backend/localBackend'
import { getDeviceId } from '../backend/deviceId'
import type { LoadResult, RemoteTree, TendResult, TreeBackend } from '../backend/types'
import type { TreeState } from '../engine/types'
import { createTree, stageIndexFor } from '../engine/tree'
import { TEND_BUCKET_CAP } from '../engine/config'

// What changed since you last looked — shown as the "while you were away" catch-up.
export interface Delta {
  tended: number
  grew: boolean
  newGeneration: boolean
  healthDelta: number
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
  lastDelta: Delta | null
  dismissDelta: () => void
  dev: { advance: (ms: number) => void; simulateStrangers: (n: number) => void }
}

function diff(prev: TreeState, next: TreeState): Delta {
  const newGeneration = next.generation !== prev.generation
  return {
    tended: newGeneration ? next.tendCount : Math.max(0, next.tendCount - prev.tendCount),
    grew: stageIndexFor(next.growth) > stageIndexFor(prev.growth),
    newGeneration,
    healthDelta: Math.round(next.health - prev.health),
  }
}

export function useInternetree(backend: TreeBackend = createLocalBackend()): Internetree {
  const [remote, setRemote] = useState<RemoteTree>(() => ({
    tree: createTree(0),
    history: [],
    keepers: 0,
    recentTends: [],
  }))
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokens, setTokens] = useState(TEND_BUCKET_CAP)
  const [nextTokenAt, setNextTokenAt] = useState(0)
  const [lastDelta, setLastDelta] = useState<Delta | null>(null)

  const deviceIdRef = useRef('')
  const offsetRef = useRef(0)
  const prevTreeRef = useRef<TreeState | null>(null)
  // Only LOAD responses race each other; a tend is a write whose response is canonical
  // and must always apply, so it gets no version guard.
  const loadReqRef = useRef(0)

  const now = () => Date.now() + offsetRef.current

  const apply = useCallback((res: LoadResult | TendResult, computeDelta: boolean) => {
    const prev = prevTreeRef.current
    if (computeDelta && prev) setLastDelta(diff(prev, res.remote.tree))
    prevTreeRef.current = res.remote.tree
    setRemote(res.remote)
    setTokens(res.device.tokens)
    setNextTokenAt(res.device.nextTokenAt)
    setError(null)
  }, [])

  const sync = useCallback(() => {
    const req = ++loadReqRef.current
    setSyncing(true)
    backend
      .load(deviceIdRef.current, now())
      .then((res) => {
        if (req === loadReqRef.current) apply(res, true)
      })
      .catch(() => {
        if (req === loadReqRef.current) setError('could not reach the tree')
      })
      .finally(() => {
        if (req === loadReqRef.current) setSyncing(false)
      })
  }, [backend, apply])

  const tend = useCallback(() => {
    backend
      .tend(deviceIdRef.current, now())
      .then((res) => apply(res, false)) // a write's response is canonical — always apply
      .catch(() => setError('your tend didn’t reach the tree'))
  }, [backend, apply])

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
  }, [backend, sync])

  // Mount: identify device, then auto-sync (first load shows no catch-up).
  useEffect(() => {
    deviceIdRef.current = getDeviceId()
    const req = ++loadReqRef.current
    backend
      .load(deviceIdRef.current, now())
      .then((res) => {
        if (req === loadReqRef.current) apply(res, false)
      })
      .catch(() => {
        if (req === loadReqRef.current) setError('could not reach the tree')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the watering can is refilling, re-sync as the next drop lands so it visibly fills.
  useEffect(() => {
    if (nextTokenAt <= 0 || tokens >= TEND_BUCKET_CAP) return
    const delay = Math.max(0, nextTokenAt - now())
    const id = setTimeout(sync, delay + 200)
    return () => clearTimeout(id)
  }, [nextTokenAt, tokens, sync])

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
    lastDelta,
    dismissDelta,
    dev,
  }
}
