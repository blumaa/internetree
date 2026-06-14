import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OakTree } from './OakTree'
import { createTree } from '../engine/tree'

// jsdom can't run real SVG tweens (no getBBox) — stub the animation layer.
vi.mock('gsap', () => {
  const tween = () => ({ kill: vi.fn() })
  return {
    default: {
      to: vi.fn(tween),
      fromTo: vi.fn(tween),
      set: vi.fn(),
      delayedCall: vi.fn(tween),
      timeline: vi.fn(() => ({ to: vi.fn().mockReturnThis(), kill: vi.fn() })),
      quickSetter: vi.fn(() => vi.fn()),
      ticker: { time: 0, add: vi.fn(), remove: vi.fn() },
      utils: {
        toArray: (q: unknown) => (q ? Array.from(q as ArrayLike<Element>) : []),
        clamp: (min: number, max: number, v: number) => Math.min(max, Math.max(min, v)),
        random: (min: number) => min,
      },
    },
  }
})

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: true, // reduced motion → no infinite loops in jsdom
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

const T = 1_700_000_000_000

describe('OakTree accessibility', () => {
  it('is an enabled button when the watering can has drops', () => {
    render(<OakTree tree={createTree(T)} canTend={true} onTend={() => {}} />)
    const tree = screen.getByRole('button')
    expect(tree).toHaveAttribute('aria-label', 'tend the tree')
    expect(tree).toHaveAttribute('aria-disabled', 'false')
  })

  it('signals aria-disabled when the watering can is empty', () => {
    render(<OakTree tree={createTree(T)} canTend={false} onTend={() => {}} />)
    const tree = screen.getByRole('button')
    expect(tree).toHaveAttribute('aria-disabled', 'true')
    expect(tree.getAttribute('aria-label')).toMatch(/empty/)
  })

  it('tends on Space without also scrolling the page', () => {
    const onTend = vi.fn()
    render(<OakTree tree={createTree(T)} canTend={true} onTend={onTend} />)
    // fireEvent returns false when preventDefault was called — Space must not scroll
    const notPrevented = fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })
    expect(notPrevented).toBe(false)
    expect(onTend).toHaveBeenCalledTimes(1)
  })
})
