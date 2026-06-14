import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { TreeState } from '../engine/types'
import { memorialMessage } from '../share'
import { ShareButton } from './ShareButton'
import { formatDuration } from './format'

function formatDied(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * A fallen tree's memorial on the timeline. `focal` is the one that just died
 * (larger, centred, fades in); the rest are small markers of past generations.
 */
export function Gravestone({ tree, focal = false }: { tree: TreeState; focal?: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const lived = tree.diedAt !== null ? formatDuration(tree.diedAt - tree.bornAt) : '—'
  const died = tree.diedAt !== null ? formatDied(tree.diedAt) : '—'

  // Fade/scale in so the tree → gravestone swap dissolves instead of popping.
  // fromTo (not gsap.from) is StrictMode-safe — a double-invoked effect must not
  // read the just-set 0 as the target and leave it invisible.
  useEffect(() => {
    gsap.fromTo(
      ref.current,
      { opacity: 0, scale: 0.85 },
      { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' },
    )
  }, [])

  return (
    <figure ref={ref} className={focal ? 'grave grave--focal' : 'grave'}>
      <svg viewBox="0 0 120 130" role="img" aria-label={`generation ${tree.generation} memorial`}>
        <ellipse className="ground" cx="60" cy="118" rx="46" ry="8" />
        <path d="M16 119 Q60 96 104 119 Z" fill="#6f9c78" opacity="0.6" />
        <path
          d="M40 119 L40 64 Q40 40 60 40 Q80 40 80 64 L80 119 Z"
          fill="#9aa6a0"
          stroke="#7c8a83"
          strokeWidth="1.5"
        />
        <path d="M44 60 Q60 50 76 60" fill="none" stroke="#7c8a83" strokeWidth="1.2" opacity="0.6" />
      </svg>
      <figcaption>
        <span className="grave-gen">Gen {tree.generation}</span>
        <span className="grave-line">lived {lived}</span>
        <span className="grave-line">{tree.tendCount.toLocaleString()} tended</span>
        <span className="grave-died">died {died}</span>
        {focal && (
          <ShareButton
            className="grave-share"
            label="↗ share its story"
            message={() => memorialMessage(tree, lived)}
          />
        )}
      </figcaption>
    </figure>
  )
}
