import { describe, it, expect } from 'vitest'
import { crowdStats } from './crowd'
import { KEEPER_WINDOW_MS, MOTE_WINDOW_MS } from './config'

const T = 1_700_000_000_000

describe('crowdStats', () => {
  it('counts distinct devices within the keeper window', () => {
    const tends = [
      { device: 'a', at: T - 1000 },
      { device: 'a', at: T - 2000 },
      { device: 'b', at: T - KEEPER_WINDOW_MS + 1 },
    ]
    expect(crowdStats(tends, T).keepers).toBe(2)
  })

  it('forgets keepers once the window passes', () => {
    const tends = [{ device: 'a', at: T - KEEPER_WINDOW_MS - 1 }]
    expect(crowdStats(tends, T).keepers).toBe(0)
  })

  it('surfaces only mote-window tends as recent', () => {
    const tends = [
      { device: 'a', at: T - 1000 },
      { device: 'b', at: T - MOTE_WINDOW_MS - 1 },
    ]
    expect(crowdStats(tends, T).recentTends).toEqual([T - 1000])
  })

  it('is empty for no tends', () => {
    expect(crowdStats([], T)).toEqual({ keepers: 0, recentTends: [] })
  })
})
