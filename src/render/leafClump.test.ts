import { describe, it, expect } from 'vitest'
import { leafyBlobPath } from './leafClump'

describe('leafyBlobPath', () => {
  it('is a closed SVG path', () => {
    const d = leafyBlobPath(100, 100, 30)
    expect(d.startsWith('M')).toBe(true)
    expect(d.trim().endsWith('Z')).toBe(true)
  })

  it('has one rounded lobe per requested lobe', () => {
    const d = leafyBlobPath(100, 100, 30, 9)
    expect((d.match(/Q/g) ?? []).length).toBe(9)
  })

  it('is deterministic — same inputs, same path', () => {
    expect(leafyBlobPath(80, 120, 25, 8)).toBe(leafyBlobPath(80, 120, 25, 8))
  })

  it('differs by position and size', () => {
    expect(leafyBlobPath(80, 120, 25)).not.toBe(leafyBlobPath(140, 120, 25))
    expect(leafyBlobPath(80, 120, 25)).not.toBe(leafyBlobPath(80, 120, 40))
  })

  it('roughly respects the radius (points fall near r from centre)', () => {
    const cx = 100
    const cy = 100
    const r = 40
    const d = leafyBlobPath(cx, cy, r)
    const nums = d.match(/-?\d+\.?\d*/g)!.map(Number)
    // every coordinate stays within ~1.4r of the centre
    for (let i = 0; i < nums.length; i += 2) {
      const dist = Math.hypot(nums[i] - cx, nums[i + 1] - cy)
      expect(dist).toBeLessThan(r * 1.5)
    }
  })
})
