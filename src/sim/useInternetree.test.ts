import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
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

const ok = (tokens: number): TreeBackend => ({
  load: async () => result(tokens),
  tend: async (): Promise<TendResult> => ({ ...result(Math.max(0, tokens - 1)), accepted: tokens > 0 }),
})

describe('useInternetree', () => {
  it('auto-loads the shared state on mount', async () => {
    const { result: r } = renderHook(() => useInternetree(ok(5)))
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
    const { result: r } = renderHook(() => useInternetree(ok(0)))
    await waitFor(() => expect(r.current.tokens).toBe(0))
    expect(r.current.canTend).toBe(false)
  })
})
