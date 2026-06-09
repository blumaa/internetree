import { describe, it, expect } from 'vitest'
import { createLocalBackend, memoryStore } from './localBackend'
import {
  HEALTH_MAX,
  TEND_BUCKET_CAP,
  TEND_REFILL_MS,
  BASE_DROUGHT_MS,
  BASE_GRACE_MS,
  MOURNING_MS,
} from '../engine/config'

const T0 = 1_700_000_000_000
const MIN = 60 * 1000

describe('localBackend — load', () => {
  it('starts a fresh, healthy gen-1 sprout with a full watering can', async () => {
    const be = createLocalBackend(memoryStore())
    const { remote, device } = await be.load('device-a', T0)
    expect(remote.tree.generation).toBe(1)
    expect(remote.tree.health).toBe(HEALTH_MAX)
    expect(remote.history).toHaveLength(0)
    expect(device.tokens).toBe(TEND_BUCKET_CAP)
  })

  it('lazily decays the tree as time passes (pull = derive on read)', async () => {
    const store = memoryStore()
    const be = createLocalBackend(store)
    await be.load('device-a', T0)
    const later = await be.load('device-a', T0 + 60 * MIN)
    expect(later.remote.tree.health).toBeLessThan(HEALTH_MAX)
  })

  it('archives perished generations to the graveyard across a long absence', async () => {
    const be = createLocalBackend(memoryStore())
    await be.load('device-a', T0)
    const after = await be.load('device-a', T0 + BASE_DROUGHT_MS + BASE_GRACE_MS + MOURNING_MS + 60 * MIN)
    expect(after.remote.tree.generation).toBe(2)
    expect(after.remote.history).toHaveLength(1)
    expect(after.remote.history[0].generation).toBe(1)
  })
})

describe('localBackend — watering can', () => {
  it('accepts up to a full can of tends, then runs dry', async () => {
    const be = createLocalBackend(memoryStore())
    for (let i = 0; i < TEND_BUCKET_CAP; i++) {
      const res = await be.tend('device-a', T0)
      expect(res.accepted).toBe(true)
      expect(res.device.tokens).toBe(TEND_BUCKET_CAP - 1 - i)
    }
    const dry = await be.tend('device-a', T0)
    expect(dry.accepted).toBe(false)
    expect(dry.device.tokens).toBe(0)
  })

  it('a tend raises health', async () => {
    const store = memoryStore()
    const be = createLocalBackend(store)
    await be.load('device-a', T0) // plant at T0 so it has decayed by the time we tend
    const before = (await be.load('device-a', T0 + 30 * MIN)).remote.tree.health
    const res = await be.tend('device-a', T0 + 30 * MIN)
    expect(res.remote.tree.health).toBeGreaterThan(before)
  })

  it('refills one drop per TEND_REFILL_MS', async () => {
    const be = createLocalBackend(memoryStore())
    for (let i = 0; i < TEND_BUCKET_CAP; i++) await be.tend('device-a', T0)
    // empty now; wait for exactly one refill
    const res = await be.tend('device-a', T0 + TEND_REFILL_MS)
    expect(res.accepted).toBe(true)
  })

  it('gives each device its own can', async () => {
    const be = createLocalBackend(memoryStore())
    for (let i = 0; i < TEND_BUCKET_CAP; i++) await be.tend('device-a', T0)
    const other = await be.tend('device-b', T0)
    expect(other.accepted).toBe(true)
  })

  it('persists the can across backend instances on the same store', async () => {
    const store = memoryStore()
    const a = createLocalBackend(store)
    for (let i = 0; i < TEND_BUCKET_CAP; i++) await a.tend('device-a', T0)
    const reopened = await createLocalBackend(store).tend('device-a', T0)
    expect(reopened.accepted).toBe(false)
  })
})

describe('localBackend — the crowd (keepers + motes)', () => {
  it('counts DISTINCT recent tenders as keepers', async () => {
    const be = createLocalBackend(memoryStore())
    await be.tend('device-a', T0)
    await be.tend('device-b', T0)
    await be.tend('device-b', T0) // same device twice → still one keeper
    const { remote } = await be.load('device-a', T0)
    expect(remote.keepers).toBe(2)
  })

  it('surfaces very recent tends as motes', async () => {
    const be = createLocalBackend(memoryStore())
    await be.tend('device-a', T0)
    await be.tend('device-b', T0)
    const { remote } = await be.load('device-a', T0)
    expect(remote.recentTends.length).toBe(2)
  })

  it('forgets keepers and motes once their windows pass', async () => {
    const be = createLocalBackend(memoryStore())
    await be.tend('device-a', T0)
    // a day + a bit later: outside both the keeper window and the mote window
    const { remote } = await be.load('device-a', T0 + 25 * 60 * 60 * 1000)
    expect(remote.keepers).toBe(0)
    expect(remote.recentTends).toHaveLength(0)
  })
})
