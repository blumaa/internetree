// Anatomically-informed oak. Per maturity stage we hold a TEMPLATE (trunk parameters +
// branch/crown data); `buildOak` turns a template into a concrete renderable skeleton,
// optionally VARIED per generation so every tree is unique. Coords live in a 260×260
// viewBox, ground at y≈240, trunk base centred at x=130.
import { mulberry32 } from './prng'
import { buildTrunk, buildRoots, buildBark, type TrunkParams } from './oakTrunk'

export interface Limb {
  /** stroked centreline path */
  path: string
  /** 1 = primary limb, 2 = secondary, 3 = twig */
  order: number
  /** per-tree seeded angle jitter (degrees), rotated about the limb's origin */
  rot?: number
  /** the limb's attach point [x, y] — pivot for `rot` */
  pivot?: [number, number]
}

export interface LeafCluster {
  cx: number
  cy: number
  r: number
}

export interface SeedLeaf {
  cx: number
  cy: number
  /** rotation in degrees */
  rot: number
}

/** Concrete, renderable skeleton (what OakShapes draws). */
export interface OakStage {
  trunk: string
  trunkWidth: number
  limbs: Limb[]
  crown: LeafCluster[]
  roots: string[]
  acornSpots: Array<{ cx: number; cy: number }>
  barkLines: string[]
  acorn: boolean
  seedLeaves: SeedLeaf[]
  crownCenter: { cx: number; cy: number }
}

/** Per-stage blueprint — parameters `buildOak` turns into an OakStage. */
interface OakTemplate {
  trunk: TrunkParams
  rootCount: number
  barkCount: number
  limbs: Limb[]
  crown: LeafCluster[]
  acornSpots: Array<{ cx: number; cy: number }>
  acorn: boolean
  seedLeaves: SeedLeaf[]
  crownCenter: { cx: number; cy: number }
}

const SEEDLING: OakTemplate = {
  trunk: { topY: 211, baseHalf: 1.6, topHalf: 1, flare: 0 },
  rootCount: 0,
  barkCount: 0,
  limbs: [],
  crown: [
    { cx: 130, cy: 206, r: 7 },
    { cx: 123, cy: 210, r: 5 },
    { cx: 137, cy: 210, r: 5 },
  ],
  acornSpots: [],
  acorn: true,
  seedLeaves: [
    { cx: 121, cy: 210, rot: -48 },
    { cx: 139, cy: 210, rot: 48 },
  ],
  crownCenter: { cx: 130, cy: 206 },
}

const SAPLING: OakTemplate = {
  trunk: { topY: 176, baseHalf: 4, topHalf: 1.6, flare: 0.5 },
  rootCount: 0,
  barkCount: 0,
  limbs: [
    { path: 'M129 190 Q118 184 110 173', order: 1 },
    { path: 'M129 198 Q140 192 149 182', order: 1 },
    { path: 'M128 180 Q126 168 127 156', order: 1 },
  ],
  crown: [
    { cx: 127, cy: 156, r: 16 },
    { cx: 112, cy: 171, r: 12 },
    { cx: 150, cy: 181, r: 12 },
    { cx: 127, cy: 168, r: 14 },
  ],
  acornSpots: [],
  acorn: false,
  seedLeaves: [],
  crownCenter: { cx: 127, cy: 163 },
}

const YOUNG: OakTemplate = {
  trunk: { topY: 151, baseHalf: 7, topHalf: 2.5, flare: 1 },
  rootCount: 0,
  barkCount: 0,
  limbs: [
    { path: 'M128 166 Q108 151 95 133', order: 1 },
    { path: 'M129 161 Q150 147 165 129', order: 1 },
    { path: 'M128 176 Q120 159 116 141', order: 1 },
    { path: 'M95 133 Q88 125 82 115', order: 2 },
    { path: 'M165 129 Q172 121 178 111', order: 2 },
    { path: 'M116 141 Q110 131 108 121', order: 2 },
  ],
  crown: [
    { cx: 128, cy: 120, r: 30 },
    { cx: 96, cy: 125, r: 22 },
    { cx: 162, cy: 120, r: 22 },
    { cx: 128, cy: 95, r: 26 },
    { cx: 106, cy: 108, r: 20 },
    { cx: 152, cy: 106, r: 20 },
  ],
  acornSpots: [],
  acorn: false,
  seedLeaves: [],
  crownCenter: { cx: 128, cy: 113 },
}

