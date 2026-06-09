import type { RefObject } from 'react'
import type { OakStage } from './oakSkeleton'
import type { TreeVisual } from './visual'
import { leafyBlobPath } from './leafClump'

// Branch order → stroke width. Trunk is filled separately.
const LIMB_WIDTH: Record<number, number> = { 1: 8, 2: 4.5, 3: 2.2 }

// A single lobed oak leaf, centred at the origin, tip up — placed around the crown
// edge so the foliage reads as oak leaves, not just blobs.
const OAK_LEAF =
  'M0 7 Q-2 5 -3 2 Q-5 1 -3 -1 Q-5 -3 -2 -5 Q-3 -8 0 -11 Q3 -8 2 -5 Q5 -3 3 -1 Q5 1 3 2 Q2 5 0 7 Z'

/**
 * The static oak silhouette for one stage (roots, limbs, trunk, bark, crown, acorns).
 * Rendered for the live tree (with crown/glow refs for animation) and, during a
 * stage promotion, a second time as a fading "ghost" of the outgoing stage so the
 * size change crossfades instead of popping.
 */
export function OakShapes({
  oak,
  visual,
  crownRef,
  glowRef,
}: {
  oak: OakStage
  visual: TreeVisual
  crownRef?: RefObject<SVGGElement | null>
  glowRef?: RefObject<SVGCircleElement | null>
}) {
  const { cx, cy } = oak.crownCenter

  // A fringe of individual leaves on the outer clusters, each pointing outward.
  const edgeLeaves = oak.crown
    .filter((c) => c.r >= 20 && Math.hypot(c.cx - cx, c.cy - cy) > 14)
    .map((c) => {
      const ang = Math.atan2(c.cy - cy, c.cx - cx)
      return {
        lx: c.cx + Math.cos(ang) * c.r * 0.7,
        ly: c.cy + Math.sin(ang) * c.r * 0.7,
        deg: (ang * 180) / Math.PI + 90,
        s: Math.min(1.5, c.r / 24),
      }
    })

  return (
    <>
      {/* surface roots, behind the trunk */}
      <g stroke="url(#oakBark)" strokeWidth="7" strokeLinecap="round" fill="none">
        {oak.roots.map((d, i) => (
          <path key={`r${i}`} d={d} />
        ))}
      </g>

      {/* woody branches, thickest order first */}
      <g stroke="url(#oakBark)" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {[...oak.limbs]
          .sort((a, b) => a.order - b.order)
          .map((l, i) => (
            <path
              key={`l${i}`}
              d={l.path}
              strokeWidth={LIMB_WIDTH[l.order] ?? 2}
              transform={l.rot && l.pivot ? `rotate(${l.rot} ${l.pivot[0]} ${l.pivot[1]})` : undefined}
            />
          ))}
      </g>

      {/* trunk */}
      <path d={oak.trunk} fill="url(#oakBark)" />
      <g stroke={visual.trunkDark} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.35">
        {oak.barkLines.map((d, i) => (
          <path key={`b${i}`} d={d} />
        ))}
      </g>

      {/* the cracked acorn it sprouted FROM — tucked at the soil line, centred under the
          shoot so the stem rises out of it (the lineage seed, not a nut lying nearby) */}
      {oak.acorn && (
        <g>
          <ellipse cx="130" cy="243" rx="3.6" ry="4.6" fill="#9c6b34" />
          <path d="M125.5 241 Q130 237.5 134.5 241 Q130 243 125.5 241 Z" fill="#5e3d1c" />
        </g>
      )}

      {/* crown — leaf masses clustered at branch tips */}
      <g ref={crownRef} filter="url(#oakShadow)">
        <circle ref={glowRef} cx={cx} cy={cy} r="78" fill="url(#oakGlow)" opacity={visual.glow} />
        {oak.seedLeaves.map((leaf, i) => (
          <ellipse
            key={`s${i}`}
            cx={leaf.cx}
            cy={leaf.cy}
            rx="8"
            ry="4.5"
            fill="url(#oakCanopy)"
            transform={`rotate(${leaf.rot} ${leaf.cx} ${leaf.cy})`}
          />
        ))}
        {oak.crown.map((c, i) => (
          <path
            key={`cs${i}`}
            d={leafyBlobPath(c.cx, c.cy + c.r * 0.14, c.r * 0.97)}
            fill={visual.canopyCore}
            opacity="0.4"
          />
        ))}
        {oak.crown.map((c, i) => (
          <path key={`c${i}`} className="leaf-mass" d={leafyBlobPath(c.cx, c.cy, c.r)} fill="url(#oakCanopy)" />
        ))}
        {/* tonal variation — deeper pockets on some clusters give the canopy depth */}
        {oak.crown
          .filter((_, i) => i % 3 === 1)
          .map((c, i) => (
            <circle
              key={`dp${i}`}
              cx={c.cx + c.r * 0.22}
              cy={c.cy + c.r * 0.28}
              r={c.r * 0.55}
              fill={visual.canopyCore}
              opacity="0.22"
            />
          ))}
        {/* individual lobed leaves around the edge */}
        {edgeLeaves.map((l, i) => (
          <path
            key={`el${i}`}
            className="edge-leaf"
            d={OAK_LEAF}
            fill={visual.canopyRim}
            opacity="0.92"
            transform={`translate(${l.lx} ${l.ly}) rotate(${l.deg}) scale(${l.s})`}
          />
        ))}
        {/* dappled sunlight — brighter patches across the canopy */}
        {oak.crown
          .filter((c) => c.r >= 16)
          .map((c, i) => (
            <ellipse
              key={`d${i}`}
              cx={c.cx - c.r * 0.28}
              cy={c.cy - c.r * 0.34}
              rx={c.r * 0.32}
              ry={c.r * 0.24}
              fill={visual.canopyRim}
              opacity="0.28"
            />
          ))}
      </g>

      {/* acorns — only when the oak is healthy and grown */}
      {visual.glow > 0.55 &&
        oak.acornSpots.map((a, i) => (
          <g key={`a${i}`}>
            <ellipse cx={a.cx} cy={a.cy + 3} rx="2.6" ry="3.4" fill="#a9743f" />
            <path
              d={`M${a.cx - 3} ${a.cy} Q${a.cx} ${a.cy - 2.4} ${a.cx + 3} ${a.cy} Q${a.cx} ${a.cy + 1.8} ${a.cx - 3} ${a.cy} Z`}
              fill="#6b4423"
            />
          </g>
        ))}
    </>
  )
}
