import { describe, it, expect } from 'vitest'
import { oakStageFor, varyOak, OAK_STAGE_COUNT } from './oakSkeleton'

describe('oakSkeleton', () => {
  it('provides a stage for every index, with a trunk and a crown', () => {
    for (let i = 0; i < OAK_STAGE_COUNT; i++) {
      const s = oakStageFor(i)
      expect(s.trunk.startsWith('M')).toBe(true)
      expect(s.crown.length).toBeGreaterThan(0)
      expect(s.crownCenter).toBeDefined()
    }
  })

  it('clamps out-of-range indices', () => {
    expect(oakStageFor(-3)).toEqual(oakStageFor(0))
    expect(oakStageFor(99)).toEqual(oakStageFor(OAK_STAGE_COUNT - 1))
  })

  it('adds limbs (branch structure) as it matures — not just a bigger blob', () => {
    const limbCounts = Array.from({ length: OAK_STAGE_COUNT }, (_, i) => oakStageFor(i).limbs.length)
    for (let i = 1; i < limbCounts.length; i++) {
      expect(limbCounts[i]).toBeGreaterThanOrEqual(limbCounts[i - 1])
    }
    // seedling has no woody limbs; the ancient has many
    expect(limbCounts[0]).toBe(0)
    expect(limbCounts[OAK_STAGE_COUNT - 1]).toBeGreaterThan(4)
  })

  it('grows deeper branch orders with age', () => {
    const maxOrder = (i: number) =>
      oakStageFor(i).limbs.reduce((m, l) => Math.max(m, l.order), 0)
    expect(maxOrder(OAK_STAGE_COUNT - 1)).toBeGreaterThan(maxOrder(1))
  })

  it('thickens the trunk with age', () => {
    expect(oakStageFor(OAK_STAGE_COUNT - 1).trunkWidth).toBeGreaterThan(oakStageFor(0).trunkWidth)
  })

  it('only the seedling has an acorn shell and seed leaves', () => {
    expect(oakStageFor(0).acorn).toBe(true)
    expect(oakStageFor(0).seedLeaves.length).toBeGreaterThan(0)
    expect(oakStageFor(OAK_STAGE_COUNT - 1).acorn).toBe(false)
    expect(oakStageFor(OAK_STAGE_COUNT - 1).seedLeaves).toHaveLength(0)
  })

  it('only old trees show surface roots', () => {
    expect(oakStageFor(0).roots).toHaveLength(0)
    expect(oakStageFor(OAK_STAGE_COUNT - 1).roots.length).toBeGreaterThan(0)
  })

  it('only mature+ trees bear acorns and show bark furrows', () => {
    expect(oakStageFor(0).acornSpots).toHaveLength(0)
    expect(oakStageFor(0).barkLines).toHaveLength(0)
    expect(oakStageFor(OAK_STAGE_COUNT - 1).acornSpots.length).toBeGreaterThan(0)
    expect(oakStageFor(OAK_STAGE_COUNT - 1).barkLines.length).toBeGreaterThan(0)
  })
})

describe('varyOak — a unique tree per generation', () => {
  it('is deterministic for a given generation + stage (stable across renders/clients)', () => {
    expect(varyOak(7, 3)).toEqual(varyOak(7, 3))
  })

  it('varies EVERYTHING across generations — trunk, crown, limbs', () => {
    expect(varyOak(7, 3).trunk).not.toBe(varyOak(8, 3).trunk) // trunk silhouette differs now
    expect(varyOak(7, 3).crown).not.toEqual(varyOak(8, 3).crown)
    expect(varyOak(7, 3).trunkWidth).not.toBe(varyOak(8, 3).trunkWidth)
  })

  it('stays a valid oak — trunk path, crown, limbs jittered about pivots, roots on the ancient', () => {
    const v = varyOak(12, 4) // ancient
    expect(v.trunk.startsWith('M')).toBe(true)
    expect(v.crown.length).toBeGreaterThan(0)
    expect(v.limbs.every((l) => l.pivot && typeof l.rot === 'number')).toBe(true)
    expect(v.roots.length).toBeGreaterThan(0)
    expect(v.trunkWidth).toBeGreaterThan(0)
  })
})
