import { describe, it, expect } from 'vitest'
import {
  createTree,
  decayRatePerMs,
  graceMs,
  project,
  catchUp,
  tend,
  stageFor,
  stageIndexFor,
  moodFor,
} from './tree'
import {
  HEALTH_MAX,
  TEND_BUMP,
  GROWTH_PER_TEND,
  GROWTH_HEALTH_GATE,
  BASE_DROUGHT_MS,
  BASE_GRACE_MS,
  MOURNING_MS,
} from './config'
import type { TreeState } from './types'

// Fixed epoch — the engine is pure and deterministic; `now` is always passed in.
const T0 = 1_700_000_000_000
const MIN = 60 * 1000
const HOUR = 60 * MIN

describe('createTree', () => {
  it('is a fresh, fully healthy sprout', () => {
    const t = createTree(T0)
    expect(t.health).toBe(HEALTH_MAX)
    expect(t.growth).toBe(0)
    expect(t.status).toBe('alive')
    expect(t.generation).toBe(1)
    expect(t.tendCount).toBe(0)
    expect(t.criticalSince).toBeNull()
    expect(t.diedAt).toBeNull()
    expect(t.bornAt).toBe(T0)
    expect(t.updatedAt).toBe(T0)
    expect(stageFor(t.growth)).toBe('sprout')
  })

  it('accepts an explicit generation', () => {
    expect(createTree(T0, 4).generation).toBe(4)
  })
})

describe('decayRatePerMs — coupled resilience', () => {
  it('a growth-0 sprout empties over exactly BASE_DROUGHT_MS', () => {
    expect(decayRatePerMs(0)).toBeCloseTo(HEALTH_MAX / BASE_DROUGHT_MS, 12)
  })

  it('higher growth decays slower', () => {
    expect(decayRatePerMs(50)).toBeLessThan(decayRatePerMs(0))
    expect(decayRatePerMs(300)).toBeLessThan(decayRatePerMs(50))
  })
})

describe('graceMs — coupled resilience', () => {
  it('a sprout gets the base grace window', () => {
    expect(graceMs(0)).toBe(BASE_GRACE_MS)
  })

  it('bigger trees linger longer when dying', () => {
    expect(graceMs(120)).toBeGreaterThan(graceMs(0))
  })
})

describe('project — health decay', () => {
  it('is a no-op when no time has passed', () => {
    const t = createTree(T0)
    expect(project(t, T0)).toEqual(t)
  })

  it('never rewinds time (now in the past returns state unchanged)', () => {
    const t = createTree(T0)
    expect(project(t, T0 - HOUR)).toEqual(t)
  })

  it('lowers health as time passes but stays alive within the drought', () => {
    const t = createTree(T0)
    const after = project(t, T0 + HOUR)
    expect(after.health).toBeLessThan(HEALTH_MAX)
    expect(after.health).toBeGreaterThan(0)
    expect(after.status).toBe('alive')
    expect(after.updatedAt).toBe(T0 + HOUR)
  })

  it('decays slower for a higher-growth tree over the same span (coupled)', () => {
    const young: TreeState = { ...createTree(T0), growth: 0 }
    const old: TreeState = { ...createTree(T0), growth: 100 }
    const youngAfter = project(young, T0 + HOUR)
    const oldAfter = project(old, T0 + HOUR)
    expect(oldAfter.health).toBeGreaterThan(youngAfter.health)
  })

  it('does not change growth (growth is care-driven, never time-driven)', () => {
    const t: TreeState = { ...createTree(T0), growth: 42 }
    expect(project(t, T0 + HOUR).growth).toBe(42)
  })
})

describe('project — critical & death', () => {
  it('enters critical (not dead) the moment health hits 0', () => {
    const t = createTree(T0)
    const dryAt = T0 + BASE_DROUGHT_MS
    const after = project(t, dryAt + 1)
    expect(after.health).toBe(0)
    expect(after.status).toBe('critical')
    expect(after.criticalSince).toBe(dryAt)
    expect(after.diedAt).toBeNull()
  })

  it('stays critical within the grace window', () => {
    const t = createTree(T0)
    const after = project(t, T0 + BASE_DROUGHT_MS + BASE_GRACE_MS - MIN)
    expect(after.status).toBe('critical')
    expect(after.diedAt).toBeNull()
  })

  it('dies once the grace window elapses, recording diedAt', () => {
    const t = createTree(T0)
    const after = project(t, T0 + BASE_DROUGHT_MS + BASE_GRACE_MS + MIN)
    expect(after.status).toBe('dead')
    expect(after.health).toBe(0)
    expect(after.diedAt).toBe(T0 + BASE_DROUGHT_MS + BASE_GRACE_MS)
  })

  it('a bigger tree survives a lull that would kill a sprout (coupled grace + decay)', () => {
    const old: TreeState = { ...createTree(T0), growth: 300 }
    const lull = T0 + BASE_DROUGHT_MS + BASE_GRACE_MS + MIN
    expect(project(old, lull).status).not.toBe('dead')
  })
})

