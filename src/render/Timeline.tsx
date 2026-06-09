import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { TreeState } from '../engine/types'
import { OakTree } from './OakTree'
import { Gravestone } from './Gravestone'

/**
 * The lineage as a horizontal timeline: fallen generations (gravestones) on the
 * left, the current tree focused on the right. When a tree dies and the next is
 * born, the row pans right so the focus lands on the new tree.
 */
export function Timeline({
  tree,
  history,
  canTend,
  onTend,
}: {
  tree: TreeState
  history: TreeState[]
  canTend: boolean
  onTend: () => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const currentIsGrave = tree.status === 'dead'

  // Pan the row so the current slot sits in the centre of the viewport —
  // on lineage changes AND on viewport resize (orientation / responsive),
  // otherwise the row stays pinned to a stale centre and the tree drifts off-screen.
  useEffect(() => {
    const recenter = (animate: boolean) => {
      const viewport = viewportRef.current
      const row = rowRef.current
      if (!viewport || !row) return
      const current = row.querySelector<HTMLElement>('[data-current]')
      if (!current) return
      const target = viewport.clientWidth / 2 - (current.offsetLeft + current.offsetWidth / 2)
      gsap.to(row, { x: target, duration: animate ? 1.2 : 0, ease: 'power3.inOut' })
    }
    recenter(true)
    const onResize = () => recenter(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [history.length, currentIsGrave])

  return (
    <div className="timeline" ref={viewportRef}>
      <div className="timeline-row" ref={rowRef}>
        {history.map((past) => (
          <div className="slot slot--grave" key={past.generation}>
            <Gravestone tree={past} />
          </div>
        ))}
        {/* key by generation+status so a death→rebirth cleanly remounts (fresh fade, reset tweens) */}
        <div className="slot slot--current" data-current key={`${tree.generation}-${currentIsGrave}`}>
          {currentIsGrave ? (
            <Gravestone tree={tree} focal />
          ) : (
            <OakTree tree={tree} canTend={canTend} onTend={onTend} />
          )}
        </div>
      </div>
    </div>
  )
}
