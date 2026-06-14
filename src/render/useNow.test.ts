import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNow } from './useNow'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useNow', () => {
  it('returns the current time', () => {
    vi.setSystemTime(1_700_000_000_000)
    const { result } = renderHook(() => useNow(30_000))
    expect(result.current).toBe(1_700_000_000_000)
  })

  it('ticks forward on the given interval', () => {
    vi.setSystemTime(1_700_000_000_000)
    const { result } = renderHook(() => useNow(30_000))
    act(() => vi.advanceTimersByTime(30_000))
    expect(result.current).toBe(1_700_000_030_000)
  })

  it('does not tick before the interval elapses', () => {
    vi.setSystemTime(1_700_000_000_000)
    const { result } = renderHook(() => useNow(30_000))
    act(() => vi.advanceTimersByTime(29_000))
    expect(result.current).toBe(1_700_000_000_000)
  })

  it('stops ticking after unmount', () => {
    vi.setSystemTime(1_700_000_000_000)
    const { unmount } = renderHook(() => useNow(30_000))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