describe('tend — care', () => {
  it('raises health by TEND_BUMP, capped at HEALTH_MAX', () => {
    const hurt: TreeState = { ...createTree(T0), health: 50 }
    expect(tend(hurt, T0).health).toBe(50 + TEND_BUMP)

    const nearlyFull: TreeState = { ...createTree(T0), health: HEALTH_MAX - 1 }
    expect(tend(nearlyFull, T0).health).toBe(HEALTH_MAX)
  })

  it('counts each tend', () => {
    const t = createTree(T0)
    expect(tend(t, T0).tendCount).toBe(1)
  })

  it('revives a critical tree back to alive', () => {
    const dying = project(createTree(T0), T0 + BASE_DROUGHT_MS + MIN)
    expect(dying.status).toBe('critical')
    const revived = tend(dying, dying.updatedAt)
    expect(revived.status).toBe('alive')
    expect(revived.health).toBe(TEND_BUMP)
    expect(revived.criticalSince).toBeNull()
  })

  it('grows the tree when tended while healthy', () => {
    const healthy: TreeState = { ...createTree(T0), health: GROWTH_HEALTH_GATE }
    expect(tend(healthy, T0).growth).toBe(GROWTH_PER_TEND)
  })

  it('does NOT grow the tree when tended while unhealthy', () => {
    const sick: TreeState = { ...createTree(T0), health: GROWTH_HEALTH_GATE - 1, growth: 5 }
    expect(tend(sick, T0).growth).toBe(5)
  })

  it('does nothing to a tree still in mourning', () => {
    const dead = project(createTree(T0), T0 + BASE_DROUGHT_MS + BASE_GRACE_MS + MIN)
    expect(dead.status).toBe('dead')
    const tended = tend(dead, dead.diedAt! + MIN)
    expect(tended.status).toBe('dead')
    expect(tended.health).toBe(0)
  })
})

describe('growth → stage', () => {
  it('maps growth to the right milestone stage', () => {
    expect(stageFor(0)).toBe('sprout')
    expect(stageFor(14)).toBe('sprout')
    expect(stageFor(15)).toBe('sapling')
    expect(stageFor(50)).toBe('young')
    expect(stageFor(120)).toBe('mature')
    expect(stageFor(300)).toBe('ancient')
    expect(stageFor(99999)).toBe('ancient')
  })

  it('stage index increases monotonically with growth', () => {
    expect(stageIndexFor(0)).toBe(0)
    expect(stageIndexFor(15)).toBe(1)
    expect(stageIndexFor(300)).toBe(4)
  })
})

describe('health → mood', () => {
  it('bands health into a mood', () => {
    expect(moodFor(HEALTH_MAX)).toBe('thriving')
    expect(moodFor(75)).toBe('thriving')
    expect(moodFor(74)).toBe('content')
    expect(moodFor(40)).toBe('content')
    expect(moodFor(39)).toBe('wilting')
    expect(moodFor(1)).toBe('wilting')
    expect(moodFor(0)).toBe('critical')
  })
})

describe('rebirth — lineage continues', () => {
  it('auto-plants a fresh next-generation sprout once mourning elapses', () => {
    const dead = project(createTree(T0), T0 + BASE_DROUGHT_MS + BASE_GRACE_MS + MIN)
    expect(dead.status).toBe('dead')

    const reborn = project(dead, dead.diedAt! + MOURNING_MS + MIN)
    expect(reborn.generation).toBe(2)
    expect(reborn.status).toBe('alive')
    expect(reborn.health).toBe(HEALTH_MAX)
    expect(reborn.growth).toBe(0)
    expect(reborn.tendCount).toBe(0)
    expect(reborn.diedAt).toBeNull()
    expect(reborn.bornAt).toBe(dead.diedAt! + MOURNING_MS)
  })

  it('stays dead (in memorial) during the mourning window', () => {
    const dead = project(createTree(T0), T0 + BASE_DROUGHT_MS + BASE_GRACE_MS + MIN)
    const stillMourning = project(dead, dead.diedAt! + MOURNING_MS - MIN)
    expect(stillMourning.status).toBe('dead')
    expect(stillMourning.generation).toBe(1)
  })
})

describe('catchUp — fully advance across any gap', () => {
  it('decays a living tree with no deaths', () => {
    const { tree, perished } = catchUp(createTree(T0), T0 + HOUR)
    expect(tree.status).toBe('alive')
    expect(tree.health).toBeLessThan(HEALTH_MAX)
    expect(perished).toHaveLength(0)
  })

  it('advances through a full death → rebirth and records the perished tree', () => {
    const start = createTree(T0)
    const wellPastRebirth = T0 + BASE_DROUGHT_MS + BASE_GRACE_MS + MOURNING_MS + HOUR
    const { tree, perished } = catchUp(start, wellPastRebirth)
    expect(tree.generation).toBe(2)
    expect(tree.status).toBe('alive')
    expect(perished).toHaveLength(1)
    expect(perished[0].generation).toBe(1)
    expect(perished[0].diedAt).not.toBeNull()
  })

  it('handles multiple lost generations across a long absence', () => {
    // far enough for several sprouts to live and die untended
    const lifespan = BASE_DROUGHT_MS + BASE_GRACE_MS + MOURNING_MS
    const { tree, perished } = catchUp(createTree(T0), T0 + lifespan * 3 + HOUR)
    expect(tree.generation).toBeGreaterThanOrEqual(3)
    expect(perished.length).toBeGreaterThanOrEqual(2)
  })

  it('reaches a stable state (catching up again changes nothing)', () => {
    const once = catchUp(createTree(T0), T0 + 5 * HOUR)
    const twice = catchUp(once.tree, T0 + 5 * HOUR)
    expect(twice.tree).toEqual(once.tree)
    expect(twice.perished).toHaveLength(0)
  })
})

describe('project — idempotence', () => {
  it('projecting twice to the same instant is stable', () => {
    const t = createTree(T0)
    const once = project(t, T0 + 2 * HOUR)
    const twice = project(once, T0 + 2 * HOUR)
    expect(twice).toEqual(once)
  })

  it('is stable across a critical transition', () => {
    const t = createTree(T0)
    const at = T0 + BASE_DROUGHT_MS + 5 * MIN
    expect(project(project(t, at), at)).toEqual(project(t, at))
  })
})
