import { describe, it, expect, vi, afterEach } from 'vitest'
import { share, inviteMessage, prideMessage, memorialMessage } from './share'
import { createTree } from './engine/tree'

const T = 1_700_000_000_000

afterEach(() => vi.unstubAllGlobals())

describe('share messages', () => {
  it('invites with the crowd when there is one', () => {
    expect(inviteMessage(3, 12)).toContain('generation 3')
    expect(inviteMessage(3, 12)).toContain('12 people')
  })

  it('invites plainly when no one has tended yet', () => {
    expect(inviteMessage(1, 0)).toBe("help keep the internet's tree alive")
  })

  it('shares a rescue as a rescue', () => {
    expect(prideMessage(true, 4, 'young')).toContain('almost died')
  })

  it('shares growth with the stage reached', () => {
    const msg = prideMessage(false, 4, 'young')
    expect(msg).toContain('generation 4')
    expect(msg).toContain('young')
  })

  it('tells a memorial as pride, not a plea', () => {
    const tree = { ...createTree(T), generation: 2, tendCount: 1042 }
    const msg = memorialMessage(tree, '3d 7h')
    expect(msg).toContain('Generation 2')
    expect(msg).toContain('3d 7h')
    expect(msg).toContain('1,042')
  })
})

describe('share mechanism', () => {
  it('reports "shared" via the native share sheet', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockResolvedValue(undefined) })
    expect(await share('hi')).toBe('shared')
  })

  it('reports "copied" via the clipboard fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(await share('hi')).toBe('copied')
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('hi'))
  })

  it('reports "dismissed" when the user closes the sheet or nothing works', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new Error('abort')) })
    expect(await share('hi')).toBe('dismissed')
    vi.stubGlobal('navigator', {})
    expect(await share('hi')).toBe('dismissed')
  })
})
