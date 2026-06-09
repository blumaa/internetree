import { describe, it, expect } from 'vitest'
import { visualFor } from './visual'
import { createTree, stageIndexFor } from '../engine/tree'
import type { TreeState } from '../engine/types'

const T0 = 1_700_000_000_000
const base = createTree(T0)

const withHealth = (health: number, extra: Partial<TreeState> = {}): TreeState => ({
  ...base,
  health,
  ...extra,
})

const critical = withHealth(0, { status: 'critical', criticalSince: T0 })
const dead = withHealth(0, { status: 'dead', diedAt: T0 })

describe('visualFor — growth', () => {
  it('reports the engine stage index', () => {
    expect(visualFor({ ...base, growth: 0 }).stageIndex).toBe(stageIndexFor(0))
    expect(visualFor({ ...base, growth: 300 }).stageIndex).toBe(stageIndexFor(300))
  })

  it('scale grows monotonically with growth', () => {
    const a = visualFor({ ...base, growth: 0 }).scale
    const b = visualFor({ ...base, growth: 50 }).scale
    const c = visualFor({ ...base, growth: 300 }).scale
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
  })
})

describe('visualFor — storybook colour (gradient stops)', () => {
  it('gives a canopy radial gradient: core + rim', () => {
    const v = visualFor(withHealth(100))
    expect(v.canopyCore).toMatch(/^#[0-9a-f]{6}$/i)
    expect(v.canopyRim).toMatch(/^#[0-9a-f]{6}$/i)
    expect(v.canopyCore).not.toBe(v.canopyRim)
  })

  it('gives a bark gradient: light + dark', () => {
    const v = visualFor(withHealth(100))
    expect(v.trunkLight).toMatch(/^#[0-9a-f]{6}$/i)
    expect(v.trunkDark).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('a thriving tree is coloured differently from a dying one', () => {
    expect(visualFor(withHealth(100)).canopyCore).not.toBe(visualFor(critical).canopyCore)
  })
})

describe('visualFor — warm glow', () => {
  it('glows brighter when healthier', () => {
    expect(visualFor(withHealth(100)).glow).toBeGreaterThan(visualFor(withHealth(20)).glow)
  })

  it('does not glow when critical', () => {
    expect(visualFor(critical).glow).toBe(0)
  })
})

describe('visualFor — health mood-layer', () => {
  it('droops more as health falls', () => {
    const thriving = visualFor(withHealth(100)).lean
    const wilting = visualFor(withHealth(20)).lean
    const crit = visualFor(critical).lean
    expect(wilting).toBeGreaterThan(thriving)
    expect(crit).toBeGreaterThan(wilting)
  })

  it('sheds leaves as health falls', () => {
    const thriving = visualFor(withHealth(100)).leafiness
    const wilting = visualFor(withHealth(20)).leafiness
    expect(thriving).toBeGreaterThan(wilting)
    expect(thriving).toBeLessThanOrEqual(1)
    expect(wilting).toBeGreaterThanOrEqual(0)
  })
})

describe('visualFor — tremble & mode', () => {
  it('only trembles in the critical state', () => {
    expect(visualFor(withHealth(100)).tremble).toBe(false)
    expect(visualFor(withHealth(5)).tremble).toBe(false)
    expect(visualFor(critical).tremble).toBe(true)
  })

  it('maps status to render mode', () => {
    expect(visualFor(withHealth(100)).mode).toBe('living')
    expect(visualFor(critical).mode).toBe('critical')
    expect(visualFor(dead).mode).toBe('mourning')
  })
})