const MATURE: OakTemplate = {
  trunk: { topY: 113, baseHalf: 12, topHalf: 6, flare: 3 },
  rootCount: 2,
  barkCount: 3,
  limbs: [
    { path: 'M128 169 Q100 151 80 129', order: 1 },
    { path: 'M132 161 Q160 145 184 124', order: 1 },
    { path: 'M126 181 Q110 161 98 143', order: 1 },
    { path: 'M130 152 Q133 135 128 119', order: 1 },
    { path: 'M80 129 Q70 119 60 105', order: 2 },
    { path: 'M184 124 Q194 116 204 105', order: 2 },
    { path: 'M98 143 Q90 131 86 117', order: 2 },
    { path: 'M128 119 Q120 109 113 99', order: 2 },
    { path: 'M128 119 Q138 109 147 101', order: 2 },
    { path: 'M60 105 Q55 99 51 92', order: 3 },
    { path: 'M204 105 Q209 99 213 92', order: 3 },
  ],
  crown: [
    { cx: 128, cy: 100, r: 40 },
    { cx: 82, cy: 112, r: 30 },
    { cx: 176, cy: 108, r: 30 },
    { cx: 128, cy: 70, r: 34 },
    { cx: 100, cy: 84, r: 26 },
    { cx: 156, cy: 82, r: 26 },
    { cx: 58, cy: 104, r: 22 },
    { cx: 200, cy: 102, r: 22 },
    { cx: 128, cy: 120, r: 30 },
  ],
  acornSpots: [
    { cx: 110, cy: 132 },
    { cx: 150, cy: 124 },
    { cx: 92, cy: 120 },
  ],
  acorn: false,
  seedLeaves: [],
  crownCenter: { cx: 128, cy: 94 },
}

const ANCIENT: OakTemplate = {
  trunk: { topY: 112, baseHalf: 18, topHalf: 7, flare: 5 },
  rootCount: 3,
  barkCount: 3,
  limbs: [
    { path: 'M128 130 Q104 116 88 96', order: 1 },
    { path: 'M132 126 Q156 112 172 92', order: 1 },
    { path: 'M126 140 Q112 124 104 108', order: 1 },
    { path: 'M130 120 Q130 100 124 84', order: 1 },
    { path: 'M88 96 Q80 86 74 76', order: 2 },
    { path: 'M172 92 Q180 84 186 74', order: 2 },
    { path: 'M124 84 Q118 74 116 66', order: 2 },
    { path: 'M126 140 Q118 120 110 104', order: 2 },
    { path: 'M74 76 Q70 70 67 62', order: 3 },
    { path: 'M186 74 Q190 68 193 62', order: 3 },
    { path: 'M88 96 Q84 90 80 84', order: 3 },
    { path: 'M172 92 Q176 86 178 80', order: 3 },
  ],
  crown: [
    { cx: 130, cy: 78, r: 48 },
    { cx: 86, cy: 92, r: 34 },
    { cx: 174, cy: 90, r: 34 },
    { cx: 126, cy: 48, r: 40 },
    { cx: 96, cy: 64, r: 30 },
    { cx: 160, cy: 62, r: 30 },
    { cx: 64, cy: 84, r: 24 },
    { cx: 192, cy: 82, r: 22 },
    { cx: 110, cy: 104, r: 28 },
    { cx: 152, cy: 104, r: 26 },
  ],
  acornSpots: [
    { cx: 104, cy: 106 },
    { cx: 150, cy: 104 },
    { cx: 128, cy: 110 },
    { cx: 84, cy: 96 },
  ],
  acorn: false,
  seedLeaves: [],
  crownCenter: { cx: 128, cy: 78 },
}

const TEMPLATES: readonly OakTemplate[] = [SEEDLING, SAPLING, YOUNG, MATURE, ANCIENT]

export const OAK_STAGE_COUNT = TEMPLATES.length

