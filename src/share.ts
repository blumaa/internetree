// Single source for sharing — the brand-voice messages AND the mechanism (native
// share sheet where available, clipboard fallback). All share copy lives here so the
// CTA voice changes in one place.
import type { TreeState } from './engine/types'

export function inviteMessage(generation: number, keepers: number): string {
  return keepers > 0
    ? `Internetree — generation ${generation}, kept alive by ${keepers.toLocaleString()} people. help keep it alive.`
    : "help keep the internet's tree alive"
}

// Pride spreads further than asking for help — share the milestone, not the plea.
export function prideMessage(rescued: boolean, generation: number, stage: string): string {
  return rescued
    ? 'the Internetree almost died — strangers brought it back. help keep it alive.'
    : `the Internetree just grew — generation ${generation} is now a ${stage}. help it keep growing.`
}

// The memorial is the shareable artifact — a proud "this is what we kept alive",
// not a plea. Pride spreads further than asking for help.
export function memorialMessage(tree: TreeState, lived: string): string {
  return `Generation ${tree.generation} of the Internetree lived ${lived}, tended by ${tree.tendCount.toLocaleString()} strangers. A new one is growing — help keep it alive.`
}

export type ShareOutcome = 'shared' | 'copied' | 'dismissed'

/** Share `text`, reporting how it went so the UI can confirm a silent clipboard copy. */
export async function share(text: string): Promise<ShareOutcome> {
  const url = window.location.href
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Internetree', text, url })
      return 'shared'
    } catch {
      return 'dismissed' // user closed the sheet — not a failure, nothing to confirm
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`)
    return 'copied'
  } catch {
    return 'dismissed' // clipboard blocked — the button stays usable, nothing to recover
  }
}
