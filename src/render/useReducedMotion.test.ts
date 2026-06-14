import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useReducedMotion } from './useReducedMotion'

function stubMatchMedia(matches: boolean) {
  const mql = {
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql))
  return mql
}

afterEach(() => vi.unstubAllGlobals())

describe('useReducedMotion', () => {
  it('is true on the VERY FIRST render when the OS prefers reduced motion', () => {
    // Must be synchronous — waiting for an effect means infinite GSAP loops
    // already started for one frame (WCAG 2.3.3). Record every render's value:
    // the first one must already be true.
    stubMatchMedia(true)
    const seen: boolean[] = []
    renderHook(() => {
      const v = useReducedMotion()
      seen.push(v)
      return v
    })
    expect(seen[0]).toBe(true)
  })

  it('is false when there is no preference', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('stops listening on unmount', () => {
    const mql = stubMatchMedia(false)
    const { unmount } = renderHook(() => useReducedMotion())
    unmount()
    expect(mql.removeEventListener).toHaveBeenCalled()
  })
})
