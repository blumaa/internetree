import { describe, it, expect } from 'vitest'
import { breeze, exposureAt, approach, tauFor } from './wind'
import { TRUNK_X } from './oakSkeleton'

describe('breeze', () => {
  it('stays within a bounded band', () => {
    for (let t = 0; t < 60; t += 0.05) {
      expect(Math.abs(breeze(t, 0))).toBeLessThanOrEqual(1)
    }
  })

  it('actually varies over time (never a flat calm)', () => {
    const samples = Array.from({ length: 100 }, (_, i) => breeze(i * 0.3, 0))
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.5)
  })

  it('shifts across space — two phases see different wind at the same moment', () => {
    const apart = Array.from({ length: 50 }, (_, i) => breeze(i * 0.7, 0) - breeze(i * 0.7, 3))
    expect(apart.some((d) => Math.abs(d) > 0.2)).toBe(true)
  })
})

describe('exposureAt', () => {
  it('exposes the top of the crown more than the bottom', () => {
    expect(exposureAt(TRUNK_X, 72)).toBeGreaterThan(exposureAt(TRUNK_X, 202))
  })

  it('exposes the outer canopy more than the sheltered centre', () => {
    expect(exposureAt(TRUNK_X + 55, 120)).toBeGreaterThan(exposureAt(TRUNK_X, 120))
  })

  it('never goes fully still nor explodes', () => {
    for (const [cx, cy] of [
      [TRUNK_X, 240],
      [TRUNK_X, 60],
      [TRUNK_X - 80, 70],
      [TRUNK_X + 80, 210],
    ]) {
      const e = exposureAt(cx, cy)
      expect(e).toBeGreaterThan(0)
      expect(e).toBeLessThanOrEqual(1.2)
    }
  })
})

describe('approach', () => {
  it('moves toward the target without overshooting', () => {
    const next = approach(0, 1, 0.3, 0.016)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(1)
  })

  it('converges on the target after a long step', () => {
    expect(approach(0, 1, 0.2, 10)).toBeCloseTo(1, 3)
  })

  it('is frame-rate independent — two half steps equal one full step', () => {
    const half = approach(approach(0, 1, 0.4, 0.1), 1, 0.4, 0.1)
    const full = approach(0, 1, 0.4, 0.2)
    expect(half).toBeCloseTo(full, 6)
  })
})

describe('tauFor', () => {
  it('makes leafy (high-amplitude) parts respond faster than stiff wood', () => {
    expect(tauFor(5)).toBeLessThan(tauFor(1))
  })

  it('stays within sane lag bounds at the extremes', () => {
    expect(tauFor(0)).toBeLessThanOrEqual(0.5)
    expect(tauFor(100)).toBeGreaterThanOrEqual(0.12)
  })
})
