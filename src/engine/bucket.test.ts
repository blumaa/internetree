import { describe, it, expect } from 'vitest'
import { refillBucket, bucketView } from './bucket'

const CAP = 5
const REFILL = 180_000 // one drop every 3 minutes
const T = 1_700_000_000_000

describe('refillBucket', () => {
  it('starts a missing bucket at full capacity', () => {
    expect(refillBucket(undefined, T, CAP, REFILL)).toEqual({ tokens: CAP, at: T })
    expect(refillBucket(null, T, CAP, REFILL)).toEqual({ tokens: CAP, at: T })
  })

  it('refills proportionally to elapsed time', () => {
    const b = refillBucket({ tokens: 2, at: T }, T + 1.5 * REFILL, CAP, REFILL)
    expect(b).toEqual({ tokens: 3.5, at: T + 1.5 * REFILL })
  })

  it('never exceeds the cap', () => {
    const b = refillBucket({ tokens: 4, at: T }, T + 100 * REFILL, CAP, REFILL)
    expect(b.tokens).toBe(CAP)
  })

  it('does not drain when the clock goes backwards', () => {
    const b = refillBucket({ tokens: 2, at: T }, T - REFILL, CAP, REFILL)
    expect(b.tokens).toBe(2)
  })

  it('works for differently-sized buckets (the per-IP ceiling)', () => {
    const b = refillBucket(undefined, T, 60, 30_000)
    expect(b.tokens).toBe(60)
  })
})

describe('bucketView', () => {
  it('reports whole tokens and when the next drop lands', () => {
    const v = bucketView({ tokens: 2.5, at: T }, CAP, REFILL)
    expect(v.tokens).toBe(2)
    expect(v.nextTokenAt).toBe(T + 0.5 * REFILL)
  })

  it('reports a full can with no next-drop time', () => {
    expect(bucketView({ tokens: CAP, at: T }, CAP, REFILL)).toEqual({
      tokens: CAP,
      nextTokenAt: 0,
    })
  })
})
