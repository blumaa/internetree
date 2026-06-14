import { describe, it, expect, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useInternetree } from './useInternetree'
import type { LoadResult, TendResult, TreeBackend } from '../backend/types'
import { createTree } from '../engine/tree'

const T = 1_700_000_000_000

function result(tokens: number): LoadResult {
  return {
    remote: {
      tree: { ...createTree(T), generation: 3 },
      history: [],
      keepers: 7,
      recentTends: [T],
    },
    device: { tokens, nextTokenAt: 0 },
  }
}

// The hook re-loads when the backend identity changes, so tests must pass a
// stable instance — never call ok() inline inside renderHook's callback.
const ok = (tokens: number): TreeBackend => ({
  load: async () => result(tokens),
  tend: async (): Promise<TendResult> => ({ ...result(Math.max(0, tokens - 1)), accepted: tokens > 0 }),
})

describe('useInternetree', () => {
  it('auto-loads the shared state on mount', async () => {
    const backend = ok(5)
    const { result: r } = renderHook(() => useInternetree(backend))
    await waitFor(() => expect(r.current.keepers).toBe(7))
    expect(r.current.tree.generation).toBe(3)
    expect(r.current.tokens).toBe(5)
    expect(r.current.canTend).toBe(true)
    expect(r.current.error).toBeNull()
  })

  it('surfaces an error and clears "syncing" when the backend fails', async () => {
    const failing: TreeBackend = {
      load: async () => {
        throw new Error('offline')
      },
      tend: async () => {
        throw new Error('offline')
      },
    }
    const { result: r } = renderHook(() => useInternetree(failing))
    await waitFor(() => expect(r.current.error).toBe('could not reach the tree'))
    expect(r.current.syncing).toBe(false)
  })

  it('reports an empty watering can as not tendable', async () => {
    const backend = ok(0)
    const { result: r } = renderHook(() => useInternetree(backend))
    await waitFor(() => expect(r.current.tokens).toBe(0))
    expect(r.current.canTend).toBe(false)
  })

  it('is syncing while the initial mount load is in flight', async () => {
    let resolveLoad!: (r: LoadResult) => void
    const backend: TreeBackend = {
      load: () => new Promise((res) => (resolveLoad = res)),
      tend: async () => ({ ...result(4), accepted: true }),
    }
    const { result: r } = renderHook(() => useInternetree(backend))
    expect(r.current.syncing).toBe(true)
    await act(async () => resolveLoad(result(5)))
    expect(r.current.syncing).toBe(false)
    expect(r.current.keepers).toBe(7)
  })

  it('is syncing while a tend is in flight', async () => {
    let resolveTend!: (r: TendResult) => void
    const backend: TreeBackend = {
      load: async () => result(5),
      tend: () => new Promise((res) => (resolveTend = res)),
    }
    const { result: r } = renderHook(() => useInternetree(backend))
    await waitFor(() => expect(r.current.tokens).toBe(5))
    act(() => r.current.tend())
    expect(r.current.syncing).toBe(true)
    await act(async () => resolveTend({ ...result(4), accepted: true }))
    expect(r.current.syncing).toBe(false)
    expect(r.current.tokens).toBe(4)
  })

  it('discards a stale load that resolves after a tend', async () => {
    let resolveSlowLoad!: (r: LoadResult) => void
    let loads = 0
    const backend: TreeBackend = {
      load: () => {
        loads += 1
        if (loads === 1) return Promise.resolve(result(5))
        return new Promise((res) => (resolveSlowLoad = res))
      },
      tend: async () => ({ ...result(2), accepted: true }),
    }
    const { result: r } = renderHook(() => useInternetree(backend))
    await waitFor(() => expect(r.current.tokens).toBe(5))

    act(() => r.current.sync()) // slow load now in flight
    act(() => r.current.tend()) // tend lands first — its response is canonical
    await waitFor(() => expect(r.current.tokens).toBe(2))

    await act(async () => resolveSlowLoad(result(5))) // stale — must not clobber the tend
    expect(r.current.tokens).toBe(2)
    expect(r.current.syncing).toBe(false)
  })

  it('exposes when the next watering-can drop lands', async () => {
    const at = T + 120_000
    const backend: TreeBackend = {
      load: async () => ({ ...result(3), device: { tokens: 3, nextTokenAt: at } }),
      tend: async () => ({ ...result(2), accepted: true }),
    }
    const { result: r } = renderHook(() => useInternetree(backend))
    await waitFor(() => expect(r.current.nextTokenAt).toBe(at))
  })

  it('reports the last tend so the UI can confirm the contribution', async () => {
    const backend = ok(5)
    const { result: r } = renderHook(() => useInternetree(backend))
    await waitFor(() => expect(r.current.tokens).toBe(5))
    expect(r.current.lastTend).toBeNull()

    await act(async () => r.current.tend())
    expect(r.current.lastTend).toMatchObject({ accepted: true, wasStruggling: false })
  })

  it('gives each tend a fresh id so confirmations re-animate', async () => {
    const backend = ok(5)
    const { result: r } = renderHook(() => useInternetree(backend))
    await waitFor(() => expect(r.current.tokens).toBe(5))
    await act(async () => r.current.tend())
    const first = r.current.lastTend!.id
    await act(async () => r.current.tend())
    expect(r.current.lastTend!.id).not.toBe(first)
  })

  it('marks a tend on a struggling tree so the UI can say thank you', async () => {
    const struggling: TreeBackend = {
      load: async () => {
        const res = result(5)
        return { ...res, remote: { ...res.remote, tree: { ...res.remote.tree, health: 20 } } }
      },
      tend: async () => ({ ...result(4), accepted: true }),
    }
    const { result: r } = renderHook(() => useInternetree(struggling))
    await waitFor(() => expect(r.current.tree.health).toBe(20))
    await act(async () => r.current.tend())
    expect(r.current.lastTend).toMatchObject({ accepted: true, wasStruggling: true })
  })

  it('floors the refill resync so a fast client clock cannot poll-loop', async () => {
    vi.useFakeTimers()
    try {
      let loads = 0
      const backend: TreeBackend = {
        // nextTokenAt always in the (client's) past — the skewed-clock worst case
        load: async () => {
          loads += 1
          return { ...result(2), device: { tokens: 2, nextTokenAt: Date.now() - 1_000 } }
        },
        tend: async () => ({ ...result(1), accepted: true }),
      }
      const { result: r } = renderHook(() => useInternetree(backend))
      await act(() => vi.advanceTimersByTimeAsync(0)) // flush the mount load
      expect(r.current.tokens).toBe(2)
      expect(loads).toBe(1)

      await act(() => vi.advanceTimersByTimeAsync(1_000))
      expect(loads).toBe(1) // no sub-second re-sync loop

      await act(() => vi.advanceTimersByTimeAsync(4_500))
      expect(loads).toBe(2) // retried, but no sooner than the floor
    } finally {
      vi.useRealTimers()
    }
  })

  it('flags a rescue when a sync shows the tree pulled back from critical', async () => {
    let loads = 0
    const backend: TreeBackend = {
      load: async () => {
        loads += 1
        const res = result(5)
        const tree =
          loads === 1
            ? { ...res.remote.tree, health: 0, status: 'critical' as const, criticalSince: T }
            : { ...res.remote.tree, health: 30 }
        return { ...res, remote: { ...res.remote, tree } }
      },
      tend: async () => ({ ...result(4), accepted: true }),
    }
    const { result: r } = renderHook(() => useInternetree(backend))
    await waitFor(() => expect(r.current.tree.status).toBe('critical'))

    act(() => r.current.sync())
    await waitFor(() => expect(r.current.lastDelta).not.toBeNull())
    expect(r.current.lastDelta!.rescued).toBe(true)
  })
})
