import { describe, it, expect } from 'vitest'
import { formatDuration, formatAge, formatRefill } from './format'

const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

describe('formatDuration', () => {
  it('shows days and hours past a day', () => {
    expect(formatDuration(3 * DAY + 7 * HOUR)).toBe('3d 7h')
  })

  it('shows hours and minutes under a day', () => {
    expect(formatDuration(7 * HOUR + 12 * MIN)).toBe('7h 12m')
  })

  it('shows minutes under an hour', () => {
    expect(formatDuration(14 * MIN)).toBe('14m')
  })
})

describe('formatAge', () => {
  it('counts whole days', () => {
    expect(formatAge(3 * DAY + 5 * HOUR)).toBe('3 days old')
  })

  it('uses the singular for one day', () => {
    expect(formatAge(DAY + HOUR)).toBe('1 day old')
  })

  it('counts hours under a day', () => {
    expect(formatAge(7 * HOUR)).toBe('7 hours old')
  })

  it('uses the singular for one hour', () => {
    expect(formatAge(HOUR + 5 * MIN)).toBe('1 hour old')
  })

  it('calls anything younger than an hour just sprouted', () => {
    expect(formatAge(20 * MIN)).toBe('just sprouted')
  })
})

describe('formatRefill', () => {
  it('rounds up to whole minutes', () => {
    expect(formatRefill(2 * MIN + 10_000)).toBe('refills in 3m')
  })

  it('shows exact whole minutes', () => {
    expect(formatRefill(3 * MIN)).toBe('refills in 3m')
  })

  it('says under a minute for the last stretch', () => {
    expect(formatRefill(40_000)).toBe('refills in under a minute')
  })
})