const M_POINT = /M\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/

/** The trunk's centreline x in the 260×260 viewBox — the tree's anchor for all geometry. */
export const TRUNK_X = 130

/**
 * How high a leaf cluster sits in the crown, 0 (lowest band, cy 202) → 1 (top, cy 72).
 * The ONE place this geometry mapping lives — both the per-generation crown lean and
 * the wilt droop weight derive from it. Unclamped; callers clamp if they must.
 */
export const crownHeightWeight = (cy: number): number => (202 - cy) / 130

/**
 * Turn a template into a concrete skeleton. When `vary` is set, the whole tree is
 * uniquely seeded by the GENERATION (so every client + every re-render sees the SAME
 * Gen-N oak): trunk girth + flare, bark, roots, crown shape/fullness/lean, branch angles
 * and acorn placement all differ per generation. The tree's *character* (girth, lean,
 * bushiness) is seeded from the generation alone, so it stays consistent as it grows.
 * Limbs vary only in angle (about their attach point) so they never detach from the trunk.
 */
function buildOak(t: OakTemplate, generation: number, stageIndex: number, vary: boolean): OakStage {
  const character = mulberry32((generation * 2654435761) >>> 0)
  const detail = mulberry32((generation * 101 + stageIndex + 1) >>> 0)
  const span = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo)

  const girth = vary ? span(character, 0.85, 1.18) : 1
  const flareMul = vary ? span(character, 0.6, 1.5) : 1
  const lean = vary ? (character() - 0.5) * 22 : 0
  const bushy = vary && character() < 0.5

  // Trunk: vary girth + flare (NOT the centreline) so limbs stay attached.
  const tp: TrunkParams = { ...t.trunk, flare: t.trunk.flare * flareMul }
  const trunk = buildTrunk(tp, 0, girth)
  const roots = buildRoots(t.rootCount, tp.baseHalf, girth, detail)
  const barkLines = buildBark(tp, 0, t.barkCount, girth, detail)
  const trunkWidth = tp.baseHalf * 2 * girth

  const crown: LeafCluster[] = t.crown.map((c) => {
    if (!vary) return { ...c }
    const heightWeight = crownHeightWeight(c.cy)
    return {
      cx: c.cx + lean * heightWeight + span(detail, -6, 6),
      cy: c.cy + span(detail, -5, 5),
      r: c.r * span(detail, 0.86, 1.16),
    }
  })
  if (bushy && crown.length) {
    const s = crown[Math.floor(detail() * crown.length)]
    crown.push({
      cx: s.cx + span(detail, -16, 16),
      cy: s.cy + span(detail, -14, 8),
      r: s.r * span(detail, 0.6, 0.95),
    })
  }

  const limbs: Limb[] = t.limbs.map((l) => {
    const m = M_POINT.exec(l.path)
    const pivot: [number, number] = m ? [parseFloat(m[1]), parseFloat(m[2])] : [130, 200]
    return { ...l, rot: vary ? span(detail, -7, 7) : 0, pivot }
  })

  const acornSpots = t.acornSpots.map((a) =>
    vary ? { cx: a.cx + span(detail, -8, 8), cy: a.cy + span(detail, -6, 6) } : { ...a },
  )

  return {
    trunk,
    trunkWidth,
    roots,
    barkLines,
    limbs,
    crown,
    acornSpots,
    acorn: t.acorn,
    seedLeaves: t.seedLeaves,
    crownCenter: { cx: t.crownCenter.cx + lean * 0.6, cy: t.crownCenter.cy },
  }
}

const clampStage = (i: number) => Math.max(0, Math.min(OAK_STAGE_COUNT - 1, Math.floor(i)))

/** The canonical (un-varied) skeleton for a stage. */
export function oakStageFor(stageIndex: number): OakStage {
  const i = clampStage(stageIndex)
  return buildOak(TEMPLATES[i], 1, i, false)
}

/** This generation's UNIQUE oak — seeded by the generation, stable across renders/clients. */
export function varyOak(generation: number, stageIndex: number): OakStage {
  const i = clampStage(stageIndex)
  return buildOak(TEMPLATES[i], generation, i, true)
}
